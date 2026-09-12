import { describe, it, expect } from "vitest";

// La hora del consultorio, igual que en app.ts: la cuenta depende de la zona.
process.env.TZ = "America/Argentina/Buenos_Aires";

import { sameCalendarDay, startOfDay } from "../shared/dates.js";

// ============================================================
// Si un turno cambió de día.
//
// Al editar un turno, la ficha manda la fecha aunque no se haya tocado. La guardada vuelve
// de la base como medianoche UTC —las 21 del día anterior en Argentina— y la que llega se
// parsea como medianoche local. Comparadas con toDateString daban distinto, y cambiarle
// solo el valor al turno le mandaba al paciente el mail de turno reprogramado.
// ============================================================

/** El turno del sábado 12, como lo devuelve la base. */
const guardada = new Date("2026-09-12T00:00:00Z");

describe("sameCalendarDay", () => {
  it("toma como el mismo día la fecha de la base y la misma fecha recién parseada", () => {
    expect(sameCalendarDay(startOfDay("2026-09-12"), guardada)).toBe(true);
  });

  it("toma como el mismo día la fecha de la base y el texto AAAA-MM-DD", () => {
    expect(sameCalendarDay("2026-09-12", guardada)).toBe(true);
  });

  it("detecta que el turno pasó al día siguiente", () => {
    expect(sameCalendarDay(startOfDay("2026-09-13"), guardada)).toBe(false);
  });

  it("detecta que el turno pasó al día anterior, que es el que se confundía", () => {
    expect(sameCalendarDay(startOfDay("2026-09-11"), guardada)).toBe(false);
  });
});
