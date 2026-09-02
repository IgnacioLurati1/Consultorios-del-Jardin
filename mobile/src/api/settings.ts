import api from "./client";

export type AutoMark = "assisted" | "missed";
export type AutoMarkWhen = "appointment" | "day";
export type DeleteScope = "future" | "all";

export interface VacationPeriod {
  id: number;
  fromDate: string;
  toDate: string;
  reason: string | null;
  /** Si hoy cae adentro del período. Es lo que cambia "Borrar" por "Ya volví". */
  current: boolean;
}

export interface ProfessionalSettings {
  autoAccept: boolean;
  autoMark: AutoMark | null;
  autoMarkWhen: AutoMarkWhen;
  /** Pedidos esperando respuesta ahora mismo. */
  pending: number;
  vacations: VacationPeriod[];
}

export function getSettings(): Promise<ProfessionalSettings> {
  return api.get("/settings").then((response) => response.data.data);
}

export function saveSettings(data: {
  autoAccept?: boolean;
  autoMark?: AutoMark | null;
  autoMarkWhen?: AutoMarkWhen;
}): Promise<ProfessionalSettings> {
  return api.patch("/settings", data).then((response) => response.data.data);
}

/** Confirma de una todos los pedidos que quedaron esperando. Devuelve cuántos eran. */
export function acceptPending(): Promise<number> {
  return api.post("/settings/pending").then((response) => response.data.data.accepted);
}

export function addVacation(fromDate: string, toDate: string, reason?: string): Promise<void> {
  return api.post("/settings/vacations", { fromDate, toDate, reason }).then(() => undefined);
}

/** Borra un período. Sirve igual para uno futuro que para cortar el que está en curso. */
export function removeVacation(id: number): Promise<void> {
  return api.delete(`/settings/vacations/${id}`).then(() => undefined);
}

/** Borra los turnos con un paciente. Definitivo. */
export function deletePatientAppointments(
  email: string,
  scope: DeleteScope
): Promise<{ deleted: number; stoppedRecurrences: number }> {
  return api
    .delete(`/settings/patients/${encodeURIComponent(email)}/appointments`, { params: { scope } })
    .then((response) => response.data.data);
}
