import { addDays, startOfDay, startOfWeek } from "../shared/dates.js";

/**
 * La grilla de horarios de un módulo, en un solo lugar.
 *
 * Antes la duración del módulo hacía tres cosas a la vez: era lo que dura un turno, el paso
 * con el que se recorre la grilla y la regla con la que se decide si una hora es el inicio
 * de un turno. Las tres vivían escritas por separado —en la lista de horarios, en la
 * reserva del paciente, en el alta del profesional, en la importación de calendarios— y
 * tenían que dar lo mismo sin que nada lo garantizara.
 *
 * Acá se separan y se escriben una vez. Todo lo que pregunte "¿qué horarios tiene este
 * módulo?" o "¿esta hora es un inicio válido?" pasa por estas funciones, así que la lista
 * no puede ofrecer algo que la reserva rechace.
 *
 * Con las reglas por omisión —paso igual a la duración, sin realinear— dan exactamente lo
 * que daba el código de antes. Las pruebas de `slotGrid.test.ts` lo fijan.
 *
 * Todo es en minutos desde la medianoche. Nada de acá mira la fecha ni la hora actual: lo
 * que depende del reloj se resuelve afuera.
 */

export interface GridRules {
  /** Cada cuánto arranca un turno. `null` es la duración del módulo, como siempre. */
  slotStepMinutes: number | null;
  /** Si la grilla se reacomoda a la hora en que abre el consultorio. */
  realignToOpening: boolean;
}

export interface GridModule {
  /** Inicio del módulo del profesional. */
  start: number;
  /** Fin del módulo. Un turno tiene que terminar a esta hora o antes. */
  end: number;
  /** Lo que dura un turno de este módulo. */
  duration: number;
}

/** El horario del consultorio. Sin él, la grilla es solo la del módulo. */
export interface GridOffice {
  opens: number;
  closes: number;
}

/** Las reglas de siempre: lo que hacía el sistema antes de que hubiera reglas. */
export const DEFAULT_GRID_RULES: GridRules = { slotStepMinutes: null, realignToOpening: false };

export function minutesOf(hour: string): number {
  const [hours, minutes] = String(hour ?? "").split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Minutos a "HH:MM".
 *
 * Se recorta a la medianoche por abajo porque el colchón resta minutos al inicio de un
 * turno, y un turno a las 00:05 con diez de colchón no puede pedir la hora "-00:05".
 */
export function hourOf(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function gridStep(module: GridModule, rules: GridRules): number {
  return rules.slotStepMinutes && rules.slotStepMinutes > 0 ? rules.slotStepMinutes : module.duration;
}

/**
 * Desde dónde se cuenta la grilla.
 *
 * Sin realinear, desde el inicio del módulo, aunque el consultorio todavía esté cerrado: lo
 * que cae antes de abrir se descarta uno por uno. Con un módulo de 14 a 20, turnos de 45
 * minutos y el consultorio abriendo a las 15, eso deja 14:00 y 14:45 afuera y el primero
 * que se ofrece es 15:30.
 *
 * Realineando, la grilla arranca cuando abre el consultorio, y el primero es 15:00.
 */
export function gridAnchor(module: GridModule, office: GridOffice | null, rules: GridRules): number {
  if (rules.realignToOpening && office && office.opens > module.start) return office.opens;
  return module.start;
}

/**
 * Los inicios de turno de un módulo: los que caben enteros en el módulo y, si se sabe, en
 * el horario del consultorio.
 */
export function slotStarts(module: GridModule, office: GridOffice | null, rules: GridRules): number[] {
  const step = gridStep(module, rules);
  const starts: number[] = [];

  // Un paso de cero o negativo dejaría el bucle girando para siempre. No debería llegar
  // nunca —la configuración no lo acepta y la duración del módulo tampoco—, pero si llega
  // es mejor una grilla vacía que un proceso colgado.
  if (step <= 0 || module.duration <= 0) return starts;

  for (let start = gridAnchor(module, office, rules); start + module.duration <= module.end; start += step) {
    if (office && (start < office.opens || start + module.duration > office.closes)) continue;
    starts.push(start);
  }

  return starts;
}

/**
 * Si una hora cae en la grilla: arranca en el ancla o un número entero de pasos después.
 *
 * Es lo mismo que hacía `checkAppointmentDurationFormat` con la duración como paso y el
 * inicio del módulo como ancla, pero al revés —aquella devolvía `true` cuando la hora
 * estaba mal— y sin poder cambiar ninguna de las dos cosas.
 *
 * No mira si el turno entra en el módulo ni en el horario del consultorio: eso se controla
 * aparte, con su propio mensaje, porque "no es el inicio de ningún turno" y "terminaría
 * después de que cierre" son dos errores distintos para quien los lee.
 */
export function isOnGrid(start: number, module: GridModule, office: GridOffice | null, rules: GridRules): boolean {
  const steps = (start - gridAnchor(module, office, rules)) / gridStep(module, rules);
  return steps >= 0 && Number.isInteger(steps);
}

/**
 * El último día que se puede reservar: el domingo de la semana que cierra el horizonte.
 *
 * Con `weeksAhead` en uno, esta semana y la que viene, que es lo que muestra la pantalla.
 */
export function bookingHorizonEnd(now: Date, weeksAhead: number): Date {
  return addDays(startOfWeek(now), 7 * (Math.max(0, weeksAhead) + 1) - 1);
}

/** Si una fecha cae dentro del horizonte de reserva. */
export function withinBookingHorizon(date: Date | string, now: Date, weeksAhead: number): boolean {
  return startOfDay(date) <= bookingHorizonEnd(now, weeksAhead);
}
