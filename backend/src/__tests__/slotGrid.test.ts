import { describe, it, expect } from "vitest";
import {
  DEFAULT_GRID_RULES,
  bookingHorizonEnd,
  hourOf,
  isOnGrid,
  minutesOf,
  slotStarts,
  withinBookingHorizon,
  type GridModule,
  type GridOffice,
} from "../appointments/slotGrid.js";
import { toISODate } from "../shared/dates.js";

// ============================================================
// La grilla de horarios.
//
// La primera parte es la que importa: con las reglas por omisión, la grilla nueva tiene
// que dar exactamente lo mismo que el código que reemplaza. El código viejo está copiado
// acá abajo tal cual estaba en el motor, y se comparan los dos sobre miles de módulos y
// horarios de consultorio distintos. Si alguien toca la grilla y cambia un horario que hoy
// se ofrece, se rompe esto y no la agenda de un consultorio.
// ============================================================

/** El bucle de `getAvailableAppointmentsForPatient`, sin la parte del reloj. */
function grillaVieja(module: GridModule, office: GridOffice): number[] {
  const out: number[] = [];
  let currentMinutes = module.start;

  while (currentMinutes + module.duration <= module.end) {
    if (currentMinutes < office.opens || currentMinutes + module.duration > office.closes) {
      currentMinutes += module.duration;
      continue;
    }
    out.push(currentMinutes);
    currentMinutes += module.duration;
  }

  return out;
}

/** `checkAppointmentDurationFormat`, que devolvía `true` cuando la hora estaba mal. */
function formatoViejoMal(initial: number, scheduleInitial: number, duration: number): boolean {
  const k = (initial - scheduleInitial) / duration;
  return !(k >= 0 && Number.isInteger(k));
}

/** Un generador con semilla, para que los casos sean siempre los mismos. */
function azar(semilla: number) {
  let s = semilla;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s % max;
  };
}

const DURACIONES = [15, 20, 30, 40, 45, 50, 60, 90];

describe("con las reglas de siempre, la grilla es la misma de antes", () => {
  it("en miles de módulos y horarios de consultorio", () => {
    const r = azar(20261003);

    for (let i = 0; i < 5000; i++) {
      const duration = DURACIONES[r(DURACIONES.length)];
      const start = 6 * 60 + r(12 * 12) * 5; // de 06:00 en adelante, de a cinco minutos
      const end = start + 30 + r(10 * 12) * 5;
      const opens = 6 * 60 + r(8 * 12) * 5;
      const closes = opens + 60 + r(14 * 12) * 5;

      const module = { start, end, duration };
      const office = { opens, closes };

      expect(slotStarts(module, office, DEFAULT_GRID_RULES)).toEqual(grillaVieja(module, office));
    }
  });

  it("y decide igual si una hora es el inicio de un turno", () => {
    const r = azar(7);

    for (let i = 0; i < 5000; i++) {
      const duration = DURACIONES[r(DURACIONES.length)];
      const start = 6 * 60 + r(12 * 12) * 5;
      const module = { start, end: start + 600, duration };
      const hora = r(24 * 60);

      expect(isOnGrid(hora, module, null, DEFAULT_GRID_RULES)).toBe(!formatoViejoMal(hora, start, duration));
    }
  });
});

describe("el reclamo de las 15:30", () => {
  const module = { start: minutesOf("14:00"), end: minutesOf("20:00"), duration: 45 };
  const office = { opens: minutesOf("15:00"), closes: minutesOf("21:00") };

  it("sin realinear, el primer horario es 15:30, como en producción", () => {
    const horas = slotStarts(module, office, DEFAULT_GRID_RULES).map(hourOf);
    expect(horas[0]).toBe("15:30");
  });

  it("realineando, el primero es 15:00", () => {
    const horas = slotStarts(module, office, { slotStepMinutes: null, realignToOpening: true }).map(hourOf);
    expect(horas).toEqual(["15:00", "15:45", "16:30", "17:15", "18:00", "18:45"]);
  });

  it("y la reserva acepta lo que la lista ofrece, y nada más", () => {
    const reglas = { slotStepMinutes: null, realignToOpening: true };

    expect(isOnGrid(minutesOf("15:00"), module, office, reglas)).toBe(true);
    expect(isOnGrid(minutesOf("15:45"), module, office, reglas)).toBe(true);
    // El de la grilla vieja ya no es un inicio: aceptarlo dejaría pedir 15:30 y 15:00 a la vez.
    expect(isOnGrid(minutesOf("15:30"), module, office, reglas)).toBe(false);
  });

  it("realinear no mueve nada si el módulo arranca con el consultorio abierto", () => {
    const tarde = { start: minutesOf("16:00"), end: minutesOf("20:00"), duration: 45 };
    const reglas = { slotStepMinutes: null, realignToOpening: true };

    expect(slotStarts(tarde, office, reglas)).toEqual(slotStarts(tarde, office, DEFAULT_GRID_RULES));
  });
});

describe("el paso separado de la duración", () => {
  it("turnos de 45 minutos cada media hora", () => {
    const module = { start: minutesOf("09:00"), end: minutesOf("11:00"), duration: 45 };
    const horas = slotStarts(module, null, { slotStepMinutes: 30, realignToOpening: false }).map(hourOf);

    // El último arranca 10:00 porque termina 10:45; el de las 10:30 terminaría 11:15.
    expect(horas).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("la reserva acepta los inicios del paso, no los de la duración", () => {
    const module = { start: minutesOf("09:00"), end: minutesOf("12:00"), duration: 45 };
    const reglas = { slotStepMinutes: 30, realignToOpening: false };

    expect(isOnGrid(minutesOf("09:30"), module, null, reglas)).toBe(true);
    expect(isOnGrid(minutesOf("09:45"), module, null, reglas)).toBe(false);
  });

  it("un paso imposible da una grilla vacía, no un bucle infinito", () => {
    const module = { start: 540, end: 600, duration: 0 };
    expect(slotStarts(module, null, DEFAULT_GRID_RULES)).toEqual([]);
  });
});

describe("el horizonte de reserva", () => {
  // Un jueves. La semana arranca el lunes 28 de septiembre.
  const jueves = new Date(2026, 9, 1, 15, 0);

  it("con una semana, termina el domingo de la que viene", () => {
    expect(toISODate(bookingHorizonEnd(jueves, 1))).toBe("2026-10-11");
  });

  it("con cero, termina el domingo de esta", () => {
    expect(toISODate(bookingHorizonEnd(jueves, 0))).toBe("2026-10-04");
  });

  it("es el mismo número que usaba la lista de espera: el lunes de esta semana más trece", () => {
    for (let dia = 0; dia < 14; dia++) {
      const ahora = new Date(2026, 8, 28 + dia, 10, 0);
      const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - ((ahora.getDay() + 6) % 7));
      const viejo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 13);

      expect(toISODate(bookingHorizonEnd(ahora, 1))).toBe(toISODate(viejo));
    }
  });

  it("dice si una fecha entra", () => {
    expect(withinBookingHorizon("2026-10-11", jueves, 1)).toBe(true);
    expect(withinBookingHorizon("2026-10-12", jueves, 1)).toBe(false);
  });
});

describe("las horas", () => {
  it("van y vuelven", () => {
    expect(hourOf(minutesOf("09:05"))).toBe("09:05");
    expect(hourOf(minutesOf("23:59"))).toBe("23:59");
  });

  it("un colchón antes de la medianoche no da una hora negativa", () => {
    expect(hourOf(-10)).toBe("00:00");
  });
});
