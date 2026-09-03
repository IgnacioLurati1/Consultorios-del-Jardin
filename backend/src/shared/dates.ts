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

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
