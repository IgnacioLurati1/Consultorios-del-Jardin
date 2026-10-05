import api from "../../axios";

/**
 * Turno tal como lo ve el admin en la pestaña de control.
 * El backend recorta la respuesta a propósito: no incluye observaciones
 * (el diagnóstico), solo el horario, el estado y el paciente.
 */
export interface AdminAppointment {
  numAppointment: number;
  date: string;
  initialHour: string;
  finalHour: string;
  state: string;
  /** Sobreturno: el profesional lo dio fuera de sus módulos de atención. */
  overbooked: boolean;
  patient: { email: string; name: string; surname: string } | null;
  room: { idRoom: number; description: string };
}

/** Qué turnos se piden: todos, solo los normales o solo los sobreturnos. */
export type AppointmentKind = "all" | "normal" | "overbooked";

/**
 * Turnos de un profesional. Por defecto vienen solo los de hoy en adelante y del
 * mas cercano al mas lejano; con includePast vienen todos, del mas reciente al mas viejo.
 */
export function findAppointmentsByProfessional(
  professionalEmail: string,
  page = 0,
  includePast = false,
  kind: AppointmentKind = "all"
): Promise<AdminAppointment[]> {
  if (!professionalEmail) return Promise.resolve([]);

  return api
    .get(`/appointments/by-professional/${encodeURIComponent(professionalEmail)}/${page}`, {
      params: {
        ...(includePast ? { includePast: "true" } : {}),
        ...(kind === "all" ? {} : { kind }),
      },
    })
    .then((response) => response.data.data)
    .catch((err: any) => {
      const backendMsg = err.response?.data?.message || err.message;
      throw new Error(backendMsg);
    });
}

/* ============================================================
   La recepción: la administración sobre la agenda de cualquier profesional.

   Solo existe con la regla adminBooking prendida. Las tres devuelven el mensaje del
   servidor, que ya viene escrito para mostrarse tal cual, y fallan con ese mismo mensaje.
   ============================================================ */

type HttpError = { response?: { data?: { message?: string } }; message?: string };

function backendError(err: HttpError): never {
  throw new Error(err.response?.data?.message || err.message);
}

export interface AdminAppointmentInput {
  professionalEmail: string;
  /** "AAAA-MM-DD". */
  date: string;
  initialHour: string;
  finalHour: string;
  /** idRoom. */
  room: number;
  value: number;
  patientEmail?: string;
  overbooked?: boolean;
}

/** Da un turno en la agenda de un profesional. */
export function createAdminAppointment(input: AdminAppointmentInput): Promise<string> {
  return api
    .post("/appointments/admin", input)
    .then((response) => String(response.data?.message ?? ""))
    .catch(backendError);
}

/** Lo que se puede cambiar de un turno ya dado. Lo que no viene queda como estaba. */
export interface AdminAppointmentChanges {
  date?: string;
  initialHour?: string;
  finalHour?: string;
  room?: number;
  value?: number;
}

/** Mueve un turno o le cambia el valor. */
export function moveAdminAppointment(numAppointment: number, changes: AdminAppointmentChanges): Promise<string> {
  return api
    .patch(`/appointments/${numAppointment}/admin`, changes)
    .then((response) => String(response.data?.message ?? ""))
    .catch(backendError);
}

/**
 * Da de baja un turno. Si estaba pendiente, el servidor lo borra en lugar de dejarlo
 * cancelado.
 *
 * No se manda `notifyWaitlist`: el servidor lo toma como "no avisar". Para preguntarlo
 * habría que saber cuánta gente espera ese horario, y esa cuenta hoy solo la puede pedir
 * el profesional del turno.
 */
export function cancelAdminAppointment(numAppointment: number): Promise<string> {
  return api
    .patch(`/appointments/${numAppointment}/admin-cancel`, {})
    .then((response) => String(response.data?.message ?? ""))
    .catch(backendError);
}
