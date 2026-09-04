import api from "../../axios";
import type { Appointment, PaymentState } from "../types.ts";
import { pendingAmount, type partialAppointment } from "./appointmentTypes.ts";

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

/** Los turnos que el paciente pidió y el profesional todavía no aceptó ni rechazó. */
export function findPendingAppointments(): Promise<Appointment[]> {
  return api
    .get("/appointments/pending")
    .then((response) => response.data.data)
    .catch(backendError);
}

/* ============================================================
   Acciones sobre un turno
   ============================================================ */

/** Los turnos que ya se dieron y todavía no se cobraron del todo. Solo del profesional. */
export interface UnpaidSummary {
  /** Los más recientes, con tope: es una caja del panel y no la pantalla de turnos. */
  appointments: Appointment[];
  /** Cuántos hay en total y por cuánto. Puede ser más de lo que trae la lista. */
  total: { people: number; appointments: number; amount: number };
}

export function findUnpaidAppointments(): Promise<UnpaidSummary> {
  return api
    .get("/appointments/unpaid")
    .then((response) => ({
      appointments: response.data.data,
      total: response.data.total ?? sumOf(response.data.data),
    }))
    .catch(backendError);
}

/*
 * El total sacado de la lista, para cuando el backend no lo manda.
 *
 * Pasa en el rato entre que se publica la web y termina de subir el backend, y volvería a
 * pasar si alguna vez hay que dar marcha atrás con una versión. Sin esto la pantalla del
 * profesional no muestra un número de menos: se rompe entera al dibujarse.
 *
 * Queda corto cuando hay más turnos sin cobrar de los que entran en la lista, que es
 * justamente lo que el total del servidor vino a arreglar. Es lo que se podía contar antes
 * y sigue siendo mejor que una pantalla en blanco.
 */
function sumOf(appointments: Appointment[]): UnpaidSummary["total"] {
  const people = new Set(appointments.map((appointment) => appointment.patient?.email).filter(Boolean));

  return {
    people: people.size,
    appointments: appointments.length,
    amount: appointments.reduce((total, appointment) => total + pendingAmount(appointment), 0),
  };
}

/**
 * Registra el cobro de un turno.
 *
 * El monto va solo con "partial": en los otros dos el backend lo ignora y lo guarda en
 * null, así no queda un número viejo colgado de un turno que ya se saldó.
 */
export function updateAppointmentPayment(
  numAppointment: number,
  paymentState: PaymentState,
  paidAmount?: number | null
): Promise<{ paymentState: PaymentState; paidAmount: number | null }> {
  return api
    .patch(`/appointments/${numAppointment}/payment`, { paymentState, paidAmount })
    .then((response) => response.data.data)
    .catch(backendError);
}

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
 * Modifica el turno en sí (fecha, horario, consultorio, valor). Acepta cambios parciales:
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
