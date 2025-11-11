import api from "../../axios"
import type { Appointment } from "../types.ts";

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
