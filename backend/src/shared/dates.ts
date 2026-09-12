/**
 * Fechas de turno.
 *
 * Las columnas DATE son asimétricas: al leerlas vuelven como medianoche UTC, pero al
 * escribirlas se usan los componentes locales. Con UTC-3 eso corre un día para atrás,
 * así que todo lo que compare o agrupe fechas de turnos tiene que pasar por acá.
 */

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** El día de calendario que representa una fecha, como medianoche local. */
export function startOfDay(value: Date | string): Date {
  if (typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  const isUtcMidnight =
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0 &&
    parsed.getUTCMilliseconds() === 0;

  return isUtcMidnight
    ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Si dos fechas de turno caen el mismo día de calendario.
 *
 * Las dos pasan por `startOfDay` porque suelen venir de lados distintos: una leída de la
 * base (medianoche UTC) y otra recién parseada (medianoche local). Comparadas con
 * `toDateString`, en UTC-3 la de la base se lee como el día anterior y dos fechas iguales
 * dan distintas. Eso hacía que cambiarle solo el valor a un turno le mandara al paciente
 * el mail de "tu turno se movió".
 */
export function sameCalendarDay(a: Date | string, b: Date | string): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * El día de calendario de un "AAAA-MM-DD", o null si ese día no existe.
 *
 * `new Date(2026, 1, 30)` no falla: el 30 de febrero se desborda al 2 de marzo, y el mes
 * 13 al enero siguiente. Una fecha escrita a mano en la URL entraba así y devolvía la
 * agenda de otro día con el rótulo de uno imposible. La única forma de detectarlo es
 * volver a escribir la fecha construida y ver si dice lo mismo que entró.
 */
export function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;

  const date = startOfDay(value);
  return toISODate(date) === value ? date : null;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Primer día del mes de esa fecha. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Último día del mes de esa fecha. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Clave estable de mes, "2026-08". Sirve para agrupar y para ordenar. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Cómo se muestra un mes: "agosto 2026". */
export function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function dayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/** El lunes de la semana de esa fecha, a medianoche. La semana arranca el lunes, como se lee una agenda acá. */
export function startOfWeek(date: Date | string): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** "martes 22 de septiembre", para escribir en un mail o en un aviso. */
export function longDate(date: Date | string): string {
  const day = startOfDay(date);
  return `${DAY_NAMES[day.getDay()]} ${day.getDate()} de ${MONTH_NAMES[day.getMonth()]}`;
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Una fecha como se escribe acá: día, mes y año, en ese orden.
 *
 * Toma la fecha en el formato interno (AAAA-MM-DD) y devuelve el que se lee. Los dos
 * existen a propósito y hacen cosas distintas: el interno se ordena solo comparando
 * texto, que es de lo que dependen medio sistema y la base; este no se ordena, pero es el
 * único que alguien de acá lee sin tener que pensar si el 3 es el mes o el día.
 */
export function toLocalDate(iso: string): string {
  const [year, month, day] = String(iso).slice(0, 10).split("-");
  if (!year || !month || !day) return String(iso);

  return `${day}/${month}/${year}`;
}
