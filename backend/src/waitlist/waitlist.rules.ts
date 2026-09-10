import { badRequest } from "../shared/errors.js";
import { startOfDay } from "../shared/dates.js";
import { SHORT_NOTICE_HOURS } from "../shared/shortNotice.js";

/**
 * Las reglas de la lista de espera, sin base de datos.
 *
 * Están acá sueltas para que se puedan probar solas y para que el número de cada tope
 * viva en un solo lugar: la pantalla los recibe del servidor y no los tiene escritos.
 */
export const WAITLIST_LIMITS = {
  /** Cuántos días de la semana puede elegir. */
  maxDays: 3,
  /** El largo máximo de la franja horaria. */
  maxHours: 8,
  /** Cuánto dura anotado. */
  lifetimeDays: 14,
  /** Cuántos avisos recibe antes de salir solo de la lista. */
  maxNotices: 3,
  /** En cuántas listas puede estar a la vez. Pasarse es un límite y nada más. */
  maxActive: 2,
  /** Cuántas veces se puede anotar en el mes. Pasarse cierra la cuenta. */
  maxPerMonth: 5,
  /** Cuánta gente entra en la lista de un profesional. Más que eso satura a todos. */
  maxPerProfessional: 10,
} as const;

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function minutesOf(hour: string): number {
  const [hours, minutes] = String(hour).slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export interface WaitlistRequest {
  /** Días de la semana con el número de `getDay()`, de lunes (1) a sábado (6). */
  days: number[];
  fromHour: string;
  toHour: string;
}

/**
 * Lo que manda la pantalla, validado.
 *
 * El domingo queda afuera porque el consultorio no atiende: la agenda de turnos libres
 * ni siquiera lo recorre, así que anotarse para un domingo es esperar algo que no va a
 * pasar.
 */
export function parseWaitlistRequest(body: any): WaitlistRequest {
  const raw: unknown[] = Array.isArray(body?.days) ? body.days : [];
  const days = [...new Set(raw.map(Number))].filter(Number.isInteger).sort((a, b) => a - b);

  if (days.length === 0) throw badRequest("Elegí al menos un día de la semana");
  if (days.length > WAITLIST_LIMITS.maxDays) throw badRequest(`Podés elegir hasta ${WAITLIST_LIMITS.maxDays} días`);
  if (days.some((day) => day < 1 || day > 6)) throw badRequest("Los días tienen que ser de lunes a sábado");

  const fromHour = String(body?.fromHour ?? "");
  const toHour = String(body?.toHour ?? "");

  if (!HOUR.test(fromHour)) throw badRequest("La hora de inicio tiene que estar en formato HH:MM");
  if (!HOUR.test(toHour)) throw badRequest("La hora de fin tiene que estar en formato HH:MM");

  const length = minutesOf(toHour) - minutesOf(fromHour);
  if (length <= 0) throw badRequest("La hora de fin tiene que ser posterior a la de inicio");
  if (length > WAITLIST_LIMITS.maxHours * 60) throw badRequest(`La franja puede ser de hasta ${WAITLIST_LIMITS.maxHours} horas`);

  return { days, fromHour, toHour };
}

/** Los días guardados, "1,3", de vuelta a números. */
export function parseDays(text: string | null | undefined): number[] {
  return String(text ?? "")
    .split(",")
    .filter((part) => part.trim() !== "")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export interface Slot {
  date: Date | string;
  initialHour: string;
  finalHour: string;
}

/**
 * Si un turno cae en lo que la persona pidió: el día de la semana, y la franja entera.
 *
 * El turno tiene que empezar y terminar adentro. Uno de 17:30 a 18:30 no le sirve a quien
 * pidió hasta las 18: le estaríamos avisando de un horario que no puede tomar.
 */
export function fits(entry: { days: string | number[]; fromHour: string; toHour: string }, slot: Slot): boolean {
  const days = Array.isArray(entry.days) ? entry.days : parseDays(entry.days);
  if (!days.includes(startOfDay(slot.date).getDay())) return false;

  const start = String(slot.initialHour).slice(0, 5);
  const end = String(slot.finalHour).slice(0, 5);
  return start >= entry.fromHour && end <= entry.toHour;
}

/**
 * Cuántas horas faltan para el turno.
 *
 * Arma el momento del turno desde el día de calendario y no desde la fecha tal como viene
 * de la base: una columna DATE vuelve como medianoche UTC, que acá es el día anterior a
 * las nueve de la noche, y el cálculo daría un día menos.
 */
export function hoursUntil(slot: { date: Date | string; initialHour: string }, at = new Date()): number {
  const start = startOfDay(slot.date);
  const [hours, minutes] = String(slot.initialHour).split(":").map(Number);
  start.setHours(hours, minutes || 0, 0, 0);
  return (start.getTime() - at.getTime()) / 3_600_000;
}

/** Si la baja llegó con más de un día de anticipación, que es cuando todavía sirve avisar. */
export function freedInTime(slot: { date: Date | string; initialHour: string }, at = new Date()): boolean {
  return hoursUntil(slot, at) > SHORT_NOTICE_HOURS;
}

/** "lunes", "lunes y miércoles", "lunes, martes y viernes". */
export function describeDays(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((day) => DAY_NAMES[day]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
