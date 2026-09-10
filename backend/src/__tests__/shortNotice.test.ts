import { describe, it, expect } from "vitest";

// La hora del consultorio, igual que en app.ts: la cuenta depende de la zona.
process.env.TZ = "America/Argentina/Buenos_Aires";

import { hoursOfNotice, noticeOf } from "../shared/shortNotice.js";

// ============================================================
// Cuánto aviso dio el paciente al dar de baja.
//
// La fecha del turno vuelve de la base como medianoche UTC, que en Argentina es las 21
// del día anterior. Leída así, un turno de mañana a las 17 parecía de hoy a las 17 y una
// baja con un día de aviso llegaba al profesional como "sobre la hora".
// ============================================================

/** Un turno del viernes 11 a las 17, como lo devuelve la base. */
const turno = { date: new Date("2026-09-11T00:00:00Z"), initialHour: "17:00:00" };

describe("hoursOfNotice", () => {
  it("cuenta desde el día del turno aunque la fecha venga como medianoche UTC", () => {
    const cancelledAt = new Date("2026-09-10T16:47:12Z"); // jueves 10, 13:47 en Argentina
    expect(hoursOfNotice(turno.date, turno.initialHour, cancelledAt)).toBeCloseTo(27.2, 1);
  });

  it("da lo mismo con la fecha escrita como texto", () => {
    const cancelledAt = new Date("2026-09-10T16:47:12Z");
    expect(hoursOfNotice("2026-09-11", turno.initialHour, cancelledAt)).toBeCloseTo(27.2, 1);
  });

  it("da negativo si la baja llegó con el turno empezado", () => {
    const cancelledAt = new Date("2026-09-11T20:30:00Z"); // viernes 11, 17:30
    expect(hoursOfNotice(turno.date, turno.initialHour, cancelledAt)).toBeCloseTo(-0.5, 1);
  });
});

describe("noticeOf", () => {
  it("no marca sobre la hora una baja con más de un día de aviso", () => {
    const aviso = noticeOf({ ...turno, patientCancelledAt: new Date("2026-09-10T16:47:12Z") });
    expect(aviso.short).toBe(false);
  });

  it("marca sobre la hora una baja el mismo día", () => {
    const aviso = noticeOf({ ...turno, patientCancelledAt: new Date("2026-09-11T15:00:00Z") }); // 12:00
    expect(aviso.short).toBe(true);
    expect(aviso.hours).toBeCloseTo(5, 1);
  });

  it("no hay nada que mirar si la baja no fue del paciente", () => {
    expect(noticeOf({ ...turno, patientCancelledAt: null })).toEqual({ hours: null, short: false });
  });
});
