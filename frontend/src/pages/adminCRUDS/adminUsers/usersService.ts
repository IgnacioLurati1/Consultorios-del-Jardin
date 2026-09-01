import api from "../../../axios"
import type { Person } from "../../types";

export function getAllUsers(): Promise<Person[]>{
    return api.get('/people/NoAdmin')
    .then(response => response.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    }
    )
}

export function findAllProfessionals(): Promise<Person[]>{
    return api.get('/people/type/professional')
    .then(response => response.data.data)
    .catch(()=> {
        return [];
    });
}

export function findAllActiveProfessionals(): Promise<Person[]>{
    return api.get('/people/type/active/professional')
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findAllActiveClients(): Promise<Person[]>{
    return api.get('/people/type/active/client')
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findProfessionalsOfficeSpecialty(officeId:string,speciality?:string): Promise<Person[]>{
    return api.get(`/people/professionals/office/${officeId}${speciality ? "/" + speciality : ""}`)
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findOne(email:string): Promise<Person>{
    return api.get(`/people/${email}`)
    .then(response => response.data.data)
    .catch(()=> {
        return [];
    });
}

export function toggleState(email:string){
    return api.patch(`/people/${email}/toggleState`)
    .then(res => res.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg)
    })
}

// Actualiza los datos de una persona. El backend ignora email y password en este
// endpoint, así que desde acá nunca se mandan.
export function updatePerson(email: string, data: Partial<Person>): Promise<Person>{
    return api.patch(`/people/${email}`, data)
    .then(res => res.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export interface ProfessionalInput {
    name: string;
    surname: string;
    email: string;
    docType: string;
    docNumber: string;
    phoneNumber: string;
    password: string;
    speciality: string;
}

// Va por /people/professional y no por el registro público: ese devuelve un token y
// setea la cookie de refresh, así que el admin terminaba con la sesión del profesional
// que acababa de crear.
export function registerProfessional(data: ProfessionalInput): Promise<Person>{
    return api.post('/people/professional', data)
    .then(res => res.data.data)
    .catch(err => {
      const backendMsg = err.response?.data?.message || err.message;
      throw new Error(backendMsg);
    });
}