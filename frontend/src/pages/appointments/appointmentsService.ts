import api from "../../axios"
import type { Appointment, Diagnostic, DiagnosticPopulatedAppointment } from "../types.ts";
import type { partialAppointment } from "./appointmentTypes.ts";

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
    .then(response => response.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}
export function getPatienMedicalHistory(emailPatient: string): Promise <DiagnosticPopulatedAppointment[]>{
    return api.get(`/appointments/medical-history/${emailPatient}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function createProfessionalAppointment(newAppointment:{date: string,initialHour: string,finalHour: string,room: string,type: string,value: number,patientEmail: string}): Promise< Appointment | undefined > {
    return api.post(`/appointments/professional`,{
        date: newAppointment.date,
        initialHour: newAppointment.initialHour,
        finalHour: newAppointment.finalHour,
        type: newAppointment.type,
        room: newAppointment.room,
        value: newAppointment.value,
        patientEmail: newAppointment.patientEmail,
    })
    .then(created => {
        return created.data.data       
    })
    .catch(err =>{
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    })
}

export function addPatientToAppointment(numAppointment: string, patientEmail:string):Promise <number>{ 
    return api.post(`/appointments/patient/${numAppointment}`,{patientEmail: patientEmail})
    .then(created => {
        return created.status      
    })
    .catch(err =>{
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    })
}

