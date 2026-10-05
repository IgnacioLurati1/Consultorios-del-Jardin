/**
 * Qué estados de un turno ocupan el horario.
 *
 * Estaba escrito seis veces: en el servicio de turnos, en la agenda, en los números, en el
 * asistente, en la lista de espera y como un literal suelto en una consulta. La de la lista
 * de espera era una copia a propósito, para no importar el servicio de turnos y armar un
 * ciclo. Este archivo no importa nada, así que lo puede importar cualquiera.
 *
 * Cancelar no es un estado de esta lista: escribe la fecha de la baja en la columna `state`,
 * porque el índice único de (fecha, hora, profesional, estado) tiene que dejar volver a
 * reservar la misma franja. Así que cualquier valor que no esté acá es un turno cancelado.
 * Un estado nuevo —"confirmado por el paciente", por ejemplo— se agrega acá y en ningún
 * otro lado.
 */
export const LIVE_APPOINTMENT_STATES: string[] = ["pending", "accepted", "assisted", "missed"];

/** Si un turno está cancelado. Ver arriba por qué se lee así. */
export function isCancelledState(state: string | null | undefined): boolean {
  return !LIVE_APPOINTMENT_STATES.includes(String(state ?? ""));
}
