import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ============================================================
// Mock del módulo orm ANTES de importar cualquier servicio
// Esto evita que MikroORM intente conectarse a MySQL.
// Usamos vi.hoisted() para poder configurar las respuestas del
// EntityManager desde cada test (verifyToken consulta la base
// para saber si el usuario está deshabilitado).
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
    createQueryBuilder: vi.fn(),
  },
}));

vi.mock("../shared/db/orm.js", () => ({
  orm: { em: mockEm },
  syncSchema: vi.fn(),
}));

// Mock del envío de mails para que los tests no manden nada de verdad
vi.mock("../config/mailer.js", () => ({
  default: class MailServiceMock {
    createMessage = vi.fn();
    sendMail = vi.fn();
  },
}));

// Seteamos variables de entorno para JWT antes de importar los módulos
process.env.JWT_SECRET = "test-secret-key-for-unit-tests";
process.env.REFRESH_SECRET = "test-refresh-secret-key";
process.env.CHANGE_SECRET = "test-change-secret-key";

// Ahora sí importamos los módulos que queremos testear
import { verifyToken } from "../config/middlewares.js";
import { sanitizePersonInput, logOut } from "../people/people.controller.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import refreshTokenHandler from "../config/refreshToken.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// TEST 1: verifyToken rechaza requests sin token
// ============================================================
describe("verifyToken - sin token", () => {
  it("debe retornar 401 cuando no se envía token en los headers", async () => {
    const req: any = {
      headers: {},
    };

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = { status: statusMock };
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ message: "No autorizado" });
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================
// TEST 2: verifyToken llama next() con token válido
// ============================================================
describe("verifyToken - token válido", () => {
  it("debe setear req.user y llamar next() cuando el token es válido y el usuario está activo", async () => {
    const payload = { email: "test@test.com", type: "client" };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "15m" });

    // El middleware consulta la base para verificar que el usuario no esté deshabilitado
    mockEm.findOne.mockResolvedValue({ email: "test@test.com", active: true });

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    const res: any = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    };
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe("test@test.com");
    expect(req.user.type).toBe("client");
  });
});

// ============================================================
// TEST 3: verifyToken bloquea usuarios deshabilitados (baneados)
// ============================================================
describe("verifyToken - usuario deshabilitado", () => {
  it("debe retornar 403 aunque el token sea válido, si active es false", async () => {
    const payload = { email: "baneado@test.com", type: "client" };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "15m" });

    mockEm.findOne.mockResolvedValue({ email: "baneado@test.com", active: false });

    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = { status: statusMock };
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
    expect(next).not.toHaveBeenCalled();
  });

  it("debe retornar 403 si la persona del token ya no existe en la base", async () => {
    const payload = { email: "fantasma@test.com", type: "client" };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "15m" });

    mockEm.findOne.mockResolvedValue(null);

    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = { status: statusMock };
    const next = vi.fn();

    await verifyToken(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================
// TEST 4: sanitizePersonInput limpia campos undefined
// ============================================================
describe("sanitizePersonInput", () => {
  it("debe eliminar campos undefined y conservar los definidos, luego llamar next()", () => {
    const req: any = {
      body: {
        email: "paciente@test.com",
        name: "Juan",
        // Los demás campos no se envían, quedan undefined
      },
    };
    const res: any = {};
    const next = vi.fn();

    sanitizePersonInput(req, res, next);

    const sanitized = req.body.sanitizedInput;

    // Los campos definidos deben estar presentes
    expect(sanitized.email).toBe("paciente@test.com");
    expect(sanitized.name).toBe("Juan");

    // Los campos undefined deben haber sido eliminados
    expect(sanitized).not.toHaveProperty("docType");
    expect(sanitized).not.toHaveProperty("docNumber");
    expect(sanitized).not.toHaveProperty("surname");
    expect(sanitized).not.toHaveProperty("phoneNumber");
    expect(sanitized).not.toHaveProperty("password");
    expect(sanitized).not.toHaveProperty("speciality");
    expect(sanitized).not.toHaveProperty("type");

    // active tiene default true, así que debe existir
    expect(sanitized.active).toBe(true);

    // Debe llamar next()
    expect(next).toHaveBeenCalled();
  });
});

// ============================================================
// TEST 5: ScheduleService.isValidHourFormat
// ============================================================
describe("ScheduleService.isValidHourFormat", () => {
  const scheduleService = new ScheduleService();

  it("debe retornar true para formatos de hora válidos", () => {
    expect(scheduleService.isValidHourFormat("08:00")).toBe(true);
    expect(scheduleService.isValidHourFormat("23:59")).toBe(true);
    expect(scheduleService.isValidHourFormat("00:00")).toBe(true);
    expect(scheduleService.isValidHourFormat("12:30")).toBe(true);
  });

  it("debe retornar false para formatos de hora inválidos", () => {
    expect(scheduleService.isValidHourFormat("25:00")).toBe(false);
    expect(scheduleService.isValidHourFormat("abc")).toBe(false);
    expect(scheduleService.isValidHourFormat("8:00")).toBe(false); // falta el 0 adelante
    expect(scheduleService.isValidHourFormat("")).toBe(false);
    expect(scheduleService.isValidHourFormat("24:00")).toBe(false);
    expect(scheduleService.isValidHourFormat("12:60")).toBe(false);
  });
});

// ============================================================
// TEST 6: ScheduleService.isValidDay
// ============================================================
describe("ScheduleService.isValidDay", () => {
  const scheduleService = new ScheduleService();

  it("debe retornar true para días válidos de la semana", () => {
    expect(scheduleService.isValidDay("lunes")).toBe(true);
    expect(scheduleService.isValidDay("Viernes")).toBe(true);
    expect(scheduleService.isValidDay("sábado")).toBe(true); // con acento → removeAccents lo normaliza
    expect(scheduleService.isValidDay("MIERCOLES")).toBe(true);
    expect(scheduleService.isValidDay("domingo")).toBe(true);
  });

  it("debe retornar false para días inválidos", () => {
    expect(scheduleService.isValidDay("foo")).toBe(false);
    expect(scheduleService.isValidDay("")).toBe(false);
    expect(scheduleService.isValidDay("sunday")).toBe(false);
    expect(scheduleService.isValidDay("monday")).toBe(false);
  });
});


// ============================================================
// TEST 7: /api/refreshToken lee el refresh token de la cookie httpOnly
// ============================================================
describe("refreshToken", () => {
  // Devuelve un res mockeado y una promesa que resuelve cuando el handler responde,
  // porque el callback de jwt.verify es asincronico.
  function mockRes() {
    let resolveDone: () => void = () => {};
    const done = new Promise<void>((r) => (resolveDone = r));
    const json = vi.fn((_payload?: any) => {
      resolveDone();
    });
    const status = vi.fn(() => ({ json }));
    return { res: { status, json } as any, done, status, json };
  }

  function validRefreshToken() {
    return jwt.sign({ email: "test@test.com", type: "client" }, process.env.REFRESH_SECRET as string, { expiresIn: "30d" });
  }

  it("debe retornar 401 si no hay cookie de refresh token", async () => {
    const { res, done, status, json } = mockRes();

    refreshTokenHandler({ cookies: {} } as any, res);
    await done;

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ message: "Token inexistente" });
  });

  it("debe emitir un access token nuevo a partir de la cookie", async () => {
    mockEm.findOne.mockResolvedValue({ email: "test@test.com", active: true });
    const { res, done, json } = mockRes();

    refreshTokenHandler({ cookies: { refreshToken: validRefreshToken() } } as any, res);
    await done;

    const payload = json.mock.calls[0][0] as any;
    expect(payload.token).toBeDefined();
    const decoded = jwt.verify(payload.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.email).toBe("test@test.com");
  });

  it("debe rechazar con 403 el refresh de un usuario deshabilitado", async () => {
    mockEm.findOne.mockResolvedValue({ email: "test@test.com", active: false });
    const { res, done, status, json } = mockRes();

    refreshTokenHandler({ cookies: { refreshToken: validRefreshToken() } } as any, res);
    await done;

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ message: "Usuario deshabilitado", code: "USER_DISABLED" });
  });

  it("debe rechazar con 403 un refresh token invalido", async () => {
    const { res, done, status } = mockRes();

    refreshTokenHandler({ cookies: { refreshToken: "no-es-un-jwt" } } as any, res);
    await done;

    expect(status).toHaveBeenCalledWith(403);
  });
});

// ============================================================
// TEST 8: logout tiene que responder (antes dejaba el request colgado)
// ============================================================
describe("logOut", () => {
  it("debe limpiar la cookie y responder 200", async () => {
    const clearCookie = vi.fn();
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res: any = { clearCookie, status };

    await logOut({} as any, res);

    expect(clearCookie).toHaveBeenCalledWith("refreshToken", expect.objectContaining({ httpOnly: true }));
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ message: "Sesión cerrada" });
  });
});
