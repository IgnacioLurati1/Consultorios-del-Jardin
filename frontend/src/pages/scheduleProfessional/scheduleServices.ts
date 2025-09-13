import {toast} from "react-toastify";
import api from "../../axios";
import type {Schedule, Person} from "../types.ts"

export function findAllProfessionals(): Promise<Person[]>{
    return api.get('/people/type/professional')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener profesionales: ${err.message}`);
        return [];
    });
}

export function findProfessionalSchedules(professionalEmail: string): Promise<Schedule[]>{
    if(!professionalEmail) return Promise.resolve([])

    return api.get(`/schedules/by-email/${professionalEmail}`)
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener horarios del profesional: ${err.message}`);
        return [];
});
}

