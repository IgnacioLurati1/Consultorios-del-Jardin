import api from "../../axios"
import type { Appointment, Diagnostic, DiagnosticPopulatedAppointment } from "../types.ts";

export function findPatientAppointments(page: number): Promise<Appointment[]> {
    return api.get(`/appointments/patient/${page}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function findProfessionalAppointments(page: number): Promise<Appointment[]> {
    return api.get(`/appointments/professional/${page}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function cancelAppointmentService(numAppointment: number): Promise<boolean> {
  return api.patch(`/appointments/${numAppointment}/cancel`)
    .then(() => true)
    .catch(() => false);
}

export function GetAppointmentDiagnostics(numAppointment: number): Promise<Diagnostic[]> {
    return api.get(`/appointments/${numAppointment}/diagnostics`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function acceptAppointment(numAppointment: number){
    return api.patch(`/appointments/${numAppointment}/accept`)
    .then(() => true)
    .catch(() => false);
}

export function updateDiagnostic(numAppointment: number, patientEmail: string, observations: string, state: string): Promise<boolean> {
    return api.patch(`/appointments/${numAppointment}/diagnostic`, {
        patientEmail,
        observations,
        state
    })
    .then(() => true)
    .catch(() => false);
}

export function getPatienMedicalHistory(emailPatient: string): Promise <DiagnosticPopulatedAppointment[]>{
    return api.get(`/appointments/medical-history/${emailPatient}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}