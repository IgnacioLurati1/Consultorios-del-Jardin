import type { PaymentStatus, PriceKey } from "../api/rent";

/**
 * Cómo se escribe lo de alquileres en pantalla. Es lo mismo que usa la página, para que
 * las dos digan igual cada cosa.
 *
 * Las fechas se tratan como texto "AAAA-MM-DD" de punta a punta: solo se reordenan, no
 * pasan por Date, que en el teléfono corre el día según la zona horaria.
 */

export const DAY_LABEL: Record<string, string> = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábado",
  domingo: "domingo",
};

export const BLOCK_LABEL: Record<PriceKey, string> = { morning: "Mañana", afternoon: "Tarde", day: "Día" };

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Pagó",
  partial: "Pagó una parte",
  unpaid: "Sin pagar",
  none: "Sin cuota",
};

export const STATUS_TONE: Record<PaymentStatus, "green" | "warn" | "danger" | "neutral"> = {
  paid: "green",
  partial: "warn",
  unpaid: "danger",
  none: "neutral",
};

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

/** "2026-09". */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, months: number): string {
  const [year, number] = month.split("-").map(Number);
  return monthKeyOf(new Date(year, number - 1 + months, 1));
}

/** "septiembre 2026". */
export function monthName(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return `${MONTH_NAMES[number - 1]} ${year}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hoy, como "AAAA-MM-DD", en la hora del teléfono. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "2026-09-14" → "14/09/2026". Solo reordena el texto. */
export function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Un monto escrito en un campo, o null si no es un número entero de pesos. */
export function parseMoney(value: string): number | null {
  const clean = value.trim().replace(/\./g, "");
  if (!clean) return null;
  const number = Number(clean);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function formatAdjust(adjust: number): string {
  const percent = adjust / 100;
  return `${percent > 0 ? "+" : ""}${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}
