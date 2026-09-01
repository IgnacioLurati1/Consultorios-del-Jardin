/**
 * Fechas y horas, siempre en castellano rioplatense.
 *
 * El backend manda las fechas de turno como un día sin hora ("2026-09-04" o su ISO a
 * medianoche UTC). Interpretarlas en la zona local las corre un día para atrás en
 * Argentina, así que todo lo que formatea acá lee en UTC. Es el mismo truco que usa la
 * web.
 */

const TZ = "UTC";

function parse(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // "2026-09-04" sin hora lo interpreta como UTC, que es lo que queremos.
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  const date = parse(value);
  if (!date) return typeof value === "string" ? value : "";

  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, ...options }).format(date);
}

/** "jueves 4 de septiembre" */
export function longDate(value: string | Date): string {
  return format(value, { weekday: "long", day: "numeric", month: "long" });
}

/** "jue 4 sep" */
export function shortDate(value: string | Date): string {
  return format(value, { weekday: "short", day: "numeric", month: "short" });
}

/** "04/09/2026" */
export function numericDate(value: string | Date): string {
  return format(value, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "septiembre" */
export function monthName(value: string | Date): string {
  return format(value, { month: "long" });
}

/** El backend manda "09:00:00"; para leer alcanza con "09:00". */
export function hhmm(hour: string | null | undefined): string {
  return hour ? hour.slice(0, 5) : "";
}

/** "09:00 a 09:45" */
export function hourRange(initial: string, final: string): string {
  return `${hhmm(initial)} a ${hhmm(final)}`;
}

/** Hoy, como lo espera el backend: "YYYY-MM-DD" en hora local. */
export function today(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** El lunes de la semana de esa fecha. La semana del consultorio arranca el lunes. */
export function mondayOf(date: Date): Date {
  const fromMonday = (date.getDay() + 6) % 7;
  return addDays(date, -fromMonday);
}

/** "hoy", "mañana", o el día escrito, para encabezar una lista de turnos. */
export function relativeDay(value: string | Date): string {
  const date = parse(value);
  if (!date) return "";

  const iso = date.toISOString().slice(0, 10);
  if (iso === today()) return "hoy";
  if (iso === toISODate(addDays(new Date(), 1))) return "mañana";

  return longDate(date);
}

/** Plata, sin centavos: los valores del consultorio son redondos. */
export function money(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

/** Cantidades grandes que no entran en una tarjeta: 12400 se lee 12,4 k. */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(".", ",")} k`;
  return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M`;
}
