import api from "../../axios"
import type { Appointment, Diagnostic } from "../types.ts";
import type { partialAppointment } from "./appointmentTypes.ts";

export function findPatientAppointments(): Promise<Appointment[]> {
    return api.get(`/appointments/patient`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function findProfessionalAppointments(): Promise<Appointment[]> {
    return api.get(`/appointments/professional`)
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

export function getAvailableAppointmentsForPatient(professionalEmail:string, office:string): Promise<Array<partialAppointment>>  {
    return api.post(`/appointments/getAppointments`,{
        professionalEmail,
        office
    })
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function createAppointment(newAppointment:{date: string,initialHour: string,type: "simple" | "taller",professionalEmail: string,officeId: string}): 
Promise<Array<{ numAppointment: Number; date: Date; initialHour: string; finalHour: string; type: "simple" | "taller"; state: string;}>> {
    return api.post(`/appointments`,{
        date: newAppointment.date,
        initialHour: newAppointment.initialHour,
        type: newAppointment.type,
        professionalEmail: newAppointment.professionalEmail,
        office: newAppointment.officeId,
    })
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

