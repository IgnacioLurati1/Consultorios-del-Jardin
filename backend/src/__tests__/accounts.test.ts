import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// La baja de cuentas y la comprobación del mail que se carga.
//
// Las dos cosas se prueban sin base y sin red: el em es un doble que anota qué se le pidió
// y en qué orden, y el DNS es otro que contesta lo que quiere cada caso.
// ============================================================

vi.mock("node:dns", () => ({
  promises: {
    resolveMx: vi.fn(),
    resolve: vi.fn(),
    lookup: vi.fn(),
  },
}));

import { promises as dns } from "node:dns";
import { deletionDateFor, deletionDue, purgeAccount, purgeDisabledAccounts } from "../people/accountCleanup.js";
import { assertDeliverableEmail, clearEmailCache } from "../shared/emailCheck.js";
import { Person } from "../people/people.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Recurrence } from "../recurrences/recurrences.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { toISODate } from "../shared/dates.js";

/** Un em que solo anota. `transactional` corre lo de adentro con el mismo doble. */
function fakeEm() {
  const deletes: any[] = [];
  const updates: any[] = [];

  const em: any = {
    deletes,
    updates,
    people: [] as Person[],
    transactional: vi.fn(async (work: any) => work(em)),
    nativeDelete: vi.fn(async (entity: any, where: any) => {
      deletes.push({ entity, where });
      return 1;
    }),
    nativeUpdate: vi.fn(async (entity: any, where: any, data: any) => {
      updates.push({ entity, where, data });
      return 1;
    }),
    find: vi.fn(async () => em.people),
    flush: vi.fn(async () => undefined),
  };

  return em;
}

describe("cuándo se borra una cuenta deshabilitada", () => {
  it("una baja de principio de mes se borra a fin de ese mes", () => {
    // 1 de septiembre más tres semanas es el 22, que todavía es septiembre.
    expect(toISODate(deletionDateFor(new Date(2026, 8, 1)))).toBe("2026-09-30");
  });

  it("una baja de la segunda quincena se borra a fin del mes siguiente", () => {
    expect(toISODate(deletionDateFor(new Date(2026, 8, 17)))).toBe("2026-10-31");
  });

  it("la última semana del mes también cae en el mes siguiente", () => {
    expect(toISODate(deletionDateFor(new Date(2026, 0, 31)))).toBe("2026-02-28");
  });

  it("no le toca antes de la fecha, y sí el mismo día", () => {
    const bannedAt = new Date(2026, 8, 1);

    expect(deletionDue(bannedAt, new Date(2026, 8, 29, 23, 0))).toBe(false);
    expect(deletionDue(bannedAt, new Date(2026, 8, 30, 4, 45))).toBe(true);
  });
});

describe("borrar una persona con todo lo que cuelga", () => {
  it("borra los turnos antes que las recurrencias y la persona al final", async () => {
    const em = fakeEm();

    await purgeAccount(em, "quien@sea.com");

    const order = em.deletes.map((paso: any) => paso.entity);
    expect(order.indexOf(Appointment)).toBeLessThan(order.indexOf(Recurrence));
    expect(order.indexOf(Schedule)).toBeLessThan(order.indexOf(Person));
    expect(order[order.length - 1]).toBe(Person);
  });

  it("deja de nombrarla en los pacientes que había cargado", async () => {
    const em = fakeEm();

    await purgeAccount(em, "profesional@consultorio.com");

    expect(em.updates).toEqual([
      { entity: Person, where: { createdBy: "profesional@consultorio.com" }, data: { createdBy: null } },
    ]);
  });

  it("va todo junto o no va nada", async () => {
    const em = fakeEm();

    await purgeAccount(em, "quien@sea.com");

    expect(em.transactional).toHaveBeenCalledOnce();
  });
});

describe("la limpieza de fin de mes", () => {
  it("borra la que ya cumplió y no toca a la de la semana pasada", async () => {
    const em = fakeEm();
    em.people = [
      { email: "vieja@mail.com", bannedAt: new Date(2026, 7, 1) },
      { email: "reciente@mail.com", bannedAt: new Date(2026, 8, 25) },
    ];

    const { deleted } = await purgeDisabledAccounts(em, new Date(2026, 8, 30));

    expect(deleted).toEqual(["vieja@mail.com"]);
  });

  it("a la deshabilitada sin fecha le empieza a contar hoy, sin borrarla", async () => {
    const em = fakeEm();
    const sinFecha: any = { email: "antigua@mail.com", bannedAt: null };
    em.people = [sinFecha];

    const hoy = new Date(2026, 8, 30);
    const { deleted, stamped } = await purgeDisabledAccounts(em, hoy);

    expect(deleted).toEqual([]);
    expect(stamped).toBe(1);
    expect(sinFecha.bannedAt).toBe(hoy);
  });
});

describe("el mail que se carga tiene que existir", () => {
  beforeEach(() => {
    clearEmailCache();
    vi.mocked(dns.resolveMx).mockReset();
    vi.mocked(dns.resolve).mockReset();
    vi.mocked(dns.lookup).mockReset();
  });

  const noExiste = () => Object.assign(new Error("not found"), { code: "ENOTFOUND" });

  it("deja pasar un dominio que recibe mails, y lo guarda en minúscula", async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([{ exchange: "mx.gmail.com", priority: 10 }] as any);

    await expect(assertDeliverableEmail("  Paciente@Gmail.com ")).resolves.toBe("paciente@gmail.com");
  });

  it("frena un dominio inventado y sugiere el parecido", async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(noExiste());
    vi.mocked(dns.resolve).mockRejectedValue(noExiste());
    vi.mocked(dns.lookup).mockRejectedValue(noExiste());

    await expect(assertDeliverableEmail("juan@gmial.com")).rejects.toThrow("juan@gmail.com");
  });

  it("frena un dominio inventado sin parecido a ninguno", async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(noExiste());
    vi.mocked(dns.resolve).mockRejectedValue(noExiste());
    vi.mocked(dns.lookup).mockRejectedValue(noExiste());

    await expect(assertDeliverableEmail("juan@noexistenada.com")).rejects.toThrow("Ese correo no existe");
  });

  it("cuando el camino directo está cerrado, pregunta por el del sistema", async () => {
    const cerrado = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    vi.mocked(dns.resolveMx).mockRejectedValue(cerrado);
    vi.mocked(dns.resolve).mockRejectedValue(cerrado);
    vi.mocked(dns.lookup).mockResolvedValue({ address: "142.251.128.101", family: 4 } as any);

    await expect(assertDeliverableEmail("paciente@gmail.com")).resolves.toBe("paciente@gmail.com");

    // Y por ese mismo camino se entera de que un dominio no existe.
    vi.mocked(dns.lookup).mockRejectedValue(noExiste());
    await expect(assertDeliverableEmail("paciente@noexistenada.com")).rejects.toThrow("Ese correo no existe");
  });

  it("acepta un dominio sin servidores de correo propios pero que existe", async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([] as any);
    vi.mocked(dns.resolve).mockResolvedValue(["190.0.0.1"] as any);

    await expect(assertDeliverableEmail("hola@consultoriosdeljardin.com.ar")).resolves.toBeTruthy();
  });

  it("si el DNS no contesta, el alta sigue", async () => {
    const caido = Object.assign(new Error("server fail"), { code: "SERVFAIL" });
    vi.mocked(dns.resolveMx).mockRejectedValue(caido);
    vi.mocked(dns.resolve).mockRejectedValue(caido);
    vi.mocked(dns.lookup).mockRejectedValue(caido);

    await expect(assertDeliverableEmail("paciente@gmail.com")).resolves.toBe("paciente@gmail.com");
  });

  it("un texto que no es un mail no llega a preguntar nada", async () => {
    await expect(assertDeliverableEmail("no tiene mail")).rejects.toThrow("formato válido");
    expect(dns.resolveMx).not.toHaveBeenCalled();
  });
});
