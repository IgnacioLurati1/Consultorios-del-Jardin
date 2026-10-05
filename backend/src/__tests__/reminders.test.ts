import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// A quién se le recuerda el turno, y qué cuenta como deuda.
//
// El recordatorio era siempre el de la víspera. Ahora puede ser N horas antes, y la víspera
// sigue siendo el valor por omisión: con la configuración de siempre, la consulta a la base
// tiene que ser exactamente la de antes.
// ============================================================

const { reglas, filas, consultas } = vi.hoisted(() => ({
  reglas: {} as Record<string, any>,
  filas: [] as any[],
  consultas: [] as any[],
}));

vi.mock("../shared/db/orm.js", () => {
  const em: any = {
    find: vi.fn(async (_entidad: any, where: any) => {
      consultas.push(where);
      return filas;
    }),
    fork: () => em,
  };
  return { orm: { em }, syncSchema: vi.fn() };
});

vi.mock("../installation/installation.service.js", async () => {
  const { DEFAULT_CONFIG, installationServiceMock } = await import("./helpers/installationDefaults.js");
  return { ...installationServiceMock(), config: vi.fn(async () => ({ ...DEFAULT_CONFIG, ...reglas })) };
});

vi.mock("../config/mailer.js", () => ({
  default: class {
    createMessage = vi.fn();
    sendMail = vi.fn();
  },
}));

import { AppointmentService, debtFilter } from "../appointments/appointments.service.js";
import { toISODate } from "../shared/dates.js";

/** Un turno aceptado, el día y la hora que se digan. */
function turno(fecha: string, hora: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  return { numAppointment: 1, date: new Date(y, m - 1, d), initialHour: hora, state: "accepted", reminderSent: "not sent" };
}

// Lunes 5 de octubre de 2026, a las diez de la mañana.
const AHORA = new Date(2026, 9, 5, 10, 0);

beforeEach(() => {
  for (const key of Object.keys(reglas)) delete reglas[key];
  filas.length = 0;
  consultas.length = 0;
});

describe("el recordatorio de la víspera, que es el de siempre", () => {
  it("le pregunta a la base por los turnos de mañana, y nada más", async () => {
    await new AppointmentService().getAppointmentsForReminder(AHORA);

    const where = consultas[0];
    expect(toISODate(where.date.$gte)).toBe("2026-10-06");
    expect(toISODate(where.date.$lte)).toBe("2026-10-06");
    expect(where.state).toBe("accepted");
    expect(where.reminderSent).toBe("not sent");
  });
});

describe("el recordatorio N horas antes", () => {
  beforeEach(() => {
    reglas.reminderHoursBefore = 3;
  });

  it("toma los que arrancan dentro de esas horas", async () => {
    filas.push(turno("2026-10-05", "12:00"), turno("2026-10-05", "13:00"), turno("2026-10-05", "13:30"));

    const elegidos = await new AppointmentService().getAppointmentsForReminder(AHORA);

    expect(elegidos.map((t: any) => t.initialHour)).toEqual(["12:00", "13:00"]);
  });

  it("no le recuerda a uno que ya empezó", async () => {
    filas.push(turno("2026-10-05", "09:30"), turno("2026-10-05", "10:00"));

    expect(await new AppointmentService().getAppointmentsForReminder(AHORA)).toEqual([]);
  });

  it("cruza la medianoche", async () => {
    reglas.reminderHoursBefore = 20;
    filas.push(turno("2026-10-06", "05:00"), turno("2026-10-06", "07:00"));

    const elegidos = await new AppointmentService().getAppointmentsForReminder(AHORA);

    // Hasta las 06:00 del martes.
    expect(elegidos.map((t: any) => t.initialHour)).toEqual(["05:00"]);
    expect(toISODate(consultas[0].date.$lte)).toBe("2026-10-06");
  });
});

describe("qué cuenta como deuda", () => {
  it("por omisión, solo lo que se atendió", () => {
    expect(debtFilter(false).state).toBe("assisted");
  });

  it("si el consultorio cobra las ausencias, también lo que se faltó", () => {
    expect(debtFilter(true).state).toEqual({ $in: ["assisted", "missed"] });
  });

  it("en los dos casos, solo lo que no está saldado", () => {
    for (const cobra of [false, true]) {
      expect(debtFilter(cobra).paymentState).toEqual({ $in: ["unpaid", "partial"] });
    }
  });
});
