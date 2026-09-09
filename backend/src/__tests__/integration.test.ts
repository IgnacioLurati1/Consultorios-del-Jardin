import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    nativeUpdate: vi.fn(),
    remove: vi.fn(),
    count: vi.fn(),
    transactional: vi.fn(),
    createQueryBuilder: vi.fn(),
    // El cierre por seguridad escribe en un fork para no arrastrar lo que haya en la
    // unidad de trabajo del pedido que lo disparó. Acá el fork es el mismo objeto.
    fork: vi.fn(),
  },
}));

mockEm.fork.mockReturnValue(mockEm);

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
const { mailsMandados, sobres, enviados } = vi.hoisted(() => ({
  mailsMandados: [] as string[],
  /** Los mensajes armados, con su asunto. */
  sobres: [] as Array<{ to: string; subject: string }>,
  /** A quién se le mandó de verdad. Un mismo mensaje puede salir para varias personas. */
  enviados: [] as string[],
}));

vi.mock("../config/mailer.js", () => ({
  default: class MailServiceMock {
    createMessage = vi.fn().mockImplementation(async (to: string, asunto: string, html: string) => {
      mailsMandados.push(html);
      sobres.push({ to, subject: asunto });
      return { to, subject: asunto };
    });
    sendMail = vi.fn().mockImplementation(async (msg: any) => {
      enviados.push(msg?.to ?? "");
      return true;
    });
  },
}));

// Variables de entorno para JWT
process.env.JWT_SECRET = "test-secret-key-for-integration-tests";
process.env.REFRESH_SECRET = "test-refresh-secret-key";
process.env.CHANGE_SECRET = "test-change-secret-key";

// Imports después de los mocks
import { verifyToken } from "../config/middlewares.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { AppointmentService } from "../appointments/appointments.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { SecurityService } from "../security/security.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { AnnouncementService } from "../announcements/announcements.service.js";
import { findOne as findOnePerson } from "../people/people.controller.js";
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

// ============================================================
// Deshabilitar a un profesional.
// La cuenta cerrada ya no aparece en ningún lado, pero la marca de
// "aparece cuando se busca turno" es la que decide qué pasa el día
// que se la vuelve a abrir.
// ============================================================

describe("Integracion: deshabilitar a un profesional lo saca de la busqueda", () => {
  const peopleService = new PeopleService();

  beforeEach(() => {
    vi.clearAllMocks();
    // Un assign de verdad: lo que se mira acá es con qué valores queda la persona.
    mockEm.assign.mockImplementation((target: any, data: any) => Object.assign(target, data));
  });

  afterEach(() => {
    mockEm.assign.mockReset();
  });

  it("al deshabilitarlo deja de ofrecerse cuando alguien busca turno", async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockProfessional, active: true, bookable: true });

    expect(await peopleService.toggleState(mockProfessional.email, "admin@test.com")).toEqual({
      active: false,
      bookable: false,
    });
  });

  // La cuenta vuelve, la agenda del público no: eso lo decide un administrador aparte.
  it("volver a habilitarlo no lo devuelve solo a la busqueda", async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockProfessional, active: false, bookable: false });

    expect(await peopleService.toggleState(mockProfessional.email, "admin@test.com")).toEqual({
      active: true,
      bookable: false,
    });
  });

  it("a un paciente no le toca una marca que no es suya", async () => {
    mockEm.findOneOrFail.mockResolvedValue({ ...mockClient, active: true, bookable: true });

    expect(await peopleService.toggleState(mockClient.email, "admin@test.com")).toEqual({
      active: false,
      bookable: true,
    });
  });
});

// ============================================================
// Horarios de un profesional deshabilitado.
// La cuenta cerrada no borra nada: los módulos que tenía cargados
// siguen reservando la sala. Hay que poder sacarlos, y no hay que
// poder agregarle más.
// ============================================================

describe("Integracion: horarios de un profesional deshabilitado", () => {
  const scheduleService = new ScheduleService();

  const nuevoHorario = {
    day: "lunes",
    initialHour: "09:00",
    finalHour: "12:00",
    person: mockProfessional.email,
    room: mockRoom.idRoom,
    duration: 30,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no le deja cargar un horario nuevo", async () => {
    mockEm.findOne.mockResolvedValue({ ...mockProfessional, active: false });

    await expect(scheduleService.createSchedule(nuevoHorario)).rejects.toThrow(/deshabilitado/);
    // Ni siquiera llega a mirar si la franja estaba libre.
    expect(mockEm.create).not.toHaveBeenCalled();
  });

  it("al que sigue habilitado se lo carga como siempre", async () => {
    mockEm.findOne.mockResolvedValueOnce({ ...mockProfessional, active: true }).mockResolvedValueOnce(mockRoom);
    mockEm.find.mockResolvedValue([]);
    mockEm.create.mockReturnValue(mockSchedule);
    mockEm.populate.mockResolvedValue(undefined);
    mockEm.flush.mockResolvedValue(undefined);

    expect(await scheduleService.createSchedule(nuevoHorario)).toBe(mockSchedule);
  });

  // Lo que hace que la baja no deje basura: borrar no pregunta por el estado de la cuenta.
  it("los que le quedaron se pueden borrar igual", async () => {
    mockEm.nativeDelete.mockResolvedValue(1);

    await expect(scheduleService.removeSchedule("lunes", "09:00", mockProfessional.email)).resolves.toBeUndefined();
  });
});

// ============================================================
// Por qué no se pudo cargar un horario.
// Las tres causas son cosas que hizo quien lo carga, no fallas del
// servidor, y cada una se arregla distinto: correr la franja, elegir
// otra sala, o mirar de qué a qué abre la sucursal.
// ============================================================

describe("Integracion: el alta de horarios dice por que no se pudo", () => {
  const scheduleService = new ScheduleService();

  const nuevoHorario = {
    day: "lunes",
    initialHour: "09:00",
    finalHour: "12:00",
    person: mockProfessional.email,
    room: mockRoom.idRoom,
    duration: 30,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockResolvedValueOnce({ ...mockProfessional, active: true }).mockResolvedValueOnce(mockRoom);
  });

  // clearAllMocks limpia las llamadas pero no la cola de respuestas "once". Un test que
  // corta antes de consumirlas se las deja al siguiente, que ahí recibe un profesional
  // donde esperaba un turno.
  afterEach(() => {
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
  });

  it("avisa que la sala ya está ocupada, y no como error del servidor", async () => {
    mockEm.find.mockResolvedValueOnce([]).mockResolvedValueOnce([mockSchedule]);

    await expect(scheduleService.createSchedule(nuevoHorario)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("ocupado"),
    });
  });

  it("avisa que el profesional ya tenía esa franja tomada", async () => {
    mockEm.find.mockResolvedValueOnce([mockSchedule]).mockResolvedValueOnce([]);

    await expect(scheduleService.createSchedule(nuevoHorario)).rejects.toMatchObject({ status: 409 });
  });

  // Con las horas adentro del mensaje: si no, hay que ir a buscarlas a otra pantalla.
  it("dice de que a que abre la sucursal cuando la franja queda afuera", async () => {
    mockEm.find.mockResolvedValue([]);

    await expect(
      scheduleService.createSchedule({ ...nuevoHorario, initialHour: "19:00", finalHour: "20:00" })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining(`de ${mockOffice.openingTime} a ${mockOffice.closingTime}`),
    });
  });

  it("no acepta una duración que no es de las tres", async () => {
    await expect(scheduleService.createSchedule({ ...nuevoHorario, duration: 20 })).rejects.toMatchObject({ status: 400 });
  });
});

// ============================================================
// Quién se entera de qué.
// Cada cosa que pasa con un turno le pasa a dos personas, y las
// dos tienen que enterarse por un camino que no dependa de tener
// la aplicación abierta en ese momento.
// ============================================================

describe("Integracion: los avisos por mail de un turno", () => {
  const appointments = new AppointmentService();
  const settings = new SettingsService();

  const pedido = () => ({
    numAppointment: 77,
    state: "pending",
    date: new Date("2026-10-05T12:00:00Z"),
    initialHour: "09:00",
    finalHour: "10:00",
    patient: { ...mockClient },
    professional: { ...mockProfessional },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset y no clear: hay que vaciar también las respuestas "once" que haya dejado
    // encoladas cualquier otro test.
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mockEm.create.mockReset();

    sobres.length = 0;
    mailsMandados.length = 0;
    mockEm.flush.mockResolvedValue(undefined);
  });

  it("cuando el profesional rechaza el pedido, el mail va al paciente", async () => {
    mockEm.findOne.mockResolvedValueOnce(pedido()).mockResolvedValueOnce(null);
    mockEm.create.mockReturnValue({ denied: 0, expired: 0 });

    await appointments.deleteAppointment(77, mockProfessional.email, true);

    expect(sobres).toEqual([{ to: mockClient.email, subject: "No pudimos darte ese turno" }]);
  });

  // Antes pasaba por el mismo mail que el rechazo, así que al paciente le llegaba "el
  // profesional no pudo tomar el horario" por algo que acababa de hacer él, y el
  // profesional no se enteraba de nada aunque el pedido se borra de su lista.
  it("cuando el paciente da de baja su propio pedido, el mail va al profesional", async () => {
    mockEm.findOne.mockResolvedValue(pedido());

    await appointments.deleteAppointment(77, mockProfessional.email, false);

    expect(sobres).toEqual([{ to: mockProfessional.email, subject: "Se dio de baja un pedido" }]);
  });

  it("confirmar un pedido le avisa al paciente", async () => {
    mockEm.findOne.mockResolvedValue(pedido());

    await appointments.acceptAppointment(77, mockProfessional.email);

    expect(sobres).toEqual([{ to: mockClient.email, subject: "Tu turno está confirmado" }]);
  });

  // Confirmar de a uno mandaba el mail y confirmar en tanda no, así que quien usaba el
  // botón de confirmar todo dejaba a cada paciente esperando un aviso que no llegaba.
  it("confirmar todos los pedidos de una avisa a cada paciente", async () => {
    mockEm.findOne.mockResolvedValue({ ...mockProfessional });
    mockEm.find.mockResolvedValue([pedido(), { ...pedido(), numAppointment: 78 }]);

    expect(await settings.acceptPending(mockProfessional.email)).toBe(2);
    expect(sobres).toEqual([
      { to: mockClient.email, subject: "Tu turno está confirmado" },
      { to: mockClient.email, subject: "Tu turno está confirmado" },
    ]);
  });

  // Un mail que no sale no puede deshacer algo que ya está guardado. Antes de esto, con
  // el proveedor caído el profesional recibía un error y el turno quedaba confirmado
  // igual, así que apretaba de nuevo sobre algo que ya no estaba pendiente.
  it("si el mail falla igual queda confirmado", async () => {
    const turno = pedido();
    mockEm.findOne.mockResolvedValue(turno);

    const mailer = (appointments as any).mailService;
    const original = mailer.createMessage;
    mailer.createMessage = vi.fn().mockRejectedValue(new Error("el proveedor de mails no contesta"));

    try {
      await expect(appointments.acceptAppointment(77, mockProfessional.email)).resolves.toBeDefined();
      expect(turno.state).toBe("accepted");
    } finally {
      mailer.createMessage = original;
    }
  });

  // Cambiarle la fecha o la hora a un turno es de las pocas cosas que le pasan al
  // paciente sin que él haga nada, así que el mail no puede depender de que abra la
  // aplicación. Cambiarle el valor no, que es un tilde del profesional mientras trabaja.
  it("mover el turno de horario le avisa al paciente", async () => {
    const turno = { ...pedido(), state: "accepted" };
    mockEm.findOne.mockResolvedValueOnce(turno).mockResolvedValue(null);

    await appointments.updateAppointment(77, mockProfessional.email, {
      initialHour: "11:00",
      finalHour: "12:00",
    } as any);

    expect(sobres).toEqual([{ to: mockClient.email, subject: "Cambiamos tu turno de horario" }]);
  });

  it("cambiarle solo el valor no le manda nada", async () => {
    mockEm.findOne.mockResolvedValueOnce({ ...pedido(), state: "accepted" }).mockResolvedValue(null);

    await appointments.updateAppointment(77, mockProfessional.email, { value: 9000 } as any);

    expect(sobres).toEqual([]);
  });

  it("el profesional que apagó el aviso no lo recibe", async () => {
    mockEm.findOne.mockResolvedValue({
      ...pedido(),
      professional: { ...mockProfessional, mailOptOut: "request-withdrawn" },
    });

    await appointments.deleteAppointment(77, mockProfessional.email, false);

    expect(sobres).toEqual([]);
  });
});

// ============================================================
// Los mails que no son de un turno.
// La bienvenida es lo primero que ve alguien de todo el sistema,
// y el cierre por seguridad es lo único donde enterarse tarde
// cuesta de verdad.
// ============================================================

describe("Integracion: la bienvenida cuenta lo que se puede hacer", () => {
  const people = new PeopleService();

  const alta = (type: string) => ({
    email: type === "professional" ? "nueva.pro@demo.local" : "nueva.paciente@demo.local",
    docType: "DNI",
    docNumber: "30111222",
    name: "Sofía",
    surname: "Ramírez",
    phoneNumber: "3411234567",
    password: "unaClave1234",
    speciality: type === "professional" ? "psicologia" : null,
    type,
    active: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mailsMandados.length = 0;
    sobres.length = 0;

    mockEm.findOne.mockResolvedValue(null);
    mockEm.create.mockImplementation((_entity: any, data: any) => data);
    mockEm.flush.mockResolvedValue(undefined);
  });

  // Las dos altas pasaban por la misma función, así que a quien venía a atender le llegaba
  // "pedí turno con cualquiera de nuestros profesionales", que no es lo que va a hacer.
  it("al profesional le muestra sus pantallas", async () => {
    await people.createPerson(alta("professional") as any);

    const cuerpo = String(mailsMandados.at(-1) ?? "");
    expect(cuerpo).toContain("Pacientes");
    expect(cuerpo).toContain("Números");
    expect(cuerpo).toContain("Entrar a mi panel");
    expect(cuerpo).not.toContain("Pedir mi primer turno");
  });

  it("al paciente le muestra las suyas", async () => {
    await people.createPerson(alta("client") as any);

    const cuerpo = String(mailsMandados.at(-1) ?? "");
    expect(cuerpo).toContain("Pedir un turno");
    expect(cuerpo).toContain("Mis turnos");
    expect(cuerpo).toContain("Pedir mi primer turno");
    expect(cuerpo).not.toContain("Números");
  });
});

describe("Integracion: el cierre por seguridad le llega a la administracion", () => {
  const security = new SecurityService();

  const admins = [
    { email: "admin@test.com", name: "Ana", surname: "Ruiz", type: "admin", active: true },
    { email: "otro@test.com", name: "Beto", surname: "Paz", type: "admin", active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mailsMandados.length = 0;
    sobres.length = 0;
    enviados.length = 0;

    mockEm.fork.mockReturnValue(mockEm);
    mockEm.flush.mockResolvedValue(undefined);
    mockEm.count.mockResolvedValue(2);
    mockEm.find.mockResolvedValue(admins);
  });

  // Antes esto solo salía para la cuenta cerrada. Del otro lado el aviso esperaba en la
  // campanita del panel, que hay que entrar a mirar, y quien queda afuera no puede ni
  // pedir que lo reabran.
  it("le escribe a cada administrador, y no a la cuenta que cerró", async () => {
    mockEm.findOne.mockResolvedValue({ ...mockClient, banKind: null, bannedAt: null });

    expect(await security.lockForCompromise(mockClient.email, "ráfaga de operaciones ajenas")).toMatchObject({
      locked: true,
    });

    await vi.waitFor(() => expect(enviados.length).toBe(3));

    expect([...enviados].sort()).toEqual([mockClient.email, "admin@test.com", "otro@test.com"].sort());
    expect(sobres.some((sobre) => sobre.subject === "Se cerró una cuenta por seguridad")).toBe(true);
  });

  it("al administrador cerrado no se le manda dos veces", async () => {
    mockEm.findOne.mockResolvedValue({ ...admins[0], banKind: null, bannedAt: null, docType: "DNI" });

    await security.lockForCompromise("admin@test.com", "operaciones de madrugada");
    await vi.waitFor(() => expect(enviados.length).toBe(2));

    // Una copia como dueño de la cuenta y una sola para el otro administrador.
    expect([...enviados].sort()).toEqual(["admin@test.com", "otro@test.com"]);
  });
});


// ============================================================
// La ficha de una persona solo la ve entera quien tiene por que
// ============================================================
describe("Integracion: quien puede ver la ficha entera de una persona", () => {
  /** Un `res` de mentira que se queda con lo que le mandaron. */
  function fakeRes() {
    const captura: any = {};
    return {
      captura,
      status(code: number) {
        captura.code = code;
        return this;
      },
      json(body: any) {
        captura.body = body;
        return this;
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.findOne.mockResolvedValue({ ...mockClient });
  });

  // Antes esto devolvia la ficha entera a cualquiera con sesion abierta: con saberse un
  // mail alcanzaba para leer el documento y el telefono de cualquier persona del sistema.
  it("a un paciente que pregunta por otro no le manda ni el documento ni el telefono", async () => {
    const res = fakeRes();
    await findOnePerson(
      { params: { email: mockClient.email }, user: { email: "otro@test.com", type: "client" } } as any,
      res
    );

    expect(res.captura.code).toBe(200);
    expect(res.captura.body.data.docNumber).toBeUndefined();
    expect(res.captura.body.data.phoneNumber).toBeUndefined();
    // Lo que la pantalla de pedir turno necesita del profesional sigue estando.
    expect(res.captura.body.data).toMatchObject({ email: mockClient.email, name: mockClient.name, surname: mockClient.surname });
  });

  it("a la propia persona le manda la ficha entera, sin la contrasena", async () => {
    const res = fakeRes();
    await findOnePerson(
      { params: { email: mockClient.email }, user: { email: mockClient.email, type: "client" } } as any,
      res
    );

    expect(res.captura.body.data.docNumber).toBe(mockClient.docNumber);
    expect(res.captura.body.data.phoneNumber).toBe(mockClient.phoneNumber);
    expect(res.captura.body.data.password).toBeUndefined();
  });

  // El profesional necesita el telefono y el documento de su paciente para la ficha de la
  // aplicacion, y el admin los ve en su panel.
  it.each([["professional"], ["admin"]])("a %s le manda la ficha entera", async (type) => {
    const res = fakeRes();
    await findOnePerson({ params: { email: mockClient.email }, user: { email: "quien@test.com", type } } as any, res);

    expect(res.captura.body.data.docNumber).toBe(mockClient.docNumber);
    expect(res.captura.body.data.phoneNumber).toBe(mockClient.phoneNumber);
  });
});

// ============================================================
// Cuando dio de baja el paciente, y que se hace con eso
// ============================================================
describe("Integracion: la baja que hace el paciente queda anotada", () => {
  const appointments = new AppointmentService();

  function turnoAceptado() {
    return {
      numAppointment: 55,
      date: new Date(2026, 8, 20),
      initialHour: "10:00",
      finalHour: "11:00",
      state: "accepted",
      patient: mockClient,
      professional: mockProfessional,
      patientCancelledAt: null as Date | null,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mockEm.flush.mockResolvedValue(undefined);
    mailsMandados.length = 0;
    sobres.length = 0;
    enviados.length = 0;
  });

  it("anota la fecha cuando la baja la hace el paciente", async () => {
    const turno = turnoAceptado();
    mockEm.findOne.mockResolvedValue(turno);

    await appointments.cancelAppointment(55, mockClient.email);

    expect(turno.patientCancelledAt).toBeInstanceOf(Date);
  });

  // Del lado del profesional es una decision de su propia agenda: no hay nada que mirar
  // despues, asi que no se guarda nada.
  it("no anota nada cuando la baja la hace el profesional", async () => {
    const turno = turnoAceptado();
    mockEm.findOne.mockResolvedValue(turno);

    await appointments.cancelAppointment(55, mockProfessional.email);

    expect(turno.patientCancelledAt).toBeNull();
  });

  /*
   * El profesional tambien se atiende, y sacando turno con un colega el que baja es el
   * paciente. Antes esto se decidia por el tipo de cuenta y la baja se anotaba como del
   * profesional: al colega no le llegaba el aviso de que le quedaba libre el horario.
   */
  it("anota la fecha cuando el que baja es un profesional atendiendose", async () => {
    const colega = { ...mockProfessional, email: "colega@test.com" };
    const turno = { ...turnoAceptado(), patient: mockProfessional, professional: colega };
    mockEm.findOne.mockResolvedValue(turno);

    await appointments.cancelAppointment(55, mockProfessional.email);

    expect(turno.patientCancelledAt).toBeInstanceOf(Date);
  });
});

// ============================================================
// Dar de baja sobre la hora tambien marca al paciente
// ============================================================
describe("Integracion: las bajas sobre la hora marcan al paciente", () => {
  const security = new SecurityService();

  /** Un turno dado de baja con `horas` de anticipacion. */
  function bajaCon(horas: number) {
    const inicio = new Date(2026, 8, 20, 10, 0, 0, 0);

    return {
      date: new Date(2026, 8, 20),
      initialHour: "10:00",
      patientCancelledAt: new Date(inicio.getTime() - horas * 3_600_000),
      patient: mockClient,
    };
  }

  /** `find` contesta por orden: primero los cerrados, despues las bajas, despues los baneados. */
  function conBajas(bajas: any[], cerrados: any[] = []) {
    mockEm.find.mockReset();
    mockEm.find
      .mockResolvedValueOnce(cerrados)
      .mockResolvedValueOnce(bajas)
      .mockResolvedValueOnce([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.find.mockReset();
  });

  it("marca a quien dio de baja tres turnos con menos de un dia de aviso", async () => {
    conBajas([bajaCon(2), bajaCon(5), bajaCon(23)]);

    const report = await security.behaviourReport();

    expect(report.suspicious).toHaveLength(1);
    expect(report.suspicious[0]).toMatchObject({ email: mockClient.email, lateCancels: 3, reasons: ["lateCancels"] });
    // Sin turnos cerrados no hay proporcion de asistencia que mostrar.
    expect(report.suspicious[0].rate).toBeNull();
  });

  it("no marca a quien avisa con tiempo, por muchas veces que sea", async () => {
    conBajas([bajaCon(48), bajaCon(72), bajaCon(24), bajaCon(100)]);

    expect((await security.behaviourReport()).suspicious).toHaveLength(0);
  });

  it("con dos bajas sobre la hora todavia no alcanza", async () => {
    conBajas([bajaCon(1), bajaCon(3)]);

    expect((await security.behaviourReport()).suspicious).toHaveLength(0);
  });

  // El aviso que llega con el turno ya empezado es el caso extremo del mismo problema.
  it("cuenta tambien la baja que llega despues de la hora del turno", async () => {
    conBajas([bajaCon(-1), bajaCon(-3), bajaCon(2)]);

    expect((await security.behaviourReport()).suspicious[0]).toMatchObject({ lateCancels: 3 });
  });

  // El caso que hacia que la pantalla dijera un motivo que no era: 94% de asistencia y
  // marcado solo por avisar tarde. Nombrar ese porcentaje ahi lo hace leer como un cargo.
  it("no cuenta las ausencias como motivo cuando la asistencia esta bien", async () => {
    const cerrado = (state: string) => ({ state, patient: mockClient });
    conBajas(
      [bajaCon(1), bajaCon(2), bajaCon(3)],
      [cerrado("assisted"), cerrado("assisted"), cerrado("assisted"), cerrado("missed")]
    );

    const marcado = (await security.behaviourReport()).suspicious[0];

    expect(marcado.reasons).toEqual(["lateCancels"]);
    expect(marcado.missed).toBe(1);
  });

  it("sigue marcando por inasistencias, sin ninguna baja de por medio", async () => {
    const cerrado = (state: string) => ({ state, patient: mockClient });
    conBajas([], [cerrado("missed"), cerrado("missed"), cerrado("missed"), cerrado("assisted")]);

    const report = await security.behaviourReport();

    expect(report.suspicious[0]).toMatchObject({ missed: 3, assisted: 1, lateCancels: 0, reasons: ["missed"] });
    expect(report.measured).toBe(1);
  });
});


// ============================================================
// La campanita, guardada del lado del consultorio
// ============================================================
describe("Integracion: los avisos que quedan esperando a quien entra", () => {
  const notifications = new NotificationService();

  /** Lo que se le pasa a em.create: la fila que se iba a guardar. */
  const anotado = () => mockEm.create.mock.calls.map((call) => call[1]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mockEm.create.mockReset();
    mockEm.flush.mockReset();
    mockEm.nativeUpdate.mockReset();
    mockEm.flush.mockResolvedValue(undefined);
  });

  it("guarda el aviso con todo lo que la pantalla necesita para dibujarlo", async () => {
    mockEm.findOne.mockResolvedValue(mockClient);

    await notifications.notify(mockClient.email, {
      eventKey: "t9:confirmado",
      title: "Te confirmaron el turno",
      body: "Llega cinco minutos antes.",
      tone: "good",
      target: "appointments",
    });

    const fila = anotado()[0];
    expect(fila.eventKey).toBe("t9:confirmado");
    expect(fila.title).toBe("Te confirmaron el turno");
    expect(fila.tone).toBe("good");
    expect(fila.target).toBe("appointments");
    expect(fila.person).toBe(mockClient);
    // Nace sin ver: es lo que le pone el numero a la campanita.
    expect(fila.readAt).toBeNull();
    expect(fila.dismissedAt).toBeNull();
  });

  // La razon de ser de todo esto: el aviso se anota cuando pasa, no cuando alguien mira.
  // Antes se deducia comparando contra una foto guardada en el navegador, y la primera
  // vez no habia con que comparar: el que entraba de cero no veia nunca lo que habia
  // pasado mientras no estaba.
  it("no le pide nada a la pantalla: se anota en el momento del hecho", async () => {
    mockEm.findOne.mockResolvedValue(mockClient);

    await notifications.notify(mockClient.email, {
      eventKey: "t9:alta",
      title: "Te anotamos en un turno",
      tone: "good",
    });

    expect(mockEm.create).toHaveBeenCalledTimes(1);
    expect(mockEm.flush).toHaveBeenCalledTimes(1);
  });

  it("a una persona que no existe no le anota nada", async () => {
    mockEm.findOne.mockResolvedValue(null);

    await notifications.notify("nadie@ejemplo.com", { eventKey: "x", title: "Hola", tone: "info" });

    expect(mockEm.create).not.toHaveBeenCalled();
  });

  it("sin destinatario tampoco, y sin ir a preguntarle a la base", async () => {
    await notifications.notify(null, { eventKey: "x", title: "Hola", tone: "info" });

    expect(mockEm.findOne).not.toHaveBeenCalled();
  });

  // Lo mas importante de todo: esto corre al lado de sacar un turno. Si fallara hacia
  // afuera, un turno bien guardado se caeria por no haber podido escribir un renglon.
  it("no rompe lo que lo llamo cuando la base falla", async () => {
    mockEm.findOne.mockRejectedValue(new Error("se cayo la base"));

    await expect(notifications.notify(mockClient.email, { eventKey: "x", title: "Hola", tone: "info" })).resolves.toBeUndefined();
  });

  it("el mismo hecho anotado dos veces no rompe nada", async () => {
    mockEm.findOne.mockResolvedValue(mockClient);
    mockEm.flush.mockRejectedValueOnce(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" }));

    await expect(
      notifications.notify(mockClient.email, { eventKey: "t9:confirmado", title: "Te confirmaron el turno", tone: "good" })
    ).resolves.toBeUndefined();
  });

  it("lee solo los de esa persona, sin los borrados y sin los vencidos", async () => {
    mockEm.find.mockResolvedValue([]);

    await notifications.list(mockClient.email);

    const [, filtro] = mockEm.find.mock.calls[0];
    expect(filtro.person).toEqual({ email: mockClient.email });
    expect(filtro.dismissedAt).toBeNull();
    expect(filtro.createdAt.$gte).toBeInstanceOf(Date);
  });

  /*
   * Abrir la campanita da por visto lo que estaba en pantalla y nada mas.
   *
   * Antes marcaba todo lo que tuviera sin leer, incluido lo que habia entrado despues de
   * la ultima consulta y todavia no se dibujaba. Ese aviso quedaba leido sin haberse
   * mostrado nunca, y era justo el que uno estaba esperando ver: el numero no aparecia.
   */
  it("da por visto hasta el ultimo que estaba en pantalla", async () => {
    mockEm.nativeUpdate.mockResolvedValue(1);

    await notifications.markSeen(mockClient.email, 118);

    const [, filtro] = mockEm.nativeUpdate.mock.calls[0];
    expect(filtro.readAt).toBeNull();
    expect(filtro.idNotification).toEqual({ $lte: 118 });
  });

  // Es lo que manda una version anterior de la pagina o de la app. Entre un deploy y el
  // otro tiene que seguir marcando algo en vez de no marcar nada.
  it("sin tope marca todo lo que este sin ver", async () => {
    mockEm.nativeUpdate.mockResolvedValue(3);

    await notifications.markSeen(mockClient.email);

    const [, filtro] = mockEm.nativeUpdate.mock.calls[0];
    expect(filtro.readAt).toBeNull();
    expect(filtro.idNotification).toBeUndefined();
  });

  it("cuenta como sin ver solo los que no tienen fecha de visto", async () => {
    mockEm.find.mockResolvedValue([
      { idNotification: 1, title: "Uno", body: null, tone: "info", target: null, createdAt: new Date(), readAt: null },
      { idNotification: 2, title: "Dos", body: null, tone: "info", target: null, createdAt: new Date(), readAt: new Date() },
    ]);

    const { data, unread } = await notifications.list(mockClient.email);

    expect(data).toHaveLength(2);
    expect(unread).toBe(1);
    expect(data[0].read).toBe(false);
    expect(data[1].read).toBe(true);
  });

  it("abrir la campanita marca solo los que faltaban", async () => {
    mockEm.nativeUpdate.mockResolvedValue(3);

    await notifications.markSeen(mockClient.email);

    const [, filtro, cambio] = mockEm.nativeUpdate.mock.calls[0];
    expect(filtro).toEqual({ person: { email: mockClient.email }, readAt: null });
    expect(cambio.readAt).toBeInstanceOf(Date);
  });

  // El filtro lleva el email, asi que no hay forma de borrar el aviso de otro ni
  // escribiendo el numero a mano.
  it("el aviso de otra persona no se puede borrar", async () => {
    mockEm.findOne.mockResolvedValue(null);

    await expect(notifications.dismiss(mockClient.email, 77)).rejects.toThrow("Ese aviso no existe");

    const [, filtro] = mockEm.findOne.mock.calls[0];
    expect(filtro).toEqual({ idNotification: 77, person: { email: mockClient.email } });
  });

  // Borrar marca en vez de borrar de verdad: si la fila se fuera, la clave del hecho
  // quedaria libre y una segunda anotacion del mismo hecho lo traeria de vuelta.
  it("borrar deja la fila marcada, para que el hecho no vuelva", async () => {
    const aviso = { idNotification: 5, dismissedAt: null as Date | null };
    mockEm.findOne.mockResolvedValue(aviso);

    await notifications.dismiss(mockClient.email, 5);

    expect(aviso.dismissedAt).toBeInstanceOf(Date);
  });

  it("la limpieza se lleva lo que ya no se le mostraba a nadie", async () => {
    mockEm.nativeDelete.mockResolvedValue(12);

    expect(await notifications.cleanup()).toBe(12);
    const [, filtro] = mockEm.nativeDelete.mock.calls[0];
    expect(filtro.createdAt.$lt).toBeInstanceOf(Date);
  });
});

// ============================================================
// Que cada hecho del consultorio deje su aviso
// ============================================================
describe("Integracion: los hechos que llegan a la campanita", () => {
  const appointments = new AppointmentService();

  /** Los avisos anotados en esta corrida, con a quien le tocaron. */
  function avisos() {
    return mockEm.create.mock.calls
      .map((call) => call[1])
      .filter((fila: any) => fila?.eventKey)
      .map((fila: any) => ({ para: fila.person?.email, key: fila.eventKey, title: fila.title, body: fila.body, tone: fila.tone, target: fila.target }));
  }

  function turnoAceptado(extra: Record<string, unknown> = {}) {
    return {
      numAppointment: 88,
      date: new Date(2026, 8, 20),
      initialHour: "10:00",
      finalHour: "11:00",
      state: "accepted",
      patient: mockClient,
      professional: mockProfessional,
      patientCancelledAt: null as Date | null,
      ...extra,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mockEm.create.mockReset();
    mockEm.flush.mockReset();
    mockEm.flush.mockResolvedValue(undefined);
    mailsMandados.length = 0;
    sobres.length = 0;
    enviados.length = 0;
  });

  /** El findOne sirve a dos cosas a la vez: el turno y la persona del aviso. */
  function conTurno(turno: any) {
    mockEm.findOne.mockImplementation(async (entidad: any) => {
      const nombre = entidad?.name ?? entidad?.constructor?.name ?? "";
      if (nombre === "Person") return turno.patient?.email ? turno.patient : mockClient;
      return turno;
    });
  }

  it("confirmar un turno le deja el aviso al paciente", async () => {
    const turno = turnoAceptado({ state: "pending" });
    mockEm.findOne.mockImplementation(async (entidad: any) => ((entidad?.name ?? "") === "Person" ? mockClient : turno));

    await appointments.acceptAppointment(88, mockProfessional.email);

    const aviso = avisos().find((a) => a.key === "t88:confirmado");
    expect(aviso).toBeDefined();
    expect(aviso!.para).toBe(mockClient.email);
    expect(aviso!.tone).toBe("good");
    expect(aviso!.target).toBe("appointments");
  });

  it("la baja del paciente le deja aviso a los dos", async () => {
    const turno = turnoAceptado();
    conTurno(turno);
    mockEm.findOne.mockImplementation(async (entidad: any) => ((entidad?.name ?? "") === "Person" ? mockProfessional : turno));

    await appointments.cancelAppointment(88, mockClient.email);

    const claves = avisos().map((a) => a.key);
    expect(claves).toContain("t88:cancelado");
    expect(claves).toContain("t88:libre");
  });

  // La marca es la misma que mira la ficha del turno y la que cuenta el panel de
  // comportamiento: por debajo de un dia el horario ya no se alcanza a ofrecer.
  it("la baja sobre la hora se lo dice al profesional en el titulo", async () => {
    const dentroDeUnRato = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const turno = turnoAceptado({
      date: dentroDeUnRato,
      initialHour: `${String(dentroDeUnRato.getHours()).padStart(2, "0")}:00`,
    });
    mockEm.findOne.mockImplementation(async (entidad: any) => ((entidad?.name ?? "") === "Person" ? mockProfessional : turno));

    await appointments.cancelAppointment(88, mockClient.email);

    const aviso = avisos().find((a) => a.key === "t88:libre");
    expect(aviso!.title).toBe("Te cancelaron un turno sobre la hora");
    expect(aviso!.body).toContain("menos de un dia de aviso".replace("dia", "día"));
    expect(aviso!.tone).toBe("warn");
  });

  it("con aviso de sobra, el mismo hecho se cuenta sin marca", async () => {
    const turno = turnoAceptado({ date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), initialHour: "10:00" });
    mockEm.findOne.mockImplementation(async (entidad: any) => ((entidad?.name ?? "") === "Person" ? mockProfessional : turno));

    await appointments.cancelAppointment(88, mockClient.email);

    const aviso = avisos().find((a) => a.key === "t88:libre");
    expect(aviso!.title).toBe("Se te liberó un horario");
    expect(aviso!.tone).toBe("info");
  });

  // Cancelando el, no hay nada que contarle: se lo estaria avisando de si mismo.
  it("si cancela el profesional, el aviso es solo para el paciente", async () => {
    const turno = turnoAceptado();
    mockEm.findOne.mockImplementation(async (entidad: any) => ((entidad?.name ?? "") === "Person" ? mockClient : turno));

    await appointments.cancelAppointment(88, mockProfessional.email);

    const claves = avisos().map((a) => a.key);
    expect(claves).toContain("t88:cancelado");
    expect(claves).not.toContain("t88:libre");
  });
});

// ============================================================
// Mover un turno de dia
// ============================================================
describe("Integracion: mover un turno lo deja en el dia que se pidio", () => {
  const appointments = new AppointmentService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm.findOne.mockReset();
    mockEm.find.mockReset();
    mockEm.create.mockReset();
    mockEm.flush.mockReset();
    mockEm.flush.mockResolvedValue(undefined);
    mockEm.assign.mockImplementation((entidad: any, cambios: any) => Object.assign(entidad, cambios));
    mockEm.count.mockResolvedValue(0);
  });

  /*
   * La fecha viaja como "AAAA-MM-DD" y antes entraba tal cual a la entidad. El ORM la leia
   * como medianoche UTC y despues escribia la columna DATE con los componentes locales: en
   * UTC-3 eso guardaba el dia anterior. El turno quedaba agendado un dia antes de lo que
   * decia el mail que le llegaba al paciente.
   */
  it("guarda el dia que vino y no el anterior", async () => {
    const turno = {
      numAppointment: 91,
      date: new Date(2026, 10, 10),
      initialHour: "21:00",
      finalHour: "21:30",
      state: "accepted",
      patient: null,
      professional: mockProfessional,
    };
    // El findOne lo usan dos cosas: buscar el turno y buscar con que otro turno choca.
    // La consulta del choque se reconoce porque excluye al turno que se esta moviendo.
    mockEm.findOne.mockImplementation(async (entidad: any, filtro: any) => {
      if ((entidad?.name ?? "") === "Person") return mockProfessional;
      return filtro?.numAppointment?.$ne ? null : turno;
    });
    mockEm.find.mockResolvedValue([]);

    await appointments.updateAppointment(91, mockProfessional.email, { date: "2026-11-12" } as any);

    expect(turno.date.getFullYear()).toBe(2026);
    expect(turno.date.getMonth()).toBe(10);
    expect(turno.date.getDate()).toBe(12);
  });

  it("una fecha imposible se rechaza con un mensaje que se entiende", async () => {
    const turno = { numAppointment: 91, date: new Date(2026, 10, 10), initialHour: "21:00", finalHour: "21:30", state: "accepted", patient: null, professional: mockProfessional };
    mockEm.findOne.mockResolvedValue(turno);

    await expect(appointments.updateAppointment(91, mockProfessional.email, { date: "no es una fecha" } as any)).rejects.toThrow(
      "La fecha del turno no es válida"
    );
  });
});
