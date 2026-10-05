import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// La puerta de la consola de instalaciones.
//
// Crear un administrador es la operación más grave del sistema: quien la consigue se queda
// con el consultorio entero. Así que lo que se prueba acá no es que funcione, sino que no
// se abra: un token de la aplicación, uno de otra instalación, una cuenta que no está en la
// lista, una que dejó de ser admin, y la contraseña que se pide de nuevo al crear.
//
// La base es un doble con un arreglo de personas, que es todo lo que toca este código.
// ============================================================

const { estado } = vi.hoisted(() => {
  // Las claves van antes de cualquier import: config/tokens las lee de acá, y dotenv no
  // pisa lo que ya está puesto.
  process.env.JWT_SECRET = "clave-de-la-aplicacion-para-las-pruebas-0001";
  process.env.CONSOLE_JWT_SECRET = "clave-de-la-consola-para-las-pruebas-0002";
  process.env.REFRESH_SECRET = "clave-de-refresh-para-las-pruebas-0003";
  process.env.CHANGE_SECRET = "clave-de-cambios-para-las-pruebas-0004";
  process.env.TOKEN_ISSUER = "jardin";
  process.env.CONSOLE_ORIGIN = "https://consola.ejemplo.com";
  process.env.OWNER_EMAILS = "dueño@ejemplo.com";

  return { estado: { people: [] as any[], mails: [] as string[] } };
});

vi.mock("../shared/db/orm.js", () => {
  const em: any = {
    findOne: vi.fn(async (_entity: any, where: any) => estado.people.find((p) => p.email === where.email) ?? null),
    find: vi.fn(async (_entity: any, where: any) => estado.people.filter((p) => p.type === where.type)),
    count: vi.fn(async (_entity: any, where: any) => estado.people.filter((p) => p.type === where.type).length),
    create: vi.fn((_entity: any, data: any) => {
      estado.people.push(data);
      return data;
    }),
    flush: vi.fn(async () => {}),
    fork: vi.fn(() => em),
  };

  return { orm: { em } };
});

vi.mock("../people/people.service.js", () => ({
  PeopleService: class {
    sendPasswordMail = vi.fn(async (email: string) => {
      estado.mails.push(email);
      return true;
    });
  },
}));

import bcrypt from "bcrypt";
import { AUD_CONSOLE, signAccessToken } from "../config/tokens.js";
import { isOwner, onlyOwner, requireConsoleOrigin } from "../console/console.guard.js";
import { ConsoleService } from "../console/console.service.js";

const ORIGEN = "https://consola.ejemplo.com";
const DUEÑO = "dueño@ejemplo.com";
const CLAVE = "la-contraseña-del-dueño";

/** Un res de mentira que se queda con lo último que le dijeron. */
function fakeRes() {
  const res: any = {
    code: 0,
    body: null as any,
    status(code: number) {
      res.code = code;
      return res;
    },
    json(body: any) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function fakeReq(headers: Record<string, string> = {}) {
  return { headers, method: "POST", originalUrl: "/api/console/admins", path: "/api/console/admins" } as any;
}

async function sembrarDueño(cambios: Record<string, any> = {}) {
  estado.people.push({
    email: DUEÑO,
    name: "Nombre",
    surname: "Apellido",
    type: "admin",
    active: true,
    password: await bcrypt.hash(CLAVE, 10),
    passwordSetAt: new Date(),
    ...cambios,
  });
}

beforeEach(() => {
  estado.people.length = 0;
  estado.mails.length = 0;
  process.env.OWNER_EMAILS = DUEÑO;
  process.env.CONSOLE_ORIGIN = ORIGEN;
});

describe("el origen de la consola", () => {
  it("rechaza una request sin Origin", () => {
    const res = fakeRes();
    const next = vi.fn();

    requireConsoleOrigin(fakeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
  });

  it("rechaza un origen que no es el de la consola", () => {
    const res = fakeRes();
    const next = vi.fn();

    requireConsoleOrigin(fakeReq({ origin: "https://consultoriosdeljardin.com.ar" }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
  });

  it("acepta el de la consola, con o sin barra final", () => {
    for (const origin of [ORIGEN, `${ORIGEN}/`]) {
      const next = vi.fn();
      requireConsoleOrigin(fakeReq({ origin }), fakeRes(), next);
      expect(next).toHaveBeenCalled();
    }
  });
});

describe("quién es dueño", () => {
  it("sin lista cargada, nadie", () => {
    process.env.OWNER_EMAILS = "";
    expect(isOwner(DUEÑO)).toBe(false);
  });

  it("no mira mayúsculas ni espacios", () => {
    expect(isOwner(`  ${DUEÑO.toUpperCase()} `)).toBe(true);
  });

  it("una cuenta que no está en la lista, no", () => {
    expect(isOwner("cualquiera@ejemplo.com")).toBe(false);
  });
});

describe("la puerta de la consola", () => {
  it("sin token no entra", async () => {
    const res = fakeRes();
    const next = vi.fn();

    await onlyOwner(fakeReq({ origin: ORIGEN }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(401);
  });

  it("un token de la aplicación no entra, aunque sea de un admin", async () => {
    await sembrarDueño();
    const res = fakeRes();
    const next = vi.fn();
    const deLaApp = signAccessToken(DUEÑO, "admin"); // audiencia y clave de la aplicación

    await onlyOwner(fakeReq({ origin: ORIGEN, authorization: `Bearer ${deLaApp}` }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(401);
  });

  it("un token de la consola de una cuenta que no está en la lista, tampoco", async () => {
    estado.people.push({ email: "otro@ejemplo.com", type: "admin", active: true, password: "x" });
    const res = fakeRes();
    const next = vi.fn();
    const token = signAccessToken("otro@ejemplo.com", "admin", AUD_CONSOLE);

    await onlyOwner(fakeReq({ origin: ORIGEN, authorization: `Bearer ${token}` }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
  });

  it("una cuenta de la lista que dejó de ser admin en esta instalación, tampoco", async () => {
    await sembrarDueño({ type: "client" });
    const res = fakeRes();
    const next = vi.fn();
    const token = signAccessToken(DUEÑO, "admin", AUD_CONSOLE);

    await onlyOwner(fakeReq({ origin: ORIGEN, authorization: `Bearer ${token}` }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
  });

  it("una cuenta cerrada, tampoco", async () => {
    await sembrarDueño({ active: false });
    const res = fakeRes();
    const next = vi.fn();
    const token = signAccessToken(DUEÑO, "admin", AUD_CONSOLE);

    await onlyOwner(fakeReq({ origin: ORIGEN, authorization: `Bearer ${token}` }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.code).toBe(403);
  });

  it("el dueño con su token de consola entra", async () => {
    await sembrarDueño();
    const req = fakeReq({ origin: ORIGEN, authorization: `Bearer ${signAccessToken(DUEÑO, "admin", AUD_CONSOLE)}` });
    const next = vi.fn();

    await onlyOwner(req, fakeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.owner).toEqual({ email: DUEÑO });
  });
});

describe("entrar a la consola", () => {
  it("con la contraseña equivocada, no", async () => {
    await sembrarDueño();
    await expect(new ConsoleService().login(DUEÑO, "otra")).rejects.toThrow("No autorizado");
  });

  it("una cuenta que no es dueña, no, y contesta lo mismo", async () => {
    estado.people.push({
      email: "admin@ejemplo.com",
      type: "admin",
      active: true,
      password: await bcrypt.hash(CLAVE, 10),
    });

    await expect(new ConsoleService().login("admin@ejemplo.com", CLAVE)).rejects.toThrow("No autorizado");
  });

  it("el dueño recibe un token que sirve en la consola y no en la aplicación", async () => {
    await sembrarDueño();

    const sesion = await new ConsoleService().login(DUEÑO, CLAVE);

    expect(sesion.email).toBe(DUEÑO);
    expect(sesion.issuer).toBe("jardin");

    const { verifyAccessToken } = await import("../config/tokens.js");
    expect(verifyAccessToken(sesion.token, AUD_CONSOLE).email).toBe(DUEÑO);
    expect(() => verifyAccessToken(sesion.token)).toThrow();
  });
});

describe("crear un administrador", () => {
  const nuevo = { email: "nuevo@ejemplo.com", name: "Nuevo", surname: "Admin" };

  it("pide la contraseña de nuevo, aunque el token sea válido", async () => {
    await sembrarDueño();

    await expect(new ConsoleService().createAdmin(DUEÑO, "la-que-no-es", nuevo)).rejects.toThrow(
      "La contraseña no coincide"
    );
    expect(estado.people).toHaveLength(1);
  });

  it("no convierte en admin a una cuenta que ya existe", async () => {
    await sembrarDueño();
    estado.people.push({ email: nuevo.email, type: "client", active: true });

    await expect(new ConsoleService().createAdmin(DUEÑO, CLAVE, nuevo)).rejects.toThrow("Ya hay una cuenta con ese correo");
    expect(estado.people.find((p) => p.email === nuevo.email).type).toBe("client");
  });

  it("rechaza los datos incompletos antes de tocar la base", async () => {
    await sembrarDueño();
    const service = new ConsoleService();

    await expect(service.createAdmin(DUEÑO, CLAVE, { ...nuevo, email: "" })).rejects.toThrow("Falta el correo");
    await expect(service.createAdmin(DUEÑO, CLAVE, { ...nuevo, email: "no-es-un-mail" })).rejects.toThrow("no parece válido");
    await expect(service.createAdmin(DUEÑO, CLAVE, { ...nuevo, name: "" })).rejects.toThrow("Falta el nombre");
    await expect(service.createAdmin(DUEÑO, CLAVE, { ...nuevo, surname: "" })).rejects.toThrow("Falta el apellido");

    expect(estado.people).toHaveLength(1);
  });

  it("crea la cuenta y manda el mail para que elija su contraseña", async () => {
    await sembrarDueño();

    const resultado = await new ConsoleService().createAdmin(DUEÑO, CLAVE, nuevo);

    expect(resultado).toEqual({ email: nuevo.email, mailSent: true });
    expect(estado.mails).toEqual([nuevo.email]);

    const creado = estado.people.find((p) => p.email === nuevo.email);
    expect(creado.type).toBe("admin");
    expect(creado.active).toBe(true);
    expect(creado.bookable).toBe(false);
    // Nadie conoce la contraseña inicial, ni se puede adivinar comparando dos altas.
    expect(await bcrypt.compare("", creado.password)).toBe(false);
    expect(creado.password).not.toContain(CLAVE);
  });

  it("guarda el correo en minúsculas, como lo busca el login", async () => {
    await sembrarDueño();

    await new ConsoleService().createAdmin(DUEÑO, CLAVE, { ...nuevo, email: "MAYUS@Ejemplo.COM" });

    expect(estado.people.some((p) => p.email === "mayus@ejemplo.com")).toBe(true);
  });
});
