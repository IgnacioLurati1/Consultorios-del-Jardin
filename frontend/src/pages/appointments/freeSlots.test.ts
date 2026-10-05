import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildDaySlots, freeDaySlots } from "./freeSlots.ts";
import { resetInstallationForTests } from "../../lib/installation.ts";
import type { Appointment, Schedule } from "../types.ts";

/**
 * La grilla del lado de la pantalla.
 *
 * Son los mismos casos que `slotGrid.test.ts` del servidor, con los mismos números. La
 * cuenta está escrita dos veces —una corre en el navegador y la otra en el servidor— y si
 * alguna vez dejan de dar lo mismo, el profesional ve un horario que después el alta le
 * rechaza. Si cambia un caso acá, tiene que cambiar allá.
 */

/** Un módulo de los lunes de 14 a 20, turnos de 45, en una sucursal que abre a las 15. */
const MODULO = {
  day: "lunes",
  initialHour: "14:00:00",
  finalHour: "20:00:00",
  duration: 45,
  active: true,
  room: { idRoom: "1", description: "Consultorio 1", active: true, office: { openingTime: "15:00:00", closingTime: "21:00:00" } },
} as unknown as Schedule;

// Un lunes que todavía no llegó, así el reloj no recorta nada.
const LUNES = "2026-10-05";

const horas = (slots: { initialHour: string }[]) => slots.map((slot) => slot.initialHour);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 1, 9, 0));
  resetInstallationForTests();
});

afterEach(() => {
  vi.useRealTimers();
  resetInstallationForTests();
});

describe("con las reglas de siempre", () => {
  it("arranca en el módulo y avanza de a una duración, como antes", () => {
    expect(horas(buildDaySlots([MODULO], LUNES))).toEqual([
      "14:00",
      "14:45",
      "15:30",
      "16:15",
      "17:00",
      "17:45",
      "18:30",
      "19:15",
    ]);
  });
});

describe("realineando a la apertura", () => {
  it("el primero es 15:00, igual que en el servidor", () => {
    resetInstallationForTests({ rules: { realignToOpening: true } });

    expect(horas(buildDaySlots([MODULO], LUNES))).toEqual(["15:00", "15:45", "16:30", "17:15", "18:00", "18:45"]);
  });
});

describe("el paso separado de la duración", () => {
  it("turnos de 45 minutos cada media hora", () => {
    const corto = { ...MODULO, initialHour: "09:00", finalHour: "11:00" } as Schedule;
    const slots = buildDaySlots([corto], LUNES, {
      rules: { slotStepMinutes: 30, realignToOpening: false, bufferMinutes: 0 },
    });

    expect(horas(slots)).toEqual(["09:00", "09:30", "10:00"]);
    expect(slots.map((slot) => slot.finalHour)).toEqual(["09:45", "10:15", "10:45"]);
  });
});

describe("el colchón entre turnos", () => {
  const turno = { date: LUNES, initialHour: "16:15", finalHour: "17:00", state: "accepted" } as unknown as Appointment;

  it("sin colchón, los huecos de al lado quedan libres", () => {
    const libres = horas(freeDaySlots([MODULO], LUNES, [turno]));

    expect(libres).toContain("15:30");
    expect(libres).not.toContain("16:15");
    expect(libres).toContain("17:00");
  });

  it("con diez minutos, los de al lado ya no, como en el alta del servidor", () => {
    const libres = horas(
      freeDaySlots([MODULO], LUNES, [turno], { slotStepMinutes: null, realignToOpening: false, bufferMinutes: 10 })
    );

    expect(libres).not.toContain("15:30");
    expect(libres).not.toContain("17:00");
    expect(libres).toContain("17:45");
  });
});
