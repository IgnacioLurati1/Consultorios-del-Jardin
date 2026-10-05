import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_POLICIES } from "../shared/policies.js";

// ============================================================
// El motor de turnos, manejado de verdad.
//
// Hasta ahora ninguna prueba llamaba al motor: la de integración simulaba lo que hacía.
// Acá se llama a la lista de horarios y a la reserva con servicios de mentira, sobre una
// agenda chica y un reloj fijo, y se mira que las dos digan lo mismo con cada regla.
//
// El caso de fondo es el reclamo de los profesionales: un módulo de 14 a 20 con turnos de
// 45 minutos, en una sucursal que abre a las 15. Sin realinear, el primer horario es 15:30.
// ============================================================

const { reglas, licencias } = vi.hoisted(() => ({
  reglas: {} as Record<string, any>,
  licencias: new Set<string>(),
}));

/** Lo que el sistema hacía antes de que hubiera reglas. */
const DE_SIEMPRE = {
  name: "Consultorios del Jardín",
  bookingWeeksAhead: 1,
  slotStepMinutes: null,
  bufferMinutes: 0,
  realignToOpening: false,
  minNoticeMinutes: 0,
  shortNoticeHours: 24,
  opensSunday: false,
  reminderHoursBefore: null,
  chargesMissed: false,
  maxActiveAppointments: 0,
  waitlistEnabled: true,
  policies: DEFAULT_POLICIES,
};

vi.mock("../shared/db/orm.js", () => ({ orm: { em: { fork: () => ({}) } } }));

vi.mock("../installation/installation.service.js", async () => ({
  ...(await import("./helpers/installationDefaults.js")).installationServiceMock(),
  config: vi.fn(async () => reglas),
}));

vi.mock("../settings/settings.service.js", () => ({
  SettingsService: class {
    vacationDays = vi.fn(async () => licencias);
  },
}));

import { AppointmentEngine } from "../appointments/appointments.engine.js";
import { toISODate } from "../shared/dates.js";

const PROFESIONAL = { email: "pro@ejemplo.com", type: "professional", active: true, bookable: true, autoAccept: false };
const PACIENTE = { email: "paciente@ejemplo.com", type: "client", active: true };

/** Un turno que ya está en la agenda. */
interface Ocupado {
  date: string;
  initialHour: string;
  finalHour: string;
  quien: string;
}

/** Arma el motor con una sucursal, un módulo de los lunes y la agenda que se le pase. */
function motor({
  abre = "15:00",
  cierra = "21:00",
  agenda = [] as Ocupado[],
  activos = 0,
}: { abre?: string; cierra?: string; agenda?: Ocupado[]; activos?: number } = {}) {
  const sucursal = { idOffice: 1, active: true, openingTime: abre, closingTime: cierra };
  const modulo = {
    day: "lunes",
    initialHour: "14:00",
    finalHour: "20:00",
    duration: 45,
    room: { idRoom: 1, active: true, description: "Consultorio 1", office: sucursal },
  };

  const choca = (date: Date, ini: string, fin: string, quien: string) =>
    agenda.find((t) => t.quien === quien && t.date === toISODate(date) && t.initialHour < fin && t.finalHour > ini) ?? null;

  const people: any = {
    findPersonByEmail: vi.fn(async (email: string) => (email === PROFESIONAL.email ? PROFESIONAL : PACIENTE)),
  };
  const schedule: any = {
    findSchedulesByProfessionalAndOffice: vi.fn(async () => [modulo]),
    findScheduleByHourRange: vi.fn(async (_hora: string, dia: string) => {
      if (dia !== "lunes") throw new Error("No atiende ese día");
      return modulo;
    }),
    findScheduleForSlot: vi.fn(async (_email: string, dia: string) => (dia === "lunes" ? modulo : null)),
  };
  const office: any = { findOficeById: vi.fn(async () => sucursal) };
  const room: any = { findRoomById: vi.fn(async () => modulo.room) };
  const appointments: any = {
    checkPatientAppointmentOverlap: vi.fn(async (ini: string, fin: string, _e: string, date: Date) =>
      choca(date, ini, fin, "paciente")
    ),
    checkProfessionalAppointmentOverlap: vi.fn(async (ini: string, fin: string, _e: string, date: Date) =>
      choca(date, ini, fin, "profesional")
    ),
  };
  const em: any = { create: vi.fn((_e: any, data: any) => data), count: vi.fn(async () => activos) };

  return new AppointmentEngine(people, schedule, office, room, appointments, em);
}

/** Los horarios de un día, como "HH:MM". */
async function horariosDel(engine: AppointmentEngine, iso: string): Promise<string[]> {
  const todos = await engine.getAvailableAppointmentsForPatient(PACIENTE.email, PROFESIONAL.email, 1);
  return todos.filter((s) => toISODate(s.date) === iso).map((s) => s.initialHour);
}

function reservar(engine: AppointmentEngine, iso: string, hora: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return engine.validateAndCreateAppointment(PACIENTE.email, new Date(y, m - 1, d), hora, PROFESIONAL.email, 1);
}

// Lunes 5 de octubre de 2026, ocho de la mañana. La semana que viene termina el domingo 18.
const LUNES = "2026-10-05";
const OTRO_LUNES = "2026-10-12";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 5, 8, 0));
  Object.assign(reglas, DE_SIEMPRE);
  licencias.clear();
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of Object.keys(reglas)) delete reglas[key];
});

describe("con las reglas de siempre", () => {
  it("el primer horario es 15:30, como reclamaron", async () => {
    expect(await horariosDel(motor(), LUNES)).toEqual(["15:30", "16:15", "17:00", "17:45", "18:30", "19:15"]);
  });

  it("muestra esta semana y la que viene, y nada más", async () => {
    const todos = await motor().getAvailableAppointmentsForPatient(PACIENTE.email, PROFESIONAL.email, 1);
    const dias = [...new Set(todos.map((s) => toISODate(s.date)))];

    expect(dias).toEqual([LUNES, OTRO_LUNES]);
  });

  it("la reserva acepta 15:30 y rechaza 15:00", async () => {
    await expect(reservar(motor(), LUNES, "15:30")).resolves.toMatchObject({ initialHour: "15:30", finalHour: "16:15" });
    await expect(reservar(motor(), LUNES, "15:00")).rejects.toThrow("no cae en el inicio de ninguno");
  });
});

describe("realineando a la apertura", () => {
  beforeEach(() => {
    reglas.realignToOpening = true;
  });

  it("el primero es 15:00", async () => {
    expect(await horariosDel(motor(), LUNES)).toEqual(["15:00", "15:45", "16:30", "17:15", "18:00", "18:45"]);
  });

  it("y la reserva acepta exactamente lo que la lista ofrece", async () => {
    const engine = motor();
    const ofrecidos = await horariosDel(engine, LUNES);

    for (const hora of ofrecidos) await expect(reservar(engine, LUNES, hora)).resolves.toBeTruthy();
    await expect(reservar(engine, LUNES, "15:30")).rejects.toThrow("no cae en el inicio de ninguno");
  });
});

describe("el horizonte", () => {
  it("la reserva no acepta lo que la lista no muestra", async () => {
    await expect(reservar(motor(), "2026-10-19", "15:30")).rejects.toThrow("Todavía no se pueden pedir turnos");
  });

  it("con más semanas, la lista y la reserva llegan más lejos juntas", async () => {
    reglas.bookingWeeksAhead = 2;

    expect(await horariosDel(motor(), "2026-10-19")).toContain("15:30");
    await expect(reservar(motor(), "2026-10-19", "15:30")).resolves.toBeTruthy();
  });
});

describe("el colchón entre turnos", () => {
  // El profesional ya tiene un turno de 16:15 a 17:00.
  const agenda = [{ date: LUNES, initialHour: "16:15", finalHour: "17:00", quien: "profesional" }];

  it("sin colchón, los turnos de al lado se ofrecen, como siempre", async () => {
    const horas = await horariosDel(motor({ agenda }), LUNES);

    expect(horas).toContain("15:30");
    expect(horas).not.toContain("16:15");
    expect(horas).toContain("17:00");
  });

  it("con diez minutos, los de al lado ya no", async () => {
    reglas.bufferMinutes = 10;
    const horas = await horariosDel(motor({ agenda }), LUNES);

    expect(horas).not.toContain("15:30");
    expect(horas).not.toContain("17:00");
    expect(horas).toContain("17:45");
  });

  it("y la reserva tampoco los acepta", async () => {
    reglas.bufferMinutes = 10;
    await expect(reservar(motor({ agenda }), LUNES, "17:00")).rejects.toThrow("ocupado");
  });
});

describe("el aviso mínimo", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 9, 5, 15, 40)); // lunes, 15:40
  });

  it("sin aviso, se ofrece lo que todavía no empezó", async () => {
    expect((await horariosDel(motor(), LUNES))[0]).toBe("16:15");
  });

  it("con una hora, lo que empieza antes de las 16:40 no", async () => {
    reglas.minNoticeMinutes = 60;
    expect((await horariosDel(motor(), LUNES))[0]).toBe("17:00");
  });

  it("y la reserva lo controla también", async () => {
    reglas.minNoticeMinutes = 60;
    await expect(reservar(motor(), LUNES, "16:15")).rejects.toThrow("anticipación");
    await expect(reservar(motor(), LUNES, "17:00")).resolves.toBeTruthy();
  });
});

describe("el tope de turnos por paciente", () => {
  it("sin tope, no cuenta nada", async () => {
    await expect(reservar(motor({ activos: 99 }), LUNES, "15:30")).resolves.toBeTruthy();
  });

  it("con tope, el que ya tiene esa cantidad no puede pedir otro", async () => {
    reglas.maxActiveAppointments = 2;

    await expect(reservar(motor({ activos: 2 }), LUNES, "15:30")).rejects.toThrow("como máximo");
    await expect(reservar(motor({ activos: 1 }), LUNES, "15:30")).resolves.toBeTruthy();
  });
});

describe("el paso de la grilla", () => {
  it("turnos de 45 minutos cada media hora", async () => {
    reglas.slotStepMinutes = 30;
    reglas.realignToOpening = true;

    const horas = await horariosDel(motor(), LUNES);
    expect(horas.slice(0, 4)).toEqual(["15:00", "15:30", "16:00", "16:30"]);
    await expect(reservar(motor(), LUNES, "15:30")).resolves.toMatchObject({ finalHour: "16:15" });
  });
});

describe("el alta del profesional usa la misma grilla", () => {
  function cargar(engine: AppointmentEngine, hora: string, fin: string) {
    return engine.validateAndCreateProfessionalAppointment(new Date(2026, 9, 5), hora, fin, 1, 0, PROFESIONAL.email);
  }

  it("con las reglas de siempre, desde el inicio del módulo", async () => {
    await expect(cargar(motor(), "14:00", "14:45")).resolves.toBeTruthy();
  });

  it("realineando, desde la apertura, igual que el paciente", async () => {
    reglas.realignToOpening = true;

    await expect(cargar(motor(), "15:00", "15:45")).resolves.toBeTruthy();
    await expect(cargar(motor(), "14:00", "14:45")).rejects.toThrow("arranca a las 15:00");
  });

  it("el sobreturno se saltea el colchón, que es para lo que existe", async () => {
    reglas.bufferMinutes = 10;
    const agenda = [{ date: LUNES, initialHour: "16:15", finalHour: "17:00", quien: "profesional" }];

    await expect(cargar(motor({ agenda }), "17:00", "17:45")).rejects.toThrow("a menos de 10 minutos");
    await expect(
      motor({ agenda }).validateAndCreateProfessionalAppointment(
        new Date(2026, 9, 5),
        "17:00",
        "17:45",
        1,
        0,
        PROFESIONAL.email,
        undefined,
        true
      )
    ).resolves.toBeTruthy();
  });
});
