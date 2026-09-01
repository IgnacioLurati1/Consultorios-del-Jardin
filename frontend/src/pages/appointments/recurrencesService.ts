import api from "../../axios";
import type { Recurrence, RecurrenceFrequency } from "../types";

/** Cómo se dice cada frecuencia. Se usa en los carteles y en los selects. */
export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Todas las semanas",
  biweekly: "Cada dos semanas",
};

function unwrap(err: any): never {
  throw new Error(err.response?.data?.message || err.message);
}

/** Turnos repetibles activos del profesional logueado. */
export function findRecurrences(): Promise<Recurrence[]> {
  return api
    .get("/recurrences")
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Marca un turno ya existente como repetible. Devuelve cuántos turnos dejó creados. */
export function createRecurrence(
  numAppointment: number,
  frequency: RecurrenceFrequency,
  /** Último día en que se crea un turno. null repite sin fecha de corte. */
  endDate: string | null
): Promise<{ idRecurrence: number; created: number; skipped: number }> {
  return api
    .post("/recurrences", { numAppointment, frequency, endDate })
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Cambia la configuración. Solo afecta a los turnos que todavía no se generaron. */
export function updateRecurrence(
  idRecurrence: number,
  data: {
    frequency?: RecurrenceFrequency;
    value?: number;
    idRoom?: number;
    patientEmail?: string | null;
    endDate?: string | null;
  }
): Promise<void> {
  return api
    .patch(`/recurrences/${idRecurrence}`, data)
    .then(() => undefined)
    .catch(unwrap);
}

/** Frena la generación. Los turnos ya creados quedan como están. */
export function stopRecurrence(idRecurrence: number): Promise<void> {
  return api
    .delete(`/recurrences/${idRecurrence}`)
    .then(() => undefined)
    .catch(unwrap);
}
