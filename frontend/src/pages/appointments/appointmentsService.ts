import api from "../../axios";
import type { Appointment } from "../types.ts";
import type { partialAppointment } from "./appointmentTypes.ts";

function backendError(err: any): never {
  const backendMsg = err.response?.data?.message || err.message;
  throw new Error(backendMsg);
}

/* ============================================================
   Listados
   Los turnos cancelados no vienen salvo que se pidan con includeCancelled.
   ============================================================ */

export function findPatientAppointments(page: number, includeCancelled = false): Promise<Appointment[]> {
  return api
    .get(`/appointments/patient/${page}`, { params: { includeCancelled } })
    .then((response) => response.data.data)
    .catch(backendError);
}

export function findProfessionalAppointments(page: number, includeCancelled = false): Promise<Appointment[]> {
  return api
    .get(`/appointments/professional/${page}`, { params: { includeCancelled } })
    .then((response) => response.data.data)
    .catch(backendError);
}

/** Turnos del profesional entre dos fechas (YYYY-MM-DD). Lo usa la vista de grilla. */
export function findProfessionalAppointmentsInRange(from: string, to: string, includeCancelled = false): Promise<Appointment[]> {
  return api
    .get(`/appointments/professional-range`, { params: { from, to, includeCancelled } })
    .then((response) => response.data.data)
    .catch(backendError);
}

/* ============================================================
   Acciones sobre un turno
   ============================================================ */

export function acceptAppointment(numAppointment: number): Promise<boolean> {
  return api
    .patch(`/appointments/${numAppointment}/accept`)
    .then(() => true)
    .catch(backendError);
}

export function cancelAppointmentService(numAppointment: number): Promise<boolean> {
  return api
    .patch(`/appointments/${numAppointment}/cancel`)
    .then(() => true)
    .catch(backendError);
}

/**
 * Parte clínica del turno: estado (asistió / no vino) y observaciones.
 * Antes esto vivía en la entidad Diagnostic; ahora son campos del turno.
 */
export function updateAppointmentRecord(
  numAppointment: number,
  data: { state?: string; observations?: string; patientEmail?: string }
): Promise<boolean> {
  return api
    .patch(`/appointments/${numAppointment}/diagnostic`, data)
    .then(() => true)
    .catch(backendError);
}

/**
 * Modifica el turno en sí (fecha, horario, sala, valor). Acepta cambios parciales:
 * lo que no se manda, queda como estaba.
 */
export function updateAppointment(
  numAppointment: number,
  data: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }
): Promise<boolean> {
  return api
    .patch(`/appointments/${numAppointment}`, data)
    .then(() => true)
    .catch(backendError);
}

export function addPatientToAppointment(numAppointment: number, patientEmail: string): Promise<boolean> {
  return api
    .post(`/appointments/patient/${numAppointment}`, { patientEmail })
    .then(() => true)
    .catch(backendError);
}

/** Historial del paciente con este profesional (turnos + observaciones). */
export function getPatientMedicalHistory(patientEmail: string): Promise<Appointment[]> {
  return api
    .get(`/appointments/medical-history/${encodeURIComponent(patientEmail)}`)
    .then((response) => response.data.data)
    .catch(backendError);
}

/* ============================================================
   Alta de turnos
   ============================================================ */

export function createProfessionalAppointment(newAppointment: {
  date: string;
  initialHour: string;
  finalHour: string;
  room: string;
  value: number;
  patientEmail?: string;
  /** true = sobreturno: el backend no exige que caiga en un módulo de atención. */
  overbooked?: boolean;
}): Promise<Appointment | undefined> {
  return api
    .post(`/appointments/professional`, {
      date: newAppointment.date,
      initialHour: newAppointment.initialHour,
      finalHour: newAppointment.finalHour,
      room: newAppointment.room,
      value: newAppointment.value,
      patientEmail: newAppointment.patientEmail,
      overbooked: newAppointment.overbooked === true,
    })
    .then((created) => created.data.data)
    .catch(backendError);
}

export function getAvailableAppointmentsForPatient(professionalEmail: string, office: string): Promise<Array<partialAppointment>> {
  return api
    .post(`/appointments/getAppointments`, { professionalEmail, office })
    .then((response) => response.data.data)
    .catch(() => []);
}

export function createAppointment(newAppointment: {
  date: string;
  initialHour: string;
  professionalEmail: string;
  officeId: string;
}): Promise<any> {
  return api
    .post(`/appointments`, {
      date: newAppointment.date,
      initialHour: newAppointment.initialHour,
      professionalEmail: newAppointment.professionalEmail,
      office: newAppointment.officeId,
    })
    .then((response) => response.data)
    .catch(backendError);
}
