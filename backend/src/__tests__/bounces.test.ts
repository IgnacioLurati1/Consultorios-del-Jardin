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
import { classifyBounce, fetchBounced, hasBounced, syncBounces } from "../people/mailBounces.js";

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
    remove: vi.fn((row: any) => {
      em.bounced = em.bounced.filter((one: any) => one !== row);
    }),
    flush: vi.fn(async () => undefined),
  };
  return em;
}

/** Lo que contesta Gmail cuando la casilla no existe. */
const NO_EXISTE = "550-5.1.1 The email account that you tried to reach does not exist.";
/** Lo que contesta Outlook cuando no la entrega y no dice por qué. */
const NO_ENTREGA = "550 5.5.0 Requested action not taken: mailbox unavailable (S2017062302).";

const evento = (email: string, reason = NO_EXISTE) => ({
  email,
  date: "2026-09-17T15:53:43.000-03:00",
  reason,
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

  it("la primera vuelta pregunta por todo lo que el proveedor deje", async () => {
    const em = fakeEm();
    respondeCon({ events: [] });

    await syncBounces(em);
    const primera = vi.mocked(fetch).mock.calls[0][0] as string;

    // Sin nada guardado todavía, el arranque tiene que encontrar los correos que ya
    // rebotaron, no solo los del último mes. El tope del proveedor son noventa días.
    const desde = new Date(new URL(primera).searchParams.get("startDate")!);
    const dias = (Date.now() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(85);
    expect(dias).toBeLessThanOrEqual(91);
  });

  // El motivo es lo que separa "no existe" de "no se pudo entregar". Sin esta distinción,
  // un Hotmail que rechaza al remitente figuraba como una dirección inventada.
  it("separa la casilla que no existe de la que no recibe", async () => {
    respondeCon({ events: [evento("no.existe@gmail.com"), evento("real@hotmail.com", NO_ENTREGA)] });

    const bounced = await fetchBounced();

    expect(bounced).toEqual([
      expect.objectContaining({ email: "no.existe@gmail.com", kind: "missing" }),
      expect.objectContaining({ email: "real@hotmail.com", kind: "blocked" }),
    ]);
  });

  it("reconoce las formas de decir que la casilla no existe", () => {
    expect(classifyBounce("550 5.1.1 user unknown")).toBe("missing");
    expect(classifyBounce("550 No such user here")).toBe("missing");
    expect(classifyBounce("552 5.2.2 Mailbox full")).toBe("blocked");
    expect(classifyBounce("550-5.2.1 The email account that you tried to reach is inactive")).toBe("blocked");
    expect(classifyBounce(null)).toBe("blocked");
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
    respondeCon({ events: [evento("paciente@gmail.com")] });
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
    respondeCon({ events: [evento("paciente@gmail.com")] });
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
    respondeCon({ events: [evento("paciente@gmail.com")] });
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
    respondeCon({ events: [evento("sola@gmail.com")] });
    const em = conHistoria([{ email: "sola@gmail.com", createdBy: null }]);

    const { added, warned } = await syncBounces(em);

    expect({ added, warned }).toEqual({ added: 1, warned: 0 });
    expect(mailsMandados).toEqual([]);
  });

  it("la dirección queda anotada aunque esa persona ya no esté en la base", async () => {
    respondeCon({ events: [evento("borrado@gmail.com")] });
    const em = fakeEm([]);

    await syncBounces(em);

    expect(await hasBounced(em, "BORRADO@gmail.com")).toBe(true);
  });

  // La que existe y no recibe no se trata como un correo mal cargado: no frena el alta.
  it("la que no se pudo entregar no cuenta como inexistente", async () => {
    respondeCon({ events: [evento("real@hotmail.com", NO_ENTREGA)] });
    const em = fakeEm([]);

    await syncBounces(em);

    expect(await hasBounced(em, "real@hotmail.com")).toBe(false);
  });

  // El día que a esa dirección le entra un mensaje, el problema se terminó y el cartelito
  // se saca solo.
  it("saca la marca cuando el correo volvió a entregarse", async () => {
    const em = fakeEm([], [{ email: "real@hotmail.com", kind: "blocked", bouncedAt: new Date("2026-09-14"), notified: true }]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("event=delivered")
            ? { events: [{ date: "2026-09-16T10:00:00.000-03:00" }] }
            : { events: [] },
        text: async () => "",
      })) as any
    );

    await syncBounces(em, new Date("2026-09-17"));

    expect(em.bounced).toHaveLength(0);
  });

  // Las que se guardaron con la regla vieja tienen que corregirse solas en la vuelta
  // siguiente, sin que nadie toque la base.
  it("relee el motivo de lo que ya estaba guardado", async () => {
    respondeCon({ events: [evento("real@hotmail.com", NO_ENTREGA)] });
    const em = fakeEm([], [{ email: "real@hotmail.com", kind: "missing", notified: true }]);

    await syncBounces(em);

    expect(em.bounced[0].kind).toBe("blocked");
  });
});
