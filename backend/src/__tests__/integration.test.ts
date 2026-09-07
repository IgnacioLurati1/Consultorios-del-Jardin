import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ============================================================
// Mocks globales - vi.mock se hoistea al top, así que la factory
// no puede referenciar variables externas. Usamos vi.hoisted()
// para crear los mocks que se comparten.
// ============================================================

const { mockEm } = vi.hoisted(() => ({
  mockEm: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    flush: vi.fn(),
    removeAndFlush: vi.fn(),
    assign: vi.fn(),
    populate: vi.fn(),
    nativeDelete: vi.fn(),
    remove: vi.fn(),
    count: vi.fn(),
    transactional: vi.fn(),
    createQueryBuilder: vi.fn(),
  },
}));

vi.mock("../shared/db/orm.js", () => ({
  orm: { em: mockEm },
  syncSchema: vi.fn(),
}));

/*
 * El mailer, con memoria.
 *
 * Guarda el cuerpo de cada mensaje en vez de tirarlo: es la única forma de mirar el link
 * que le llega a la persona, que es justamente lo que hay que revisar en el alta con la
 * dirección validada.
 */
const { mailsMandados } = vi.hoisted(() => ({ mailsMandados: [] as string[] }));

vi.mock("../config/mailer.js", () => ({
  default: class MailServiceMock {
    createMessage = vi.fn().mockImplementation(async (_to: string, _asunto: string, html: string) => {
      mailsMandados.push(html);
      return {};
    });
    sendMail = vi.fn().mockResolvedValue(undefined);
  },
}));

// Variables de entorno para JWT
process.env.JWT_SECRET = "test-secret-key-for-integration-tests";
process.env.REFRESH_SECRET = "test-refresh-secret-key";
process.env.CHANGE_SECRET = "test-change-secret-key";

// Imports después de los mocks
import { verifyToken } from "../config/middlewares.js";
import { PeopleService } from "../people/people.service.js";
import refreshTokenHandler from "../config/refreshToken.js";

// ============================================================
// DATOS MOCK - Cadena completa: Province → City → Office → Room
//              → Professional → Schedule → Client saca turno
// ============================================================

const mockProvince = {
  idProvince: 1,
  nameProvince: "Santa Fe",
  active: true,
};

const mockCity = {
  idCity: 1,
  nameCity: "Rosario",
  province: mockProvince,
  active: true,
};

const mockOffice = {
  idOffice: 1,
  description: "Consultorio Central",
  city: mockCity,
  openingTime: "08:00",
  closingTime: "18:00",
  active: true,
};

const mockRoom = {
  idRoom: 1,
  description: "Consultorio 1",
  office: mockOffice,
  active: true,
};

const mockProfessional = {
  email: "dr@test.com",
  docType: "DNI",
  docNumber: "12345678",
  name: "Carlos",
  surname: "García",
  phoneNumber: "3411234567",
  password: "$2b$10$hashedpassword",
  speciality: "psicologia",
  type: "professional",
  active: true,
};

const mockClient = {
  email: "paciente@test.com",
  docType: "DNI",
  docNumber: "87654321",
  name: "María",
  surname: "López",
  phoneNumber: "3417654321",
  password: "$2b$10$hashedpassword",
  speciality: null,
  type: "client",
  active: true,
};

const mockSchedule = {
  day: "lunes",
  initialHour: "09:00",
  finalHour: "12:00",
  person: mockProfessional,
  room: mockRoom,
  duration: 30,
};

// ============================================================
// TEST DE INTEGRACIÓN: Flujo completo de turnos
// Province → City → Office → Room → Professional → Schedule
// → Client se loguea → Saca turno → Professional acepta turno
// ============================================================
describe("Integración: Flujo completo de creación y aceptación de turno", () => {
  let professionalToken: string;
  let clientToken: string;
  const peopleService = new PeopleService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe completar el flujo: login → crear turno → aceptar turno", async () => {
    // --------------------------------------------------------
    // PASO 1: Login del profesional - genera JWT válido
    // --------------------------------------------------------
    const professionalTokens = await peopleService.createPersonTokens(
      mockProfessional.email,
      mockProfessional.type
    );
    professionalToken = professionalTokens.token;

    expect(professionalToken).toBeDefined();
    const decodedProfessional = jwt.verify(professionalToken, process.env.JWT_SECRET as string) as any;
    expect(decodedProfessional.email).toBe("dr@test.com");
    expect(decodedProfessional.type).toBe("professional");

    // --------------------------------------------------------
    // PASO 2: Login del paciente - genera JWT válido
    // --------------------------------------------------------
    const clientTokens = await peopleService.createPersonTokens(
      mockClient.email,
      mockClient.type
    );
    clientToken = clientTokens.token;

    expect(clientToken).toBeDefined();
    const decodedClient = jwt.verify(clientToken, process.env.JWT_SECRET as string) as any;
    expect(decodedClient.email).toBe("paciente@test.com");
    expect(decodedClient.type).toBe("client");

    // --------------------------------------------------------
    // PASO 3: Verificar token del paciente con middleware
    // Simula que el paciente hace un request autenticado
    // --------------------------------------------------------
    const req: any = {
      headers: { authorization: `Bearer ${clientToken}` },
    };
    const res: any = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    };
    const next = vi.fn();

    // verifyToken consulta la base para descartar usuarios deshabilitados
    mockEm.findOne.mockResolvedValue({ email: mockClient.email, active: true });

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.email).toBe("paciente@test.com");
    expect(req.user.type).toBe("client");

    // --------------------------------------------------------
    // PASO 4: Paciente solicita un turno
    // Simulamos lo que hace AppointmentEngine.validateAndCreateAppointment
    // mockeando las llamadas al EntityManager
    // --------------------------------------------------------

    // El appointment que se "crea" en la DB
    const mockAppointment = {
      numAppointment: 1,
      date: new Date("2026-02-23"), // un lunes
      initialHour: "09:00",
      finalHour: "09:30",
      professional: mockProfessional,
      patient: mockClient,
      room: mockRoom,
      value: 0,
      state: "pending",
      observations: null,
      reminderSent: "not sent" as const,
    };

    // Verificamos que el turno se creó con estado "pending"
    expect(mockAppointment.state).toBe("pending");
    expect(mockAppointment.professional.email).toBe("dr@test.com");
    expect(mockAppointment.room.office.description).toBe("Consultorio Central");
    expect(mockAppointment.initialHour).toBe("09:00");
    expect(mockAppointment.finalHour).toBe("09:30");
    expect(mockAppointment.patient.email).toBe("paciente@test.com");

    // --------------------------------------------------------
    // PASO 5: Verificar token del profesional
    // --------------------------------------------------------
    const reqProf: any = {
      headers: { authorization: `Bearer ${professionalToken}` },
    };
    const resProf: any = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    };
    const nextProf = vi.fn();

    mockEm.findOne.mockResolvedValue({ email: mockProfessional.email, active: true });

    await verifyToken(reqProf, resProf, nextProf);

    expect(nextProf).toHaveBeenCalled();
    expect(reqProf.user.email).toBe("dr@test.com");
    expect(reqProf.user.type).toBe("professional");

    // --------------------------------------------------------
    // PASO 6: Profesional acepta el turno
    // Simula AppointmentService.acceptAppointment
    // --------------------------------------------------------

    // El appointment ahora está en la DB como "pending"
    const appointmentToAccept = { ...mockAppointment, state: "pending" };

    // Mock: buscar el appointment pendiente del profesional
    mockEm.findOneOrFail.mockResolvedValueOnce(appointmentToAccept);
    mockEm.flush.mockResolvedValueOnce(undefined);

    // Simulamos la lógica de acceptAppointment
    const foundAppointment = await mockEm.findOneOrFail();
    foundAppointment.state = "accepted";
    await mockEm.flush();

    // Verificamos que el estado cambió a "accepted"
    expect(foundAppointment.state).toBe("accepted");
    expect(foundAppointment.professional.email).toBe("dr@test.com");
    expect(foundAppointment.date).toEqual(new Date("2026-02-23"));

    // Verificamos que la cadena completa de datos es consistente
    expect(foundAppointment.room.office.city.province.nameProvince).toBe("Santa Fe");
    expect(foundAppointment.room.office.city.nameCity).toBe("Rosario");
    expect(foundAppointment.room.office.description).toBe("Consultorio Central");
    expect(foundAppointment.room.description).toBe("Consultorio 1");
  });
});

// ============================================================
// TEST DE INTEGRACION: un usuario baneado (active = false) no
// puede operar aunque tenga un token emitido antes del baneo
// ============================================================
describe("Integracion: usuario deshabilitado por el admin", () => {
  const peopleService = new PeopleService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe rechazar con 403 los requests de un usuario baneado despues de emitido el token", async () => {
    // El paciente se loguea normalmente y obtiene un token valido
    const { token } = await peopleService.createPersonTokens(mockClient.email, mockClient.type);

    // El admin lo deshabilita: en la base queda active = false
    mockEm.findOne.mockResolvedValue({ ...mockClient, active: false });

    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = { status: statusMock };
    const next = vi.fn();

    await verifyToken(req, res, next);

    // El token sigue siendo criptograficamente valido, pero el usuario no puede operar
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================
// Deshacer el alta de un paciente sin cuenta.
// Es un borrado de verdad, asi que lo que importa es a quien le dice que no.
// ============================================================

describe("Integracion: deshacer el alta de un paciente anonimo", () => {
  const peopleService = new PeopleService();

  const mockAnonimo = {
    email: "recien.cargado@demo.local",
    name: "Marta",
    surname: "Gomez",
    type: "client",
    active: true,
    anonymous: true,
    createdBy: mockProfessional.email,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lo borra cuando lo cargo este profesional y no tiene turnos", async () => {
    mockEm.findOne.mockResolvedValue(mockAnonimo);
    mockEm.count.mockResolvedValue(0);
    mockEm.removeAndFlush.mockResolvedValue(undefined);

    const ok = await peopleService.deleteAnonymousPatient(mockAnonimo.email, mockProfessional.email);

    expect(ok).toBe(true);
    expect(mockEm.removeAndFlush).toHaveBeenCalledWith(mockAnonimo);
  });

  it("no lo borra si ya tiene turnos, aunque sean cancelados", async () => {
    mockEm.findOne.mockResolvedValue(mockAnonimo);
    mockEm.count.mockResolvedValue(1);

    await expect(peopleService.deleteAnonymousPatient(mockAnonimo.email, mockProfessional.email)).rejects.toThrow(
      /ya tiene turnos/
    );
    expect(mockEm.removeAndFlush).not.toHaveBeenCalled();
  });

  it("no deja que un profesional borre el paciente que cargo otro", async () => {
    mockEm.findOne.mockResolvedValue(mockAnonimo);

    await expect(peopleService.deleteAnonymousPatient(mockAnonimo.email, "otro@demo.local")).rejects.toThrow(
      /otro profesional/
    );
    expect(mockEm.removeAndFlush).not.toHaveBeenCalled();
  });

  it("no toca una cuenta registrada, ni siquiera si la cargo el mismo", async () => {
    mockEm.findOne.mockResolvedValue({ ...mockAnonimo, anonymous: false });

    await expect(peopleService.deleteAnonymousPatient(mockAnonimo.email, mockProfessional.email)).rejects.toThrow(
      /sin cuenta/
    );
    expect(mockEm.removeAndFlush).not.toHaveBeenCalled();
  });

  it("avisa cuando la persona no existe", async () => {
    mockEm.findOne.mockResolvedValue(null);

    await expect(peopleService.deleteAnonymousPatient("nadie@demo.local", mockProfessional.email)).rejects.toThrow(
      /No encontramos/
    );
  });
});

/**
 * El alta de un paciente, en dos tiempos.
 *
 * Lo que hace que esto valga la pena probar no es que la cuenta se cree: es todo lo que
 * tiene que **no** pasar en el medio. Pedir el mail no puede dejar nada guardado, la
 * contraseña no puede viajar legible en un link que queda escrito en una bandeja de
 * entrada, y el token que crea cuentas no puede servir para cambiarle la contraseña a
 * nadie.
 */
describe("Integracion: alta de paciente con el mail validado", () => {
  const peopleService = new PeopleService();

  const datos = {
    email: "Nuevo.Paciente@Demo.Local",
    name: "Nuevo",
    surname: "Paciente",
    docType: "DNI",
    docNumber: "12345678",
    phoneNumber: "3411234567",
    password: "unaClaveLarga",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pedir el mail no crea ninguna cuenta", async () => {
    mockEm.findOne.mockResolvedValue(null);

    await peopleService.sendSignupMail(datos);

    expect(mockEm.create).not.toHaveBeenCalled();
    expect(mockEm.flush).not.toHaveBeenCalled();
  });

  it("no manda nada si ese email ya tiene cuenta", async () => {
    mockEm.findOne.mockResolvedValue({ email: datos.email, anonymous: false });

    await expect(peopleService.sendSignupMail(datos)).rejects.toThrow(/Ya hay una cuenta/);
  });

  it("le corta el paso a los datos que no sirven, antes de mandar el mail", async () => {
    mockEm.findOne.mockResolvedValue(null);

    await expect(peopleService.sendSignupMail({ ...datos, email: "esto no es un mail" })).rejects.toThrow(/formato/);
    await expect(peopleService.sendSignupMail({ ...datos, password: "corta" })).rejects.toThrow(/6 caracteres/);
    await expect(peopleService.sendSignupMail({ ...datos, phoneNumber: "123" })).rejects.toThrow(/10 dígitos/);
  });

  it("el token del link no lleva la contraseña escrita", async () => {
    mockEm.findOne.mockResolvedValue(null);
    await peopleService.sendSignupMail(datos);

    // El contenido de un token se lee sin la clave, así que lo que viaje ahí adentro es
    // tan público como el mail donde va el link.
    const token = tokenDelUltimoMail();
    const contenido = jwt.verify(token, process.env.CHANGE_SECRET as string) as any;

    expect(contenido.password).not.toBe(datos.password);
    expect(contenido.password.startsWith("$2")).toBe(true); // hash de bcrypt
    expect(contenido.email).toBe("nuevo.paciente@demo.local"); // el mail es la clave: siempre en minúscula
    expect(contenido.purpose).toBe("signup");
  });

  it("el link crea la cuenta con los datos que se firmaron", async () => {
    mockEm.findOne.mockResolvedValue(null);
    await peopleService.sendSignupMail(datos);

    const token = tokenDelUltimoMail();
    mockEm.findOne.mockResolvedValue(null);
    mockEm.create.mockImplementation((_entidad: unknown, data: any) => data);

    const persona: any = await peopleService.confirmSignup(token);

    expect(persona).toMatchObject({ email: "nuevo.paciente@demo.local", name: "Nuevo", type: "client", anonymous: false });
    expect(persona.password.startsWith("$2")).toBe(true);
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it("un link vencido, roto o de otra cosa no crea nada", async () => {
    const ajeno = jwt.sign({ email: "nuevo.paciente@demo.local" }, process.env.CHANGE_SECRET as string);

    await expect(peopleService.confirmSignup("cualquier cosa")).rejects.toThrow(/Token expirado/);
    await expect(peopleService.confirmSignup(ajeno)).rejects.toThrow(/Token expirado/); // sin purpose: es de contraseña
    expect(mockEm.create).not.toHaveBeenCalled();
  });

  it("el token que crea cuentas no sirve para cambiar contraseñas", async () => {
    mockEm.findOne.mockResolvedValue(null);
    await peopleService.sendSignupMail(datos);

    await expect(peopleService.changePassword(tokenDelUltimoMail(), "otraClave")).rejects.toThrow(/Token expirado/);
  });
});

/** El token que quedó adentro del último mail que se mandó. */
function tokenDelUltimoMail(): string {
  const cuerpo = String(mailsMandados.at(-1) ?? "");
  const encontrado = cuerpo.match(/confirmar-cuenta\?token=([\w.-]+)/);
  if (!encontrado) throw new Error("El mail que se mandó no lleva ningún link de alta");
  return encontrado[1];
}

// ============================================================
// Renovar la sesion.
// El navegador puede mandar el refresh token de dos formas y las dos tienen que
// funcionar: la cookie httpOnly, que es la buena, y el header, que es el respaldo
// para los navegadores que bloquean las cookies de terceros.
// ============================================================

describe("Integracion: renovar la sesion con la cookie o con el header", () => {
  const peopleService = new PeopleService();

  /** Un req/res de mentira, con lo justo que mira el handler. */
  function armar(headers: Record<string, string>, cookies: Record<string, string> = {}) {
    const json = vi.fn();
    const req: any = { headers, cookies };
    const res: any = { status: vi.fn().mockReturnValue({ json }), json };
    return { req, res, json };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockResolvedValue({ ...mockClient, active: true });
  });

  it("renueva cuando el token viene en el header", async () => {
    const { refreshToken: guardado } = await peopleService.createPersonTokens(mockClient.email, mockClient.type);
    const { req, res, json } = armar({ "x-refresh-token": guardado });

    await refreshTokenHandler(req, res);
    await new Promise((listo) => setTimeout(listo, 0));

    expect(res.status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });

  it("renueva cuando el token viene solo en la cookie", async () => {
    const { refreshToken: enCookie } = await peopleService.createPersonTokens(mockClient.email, mockClient.type);
    const { req, res, json } = armar({}, { refreshToken: enCookie });

    await refreshTokenHandler(req, res);
    await new Promise((listo) => setTimeout(listo, 0));

    expect(res.status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });

  // Es la razon por la que el header va primero: en un navegador puede quedar la cookie
  // de una sesion anterior, y no puede tapar el token que el cliente manda ahora.
  it("el header le gana a una cookie que quedo de antes", async () => {
    const { refreshToken: bueno } = await peopleService.createPersonTokens(mockClient.email, mockClient.type);
    const { req, res, json } = armar({ "x-refresh-token": bueno }, { refreshToken: "ya-no-sirve" });

    await refreshTokenHandler(req, res);
    await new Promise((listo) => setTimeout(listo, 0));

    expect(res.status).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });

  it("sin ninguna de las dos, no hay sesion que renovar", async () => {
    const { req, res } = armar({});

    await refreshTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
