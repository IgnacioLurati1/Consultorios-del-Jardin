import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Los correos que rebotan.
//
// El proveedor es un doble: cada caso decide qué contesta. La base es otro doble que
// guarda las filas en un arreglo, que es lo único que hace falta para ver si algo se
// guardó dos veces o si se avisó dos veces.
// ============================================================

const { avisos, mailsMandados } = vi.hoisted(() => ({
  avisos: [] as Array<{ email: string; title: string }>,
  mailsMandados: [] as string[],
}));

vi.mock("../notifications/notifications.service.js", () => ({
  NotificationService: class {
    notify = vi.fn(async (email: string, event: any) => {
      avisos.push({ email, title: event.title });
    });
  },
}));

vi.mock("../config/mailer.js", () => ({
  default: class {
    createMessage = vi.fn(async (to: string) => ({ to }));
    sendMail = vi.fn(async (msg: any) => {
      mailsMandados.push(msg.to);
      return true;
    });
  },
}));

import { BouncedEmail } from "../people/bouncedEmail.entity.js";
import { Person } from "../people/people.entity.js";
import { fetchBounced, hasBounced, syncBounces } from "../people/mailBounces.js";

/** Una base de mentira con dos tablas, que es todo lo que toca este código. */
function fakeEm(people: any[] = [], bounced: any[] = []) {
  const em: any = {
    bounced,
    people,
    findOne: vi.fn(async (entity: any, where: any) => {
      const rows = entity === BouncedEmail ? em.bounced : em.people;
      return rows.find((row: any) => row.email === where.email) ?? null;
    }),
    find: vi.fn(async () => em.bounced),
    count: vi.fn(async () => em.bounced.length),
    create: vi.fn((_entity: any, data: any) => {
      em.bounced.push(data);
      return data;
    }),
    flush: vi.fn(async () => undefined),
  };
  return em;
}

const contacto = (email: string, code = "hardBounce") => ({
  email,
  blockedAt: "2026-09-17T20:53:43.000Z",
  reason: { code, message: "This contact's email address generated a hard bounce" },
});

function respondeCon(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as any)
  );
}

describe("traer los rebotes del proveedor", () => {
  beforeEach(() => {
    process.env.BREVO_KEY = "clave-de-prueba";
    avisos.length = 0;
    mailsMandados.length = 0;
  });

  it("la primera vuelta pregunta por todo lo que el proveedor tenga", async () => {
    const em = fakeEm();
    respondeCon({ contacts: [] });

    await syncBounces(em);
    const primera = vi.mocked(fetch).mock.calls[0][0] as string;

    // Sin nada guardado todavía, el arranque tiene que encontrar los correos que ya
    // rebotaron, no solo los del último mes.
    const desde = new Date(new URL(primera).searchParams.get("startDate")!);
    expect(Date.now() - desde.getTime()).toBeGreaterThan(300 * 24 * 60 * 60 * 1000);
  });

  it("se queda solo con los rebotes duros", async () => {
    respondeCon({ contacts: [contacto("no.existe@gmail.com"), contacto("se.borro@gmail.com", "unsubscribedViaApi")] });

    const bounced = await fetchBounced();

    expect(bounced?.map((row) => row.email)).toEqual(["no.existe@gmail.com"]);
  });

  it("sin clave del proveedor no dice que no rebotó ninguna, dice que no sabe", async () => {
    delete process.env.BREVO_KEY;

    expect(await fetchBounced()).toBeNull();
  });

  it("con el proveedor caído tampoco inventa nada", async () => {
    respondeCon({ message: "error" }, false, 503);

    expect(await fetchBounced()).toBeNull();
  });
});

describe("guardar los rebotes y avisar", () => {
  beforeEach(() => {
    process.env.BREVO_KEY = "clave-de-prueba";
    avisos.length = 0;
    mailsMandados.length = 0;
  });

  /** Con algo ya guardado, la vuelta deja de ser la primera y los avisos salen. */
  const conHistoria = (people: any[]) => fakeEm(people, [{ email: "vieja@gmail.com", notified: true }]);

  it("le avisa al profesional que había cargado a esa persona", async () => {
    respondeCon({ contacts: [contacto("paciente@gmail.com")] });
    const em = conHistoria([
      { email: "paciente@gmail.com", name: "Ana", surname: "Pérez", createdBy: "dr@consultorio.com" },
      { email: "dr@consultorio.com", name: "Carlos", surname: "García", active: true },
    ]);

    const { added, warned } = await syncBounces(em);

    expect({ added, warned }).toEqual({ added: 1, warned: 1 });
    expect(avisos).toEqual([{ email: "dr@consultorio.com", title: "Un correo no existe" }]);
    expect(mailsMandados).toEqual(["dr@consultorio.com"]);
  });

  // El día que esto se publica, el proveedor tiene un año de rebotes guardados. Avisar de
  // todos de golpe sería una pila de mails sobre fichas viejas.
  it("la primera vuelta marca sin avisar", async () => {
    respondeCon({ contacts: [contacto("paciente@gmail.com")] });
    const em = fakeEm([
      { email: "paciente@gmail.com", name: "Ana", surname: "Pérez", createdBy: "dr@consultorio.com" },
      { email: "dr@consultorio.com", active: true },
    ]);

    const { added, warned } = await syncBounces(em);

    expect({ added, warned }).toEqual({ added: 1, warned: 0 });
    expect(mailsMandados).toEqual([]);
    expect(em.bounced).toHaveLength(1);
  });

  it("no avisa dos veces por lo mismo", async () => {
    respondeCon({ contacts: [contacto("paciente@gmail.com")] });
    const em = conHistoria([
      { email: "paciente@gmail.com", name: "Ana", surname: "Pérez", createdBy: "dr@consultorio.com" },
      { email: "dr@consultorio.com", active: true },
    ]);

    await syncBounces(em);
    const segunda = await syncBounces(em);

    expect(segunda).toEqual({ added: 0, warned: 0 });
    expect(mailsMandados).toHaveLength(1);
  });

  it("una cuenta que se registró sola no la cargó nadie, así que no hay a quién avisarle", async () => {
    respondeCon({ contacts: [contacto("sola@gmail.com")] });
    const em = conHistoria([{ email: "sola@gmail.com", createdBy: null }]);

    const { added, warned } = await syncBounces(em);

    expect({ added, warned }).toEqual({ added: 1, warned: 0 });
    expect(mailsMandados).toEqual([]);
  });

  it("la dirección queda anotada aunque esa persona ya no esté en la base", async () => {
    respondeCon({ contacts: [contacto("borrado@gmail.com")] });
    const em = fakeEm([]);

    await syncBounces(em);

    expect(await hasBounced(em, "BORRADO@gmail.com")).toBe(true);
  });
});
