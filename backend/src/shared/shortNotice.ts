/**
 * Qué es dar de baja un turno sobre la hora.
 *
 * Está acá, solo, porque la misma regla la usan tres lugares que no se conocen entre sí:
 * el aviso que le llega al profesional cuando le liberan un horario, el panel de
 * comportamiento que cuenta cuántas veces pasó, y la ficha del turno del lado de la
 * página. Escrita tres veces, el día que el número deje de ser veinticuatro va a cambiar
 * en dos de los tres y nadie va a notar cuál quedó afuera.
 */

import { startOfDay } from "./dates.js";

/** Debajo de esto el horario ya no se alcanza a ofrecer, y por eso se marca aparte. */
export const SHORT_NOTICE_HOURS = 24;

/**
 * Cuántas horas antes del turno llegó la baja.
 *
 * El momento del turno son dos columnas, la fecha y la hora de inicio, así que hay que
 * juntarlas. Puede dar negativo, y eso también dice algo: la baja llegó con el turno ya
 * empezado.
 *
 * El día sale de `startOfDay` y no de la fecha tal como viene de la base. Una columna DATE
 * vuelve como medianoche UTC, que acá son las nueve de la noche del día anterior: armada
 * así, la cuenta daba un día de menos y una baja con 27 horas de aviso figuraba con 3.
 */
export function hoursOfNotice(date: Date | string, initialHour: string, cancelledAt: Date): number {
  const [hour, minute] = String(initialHour).split(":").map(Number);
  const start = startOfDay(date);
  start.setHours(hour, minute ?? 0, 0, 0);
  return (start.getTime() - cancelledAt.getTime()) / 3_600_000;
}

/**
 * Lo mismo, leído directo de un turno.
 *
 * `short` en false cuando no hay nada que mirar: la baja la hizo el profesional —que del
 * lado de su propia agenda no es algo para revisar después— o el turno es anterior a que
 * se guardara este dato.
 */
export function noticeOf(appointment: {
  date: Date | string;
  initialHour: string;
  patientCancelledAt?: Date | null;
}): { hours: number | null; short: boolean } {
  if (!appointment.patientCancelledAt) return { hours: null, short: false };

  const hours = hoursOfNotice(appointment.date, appointment.initialHour, appointment.patientCancelledAt);
  return { hours, short: hours < SHORT_NOTICE_HOURS };
}
