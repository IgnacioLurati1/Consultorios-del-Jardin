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
