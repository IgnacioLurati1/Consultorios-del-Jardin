import api from "../../axios"
import type { Appointment, Diagnostic } from "../types.ts";

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

export function getAvailableAppointmentsForPatient(patientEmail:string,professionalEmail:string, officeId:Number): Promise<Array<{ date: Date; initialHour: string; finalHour: string; type: "simple" | "taller" }>>  {
    return api.post(`/appointments/getAppointments`,{
        patientEmail: patientEmail,
        professionalEmail: professionalEmail,
        officeId: officeId
    })
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function createProfessionalAppointment(newAppointment:{date: Date,initialHour: string,finalHour: string,idRoom: string,value: number,type: "simple" | "taller",professionalEmail: string,patientEmail?: string}): 
Promise<Array<{ date: Date; initialHour: string; finalHour: string; type: "simple" | "taller" }>>{
    return api.post(`/professional`,{
        date: newAppointment.date,
        initialHour: newAppointment.initialHour,
        finalHour: newAppointment.finalHour,
        idRoom: newAppointment.idRoom,
        value: newAppointment.value,
        type: newAppointment.type,
        patientEmail: newAppointment.patientEmail,
        professionalEmail: newAppointment.professionalEmail,
        
    })
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

