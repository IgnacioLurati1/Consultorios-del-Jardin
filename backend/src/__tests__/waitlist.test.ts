import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// La lista de espera y los links del recordatorio.
//
// La base es un objeto en memoria: cada consulta mira de qué entidad se trata y contesta
// con lo que haya cargado el test. Así no importa en qué orden pregunte el servicio, que
// es un detalle suyo, y el test se lee como lo que prueba.
// ============================================================

const { mockEm } = vi.hoisted(() => ({
  mockEm: {
    find: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    flush: vi.fn(),
    remove: vi.fn(),
    nativeDelete: vi.fn(),
    fork: vi.fn(),
  },
}));

mockEm.fork.mockReturnValue(mockEm);

vi.mock("../shared/db/orm.js", () => ({
  orm: { em: mockEm },
  syncSchema: vi.fn(),
}));

const { enviados } = vi.hoisted(() => ({ enviados: [] as Array<{ to: string; subject: string; html: string }> }));

vi.mock("../config/mailer.js", () => ({
  default: class MailServiceMock {
    createMessage = vi.fn(async (to: string, subject: string, html: string) => ({ to, subject, html }));
    sendMail = vi.fn(async (msg: any) => {
      enviados.push(msg);
      return true;
    });
  },
}));

process.env.JWT_SECRET = "test-secret-key-for-waitlist-tests";

import { WaitlistService } from "../waitlist/waitlist.service.js";
import { WaitlistEntry } from "../waitlist/waitlist.entity.js";
import { WaitlistUsage } from "../waitlist/waitlistUsage.entity.js";
import { Person } from "../people/people.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { Vacation } from "../settings/vacation.entity.js";
import {
  WAITLIST_LIMITS,
  describeDays,
  fits,
  freedInTime,
  parseDays,
  parseWaitlistRequest,
} from "../waitlist/waitlist.rules.js";
import { readAttendance, signAttendance } from "../attendance/attendance.token.js";

// ------------------------------------------------------------
// Datos
// ------------------------------------------------------------

/** Miércoles 9 de septiembre de 2026, al mediodía. */
const HOY = new Date(2026, 8, 9, 12, 0, 0);

function profesional(extra: Record<string, unknown> = {}) {
  return {
    email: "ana@test.com",
    name: "Ana",
    surname: "Ríos",
    type: "professional",
    active: true,
    bookable: true,
    waitlistEnabled: true,
    ...extra,
  };
}

function paciente(email: string, extra: Record<string, unknown> = {}) {
  return { email, name: "Paciente", surname: email.split("@")[0], type: "client", active: true, phoneNumber: "3411234567", ...extra };
}

const admin = { email: "admin@test.com", name: "Admin", surname: "Uno", type: "admin", active: true };

/** Un lugar en la lista: martes, de 10 a 14. */
function lugar(id: number, patient: any, extra: Record<string, unknown> = {}) {
  return {
    id,
    patient,
    professional: db.people.find((p: any) => p.type === "professional"),
    days: "2",
    fromHour: "10:00",
    toHour: "14:00",
    createdAt: new Date(2026, 8, 1),
    expiresAt: new Date(2026, 8, 20),
    noticesSent: 0,
    notices: [],
    ...extra,
  };
}

/** El turno que se libera: martes 15, de 11 a 12, que el paciente sacó y ahora baja. */
function turnoLiberado(extra: Record<string, unknown> = {}) {
  return {
    numAppointment: 700,
    date: new Date(2026, 8, 15),
    initialHour: "11:00:00",
    finalHour: "12:00:00",
    state: "accepted",
    overbooked: false,
    professional: db.people.find((p: any) => p.type === "professional"),
    patient: { email: "quien-cancela@test.com" },
    ...extra,
  } as any;
}

let db: {
  people: any[];
  entries: any[];
  usage: any | null;
  schedules: any[];
  vacations: any[];
  /** Si alguna consulta de superposición de turnos encuentra algo. */
  ocupado: boolean;
};

function porEmail(item: any, where: any): boolean {
  if (where?.patient?.email && item.patient.email !== where.patient.email) return false;
  if (where?.professional?.email && item.professional.email !== where.professional.email) return false;
  return true;
}

function conectarBase() {
  mockEm.find.mockImplementation(async (entity: any, where: any) => {
    if (entity === WaitlistEntry) return db.entries.filter((entry) => porEmail(entry, where));
    if (entity === Schedule) return db.schedules;
    if (entity === Vacation) return db.vacations;
    if (entity === Person) {
      if (where?.type) return db.people.filter((p) => p.type === where.type && (where.active === undefined || p.active === where.active));
      if (where?.email?.$in) return db.people.filter((p) => where.email.$in.includes(p.email));
    }
    return [];
  });

  mockEm.findOne.mockImplementation(async (entity: any, where: any) => {
    if (entity === Person) return db.people.find((p) => p.email === where.email) ?? null;
    if (entity === WaitlistUsage) return db.usage;
    if (entity === WaitlistEntry) return db.entries.find((entry) => porEmail(entry, where)) ?? null;
    if (entity === Appointment) return db.ocupado ? { numAppointment: 1 } : null;
    return null;
  });

  mockEm.count.mockImplementation(async (entity: any, where: any) =>
    entity === WaitlistEntry ? db.entries.filter((entry) => porEmail(entry, where)).length : 0
  );

  mockEm.create.mockImplementation((_entity: any, data: any) => ({ id: 99, ...data }));
  mockEm.nativeDelete.mockResolvedValue(0);
  mockEm.flush.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEm.fork.mockReturnValue(mockEm);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOY);
  enviados.length = 0;

  db = {
    people: [profesional(), paciente("p1@test.com"), paciente("p2@test.com"), admin],
    entries: [],
    usage: null,
    schedules: [{ day: "martes", initialHour: "09:00", finalHour: "13:00" }],
    vacations: [],
    ocupado: false,
  };

  conectarBase();
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------
// Las reglas, solas
// ------------------------------------------------------------

describe("Lista de espera: lo que se puede pedir", () => {
  it("acepta hasta tres días y una franja de hasta ocho horas", () => {
    expect(parseWaitlistRequest({ days: [3, 1, 1], fromHour: "09:00", toHour: "17:00" })).toEqual({
      days: [1, 3],
      fromHour: "09:00",
      toHour: "17:00",
    });
  });

  it("rechaza cuatro días, una franja de nueve horas, el domingo y horas mal escritas", () => {
    expect(() => parseWaitlistRequest({ days: [1, 2, 3, 4], fromHour: "09:00", toHour: "12:00" })).toThrow("hasta 3 días");
    expect(() => parseWaitlistRequest({ days: [1], fromHour: "08:00", toHour: "17:00" })).toThrow("hasta 8 horas");
    expect(() => parseWaitlistRequest({ days: [0], fromHour: "09:00", toHour: "12:00" })).toThrow("de lunes a sábado");
    expect(() => parseWaitlistRequest({ days: [1], fromHour: "9", toHour: "12:00" })).toThrow("HH:MM");
    expect(() => parseWaitlistRequest({ days: [1], fromHour: "12:00", toHour: "12:00" })).toThrow("posterior");
    expect(() => parseWaitlistRequest({ days: [], fromHour: "09:00", toHour: "12:00" })).toThrow("al menos un día");
  });

  it("un turno sirve si cae en el día y entero adentro de la franja", () => {
    const pedido = { days: "2", fromHour: "10:00", toHour: "14:00" };

    expect(fits(pedido, { date: new Date(2026, 8, 15), initialHour: "11:00:00", finalHour: "12:00:00" })).toBe(true);
    // Termina después de lo que pidió.
    expect(fits(pedido, { date: new Date(2026, 8, 15), initialHour: "13:30", finalHour: "14:30" })).toBe(false);
    // Es miércoles.
    expect(fits(pedido, { date: new Date(2026, 8, 16), initialHour: "11:00", finalHour: "12:00" })).toBe(false);
  });

  it("lee la fecha de la base como día de calendario y no como medianoche UTC", () => {
    // Una columna DATE vuelve así. En Buenos Aires eso es el lunes a la noche, y el
    // turno es del martes.
    const deLaBase = new Date(Date.UTC(2026, 8, 15));
    expect(fits({ days: "2", fromHour: "10:00", toHour: "14:00" }, { date: deLaBase, initialHour: "11:00", finalHour: "12:00" })).toBe(true);
  });

  it("avisar sirve con más de un día de anticipación, no con menos", () => {
    expect(freedInTime({ date: new Date(2026, 8, 10), initialHour: "13:00" })).toBe(true);
    expect(freedInTime({ date: new Date(2026, 8, 10), initialHour: "11:00" })).toBe(false);
  });

  it("nombra los días como se dicen y no inventa días de una lista vacía", () => {
    expect(describeDays([5, 1, 3])).toBe("lunes, miércoles y viernes");
    expect(describeDays([2])).toBe("martes");
    expect(parseDays("")).toEqual([]);
    expect(parseDays("1,3")).toEqual([1, 3]);
  });
});

// ------------------------------------------------------------
// Los links del mail del día anterior
// ------------------------------------------------------------

describe("Links de asistencia", () => {
  it("un link firmado dice de qué turno es", () => {
    const token = signAttendance(812, new Date(2026, 8, 10, 11, 0));
    expect(readAttendance(token)).toEqual({ numAppointment: 812, expired: false });
  });

  it("cambiarle el número al link lo invalida", () => {
    const [, exp, firma] = signAttendance(812, new Date(2026, 8, 10, 11, 0)).split(".");
    expect(readAttendance(`813.${exp}.${firma}`)).toBeNull();
    expect(readAttendance("cualquier-cosa")).toBeNull();
  });

  it("después de la hora del turno el link queda vencido", () => {
    const token = signAttendance(812, new Date(2026, 8, 9, 11, 0));
    expect(readAttendance(token)).toEqual({ numAppointment: 812, expired: true });
  });
});

// ------------------------------------------------------------
// Anotarse
// ------------------------------------------------------------

describe("Lista de espera: anotarse", () => {
  const pedido = { days: [2], fromHour: "10:00", toHour: "14:00" };

  it("se anota por dos semanas y cuenta una vez en el mes", async () => {
    const vista = await new WaitlistService().subscribe({ email: "p1@test.com", type: "client" }, "ana@test.com", pedido);

    expect(vista.days).toEqual([2]);
    expect(vista.expiresAt).toEqual(new Date(2026, 8, 23, 12, 0, 0));

    const uso = mockEm.create.mock.calls.find(([entity]) => entity === WaitlistUsage)?.[1];
    expect(uso).toBeDefined();
    expect(mockEm.flush).toHaveBeenCalled();
  });

  it("la tercera lista a la vez se rechaza y la cuenta sigue abierta", async () => {
    const p1 = db.people.find((p) => p.email === "p1@test.com");
    db.entries = [
      { ...lugar(1, p1), professional: { email: "otro1@test.com" } },
      { ...lugar(2, p1), professional: { email: "otro2@test.com" } },
    ];
    db.usage = { created: 2 };

    await expect(
      new WaitlistService().subscribe({ email: "p1@test.com", type: "client" }, "ana@test.com", pedido)
    ).rejects.toMatchObject({ status: 409 });

    expect(p1.active).toBe(true);
    expect(enviados).toHaveLength(0);
  });

  it("la sexta del mes cierra la cuenta, borra sus lugares y les avisa a los administradores", async () => {
    const p1 = db.people.find((p) => p.email === "p1@test.com");
    db.usage = { created: WAITLIST_LIMITS.maxPerMonth };

    await expect(
      new WaitlistService().subscribe({ email: "p1@test.com", type: "client" }, "ana@test.com", pedido)
    ).rejects.toMatchObject({ status: 403, code: "USER_DISABLED" });

    expect(p1.active).toBe(false);
    expect(p1.bannedBy).toBe("system");
    expect(p1.banKind).toBe("abuse");
    expect(mockEm.nativeDelete).toHaveBeenCalledWith(WaitlistEntry, { patient: { email: "p1@test.com" } });
    expect(enviados.map((mail) => mail.to)).toContain("admin@test.com");
  });

  it("a un profesional que se atiende no se le cierra la cuenta por el tope del mes", async () => {
    const colega = profesional({ email: "colega@test.com", name: "Luis" });
    db.people.push(colega);
    db.usage = { created: WAITLIST_LIMITS.maxPerMonth };

    await expect(
      new WaitlistService().subscribe({ email: "colega@test.com", type: "professional" }, "ana@test.com", pedido)
    ).rejects.toMatchObject({ status: 409 });

    expect(colega.active).toBe(true);
  });

  it("con la lista del profesional llena no se entra", async () => {
    db.entries = Array.from({ length: WAITLIST_LIMITS.maxPerProfessional }, (_, i) => lugar(i + 1, paciente(`x${i}@test.com`)));

    await expect(
      new WaitlistService().subscribe({ email: "p1@test.com", type: "client" }, "ana@test.com", pedido)
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("completa") });
  });

  it("si el profesional no trabaja con lista de espera, lo dice", async () => {
    db.people[0].waitlistEnabled = false;

    await expect(
      new WaitlistService().subscribe({ email: "p1@test.com", type: "client" }, "ana@test.com", pedido)
    ).rejects.toMatchObject({ status: 409, code: "WAITLIST_DISABLED" });
  });
});

// ------------------------------------------------------------
// Avisar cuando se libera un horario
// ------------------------------------------------------------

describe("Lista de espera: el aviso de horario liberado", () => {
  beforeEach(() => {
    db.entries = [lugar(1, db.people.find((p) => p.email === "p1@test.com"))];
  });

  it("si lo baja el paciente con tiempo, les avisa a los que esperan ese horario", async () => {
    const avisados = await new WaitlistService().onSlotFreed(turnoLiberado(), "patient");

    expect(avisados).toBe(1);
    expect(enviados.map((mail) => mail.to)).toEqual(["p1@test.com"]);
    expect(enviados[0].html).toContain("Appointment?profesional=ana%40test.com");
    expect(db.entries[0].noticesSent).toBe(1);
    expect(db.entries[0].notices).toEqual([expect.objectContaining({ date: "2026-09-15", initialHour: "11:00" })]);
  });

  it("con menos de un día de anticipación no avisa", async () => {
    const mañana = turnoLiberado({ date: new Date(2026, 8, 10), initialHour: "11:00:00", finalHour: "12:00:00" });
    db.entries[0].days = "4";

    expect(await new WaitlistService().onSlotFreed(mañana, "patient")).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it("si lo baja el profesional, avisa solo si él lo pide", async () => {
    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "professional")).toBe(0);
    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "professional", true)).toBe(1);
  });

  it("no ofrece un horario que ya no cae en un módulo, ni uno de licencia, ni uno que ya tomó otro", async () => {
    db.schedules = [{ day: "martes", initialHour: "14:00", finalHour: "18:00" }];
    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "patient")).toBe(0);

    db.schedules = [{ day: "martes", initialHour: "09:00", finalHour: "13:00" }];
    db.vacations = [{ fromDate: new Date(Date.UTC(2026, 8, 14)), toDate: new Date(Date.UTC(2026, 8, 18)) }];
    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "patient")).toBe(0);

    db.vacations = [];
    db.ocupado = true;
    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "patient")).toBe(0);

    expect(enviados).toHaveLength(0);
  });

  it("no le avisa a quien acaba de darlo de baja ni a quien pidió otra franja", async () => {
    const p2 = db.people.find((p) => p.email === "p2@test.com");
    db.entries = [lugar(1, { email: "quien-cancela@test.com", active: true }), lugar(2, p2, { fromHour: "15:00", toHour: "19:00" })];

    expect(await new WaitlistService().onSlotFreed(turnoLiberado(), "patient")).toBe(0);
  });

  it("al tercer aviso sale de la lista, y el mail se lo dice", async () => {
    db.entries[0].noticesSent = WAITLIST_LIMITS.maxNotices - 1;

    await new WaitlistService().onSlotFreed(turnoLiberado(), "patient");

    expect(mockEm.remove).toHaveBeenCalledWith(db.entries[0]);
    expect(enviados[0].html).toContain("saliste de la lista de espera");
  });

  it("el profesional puede preguntar cuántos recibirían el aviso antes de cancelar", async () => {
    mockEm.findOne.mockImplementationOnce(async () => turnoLiberado());

    expect(await new WaitlistService().matchesFor(700, "ana@test.com")).toEqual({ count: 1 });
  });

});

// ------------------------------------------------------------
// Sacar turno con el profesional que se esperaba
// ------------------------------------------------------------

describe("Lista de espera: sacar turno con el profesional", () => {
  beforeEach(() => {
    db.entries = [lugar(1, db.people.find((p) => p.email === "p1@test.com"))];
  });

  it("sale de la lista y le mandamos un mail que explica por qué", async () => {
    await new WaitlistService().onBooked("p1@test.com", turnoLiberado({ state: "accepted" }));

    expect(mockEm.remove).toHaveBeenCalledWith(db.entries[0]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ to: "p1@test.com", subject: "Saliste de la lista de espera" });
    expect(enviados[0].html).toContain("Sacaste un turno con");
    expect(enviados[0].html).toContain("Ana Ríos");
  });

  it("también si el turno cae fuera de la franja que había pedido", async () => {
    // Pidió martes de 10 a 14 y sacó un jueves a las 16.
    const jueves = turnoLiberado({ date: new Date(2026, 8, 17), initialHour: "16:00:00", finalHour: "17:00:00" });
    await new WaitlistService().onBooked("p1@test.com", jueves);

    expect(mockEm.remove).toHaveBeenCalledWith(db.entries[0]);
    expect(enviados).toHaveLength(1);
  });

  it("si el turno quedó pendiente, el mail habla de un pedido y no de un turno hecho", async () => {
    await new WaitlistService().onBooked("p1@test.com", turnoLiberado({ state: "pending" }));

    expect(enviados[0].html).toContain("Pediste un turno con");
    expect(enviados[0].html).toContain("no confirma");
  });

  it("un turno con otro profesional no lo saca de esta lista", async () => {
    const conOtro = turnoLiberado({ professional: { email: "otro@test.com", name: "Otro", surname: "Profe" } });
    await new WaitlistService().onBooked("p1@test.com", conOtro);

    expect(mockEm.remove).not.toHaveBeenCalled();
    expect(enviados).toHaveLength(0);
  });

  it("si su lugar ya estaba vencido, se borra sin avisarle nada", async () => {
    db.entries[0].expiresAt = new Date(2026, 8, 1);
    await new WaitlistService().onBooked("p1@test.com", turnoLiberado());

    expect(mockEm.remove).toHaveBeenCalledWith(db.entries[0]);
    expect(enviados).toHaveLength(0);
  });
});
