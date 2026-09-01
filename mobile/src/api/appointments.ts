import api from "./client";
import { Appointment, Person, Slot } from "./types";

/** Un turno solo, por su número. Es lo que abre la pantalla de detalle. */
export async function findAppointment(numAppointment: number): Promise<Appointment> {
  const { data } = await api.get(`/appointments/${numAppointment}`);
  return data.data;
}

/* ---------- listados ---------- */

/** Turnos de la persona logueada como paciente. Los cancelados no vienen salvo que se pidan. */
export async function myPatientAppointments(page = 0, includeCancelled = false): Promise<Appointment[]> {
  const { data } = await api.get(`/appointments/patient/${page}`, { params: { includeCancelled } });
  return data.data;
}

/** Turnos que atiende el profesional logueado. */
export async function myProfessionalAppointments(page = 0, includeCancelled = false): Promise<Appointment[]> {
  const { data } = await api.get(`/appointments/professional/${page}`, { params: { includeCancelled } });
  return data.data;
}

/** Los del profesional entre dos fechas (YYYY-MM-DD). Es lo que pide la agenda del día. */
export async function professionalRange(from: string, to: string, includeCancelled = false): Promise<Appointment[]> {
  const { data } = await api.get("/appointments/professional-range", { params: { from, to, includeCancelled } });
  return data.data;
}

/**
 * Los pacientes del profesional logueado: los que alguna vez tuvieron turno con él. Un
 * turno cancelado no cuenta como vínculo.
 */
export async function myPatients(): Promise<Person[]> {
  const { data } = await api.get("/appointments/my-patients");
  return data.data;
}

/** Historial del paciente con el profesional logueado. */
export async function medicalHistory(patientEmail: string): Promise<Appointment[]> {
  const { data } = await api.get(`/appointments/medical-history/${encodeURIComponent(patientEmail)}`);
  return data.data;
}

export type AppointmentKind = "all" | "normal" | "overbooked";

/** Turno tal como lo ve el admin: sin observaciones, que son del profesional. */
export interface AdminAppointment {
  numAppointment: number;
  date: string;
  initialHour: string;
  finalHour: string;
  state: string;
  overbooked: boolean;
  patient: { email: string; name: string; surname: string } | null;
  room: { idRoom: number; description: string };
}

export async function appointmentsByProfessional(
  professionalEmail: string,
  page = 0,
  includePast = false,
  kind: AppointmentKind = "all"
): Promise<AdminAppointment[]> {
  const { data } = await api.get(`/appointments/by-professional/${encodeURIComponent(professionalEmail)}/${page}`, {
    params: {
      ...(includePast ? { includePast: "true" } : {}),
      ...(kind === "all" ? {} : { kind }),
    },
  });
  return data.data;
}

/* ---------- acciones sobre un turno ---------- */

export async function acceptAppointment(numAppointment: number): Promise<void> {
  await api.patch(`/appointments/${numAppointment}/accept`);
}

export async function cancelAppointment(numAppointment: number): Promise<void> {
  await api.patch(`/appointments/${numAppointment}/cancel`);
}

/** Parte clínica: si asistió y qué se anotó. */
export async function updateRecord(
  numAppointment: number,
  changes: { state?: string; observations?: string; patientEmail?: string }
): Promise<void> {
  await api.patch(`/appointments/${numAppointment}/diagnostic`, changes);
}

/** El turno en sí. Acepta cambios parciales: lo que no se manda queda como estaba. */
export async function updateAppointment(
  numAppointment: number,
  changes: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }
): Promise<void> {
  await api.patch(`/appointments/${numAppointment}`, changes);
}

export async function assignPatient(numAppointment: number, patientEmail: string): Promise<void> {
  await api.post(`/appointments/patient/${numAppointment}`, { patientEmail });
}

/* ---------- alta ---------- */

/** Horarios libres de un profesional en una sucursal, para los próximos días hábiles. */
export async function availableSlots(professionalEmail: string, office: string): Promise<Slot[]> {
  const { data } = await api.post("/appointments/getAppointments", { professionalEmail, office });
  return data.data ?? [];
}

/** Turno pedido por un paciente. Nace pendiente hasta que el profesional lo confirma. */
export async function bookAppointment(input: {
  date: string;
  initialHour: string;
  professionalEmail: string;
  officeId: string;
}): Promise<void> {
  await api.post("/appointments", {
    date: input.date,
    initialHour: input.initialHour,
    professionalEmail: input.professionalEmail,
    office: input.officeId,
  });
}

/** Turno creado por el profesional. Nace confirmado. */
export async function createProfessionalAppointment(input: {
  date: string;
  initialHour: string;
  finalHour: string;
  room: string;
  value: number;
  patientEmail?: string;
  /** Sobreturno: no tiene que caer en un módulo de atención. */
  overbooked?: boolean;
}): Promise<Appointment> {
  const { data } = await api.post("/appointments/professional", {
    ...input,
    overbooked: input.overbooked === true,
  });
  return data.data;
}
