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

export function toggleState(email:string){
    return api.patch(`/people/${email}/toggleState`)
    .then(res => res.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg)
    })
}

export function registerProfessional(data: Person): Promise<{token:string}>{
    return api.post('/people',{
        name: data.name,
        surname: data.surname,
        email: data.email,
        docType: data.docType,
        docNumber: data.docNumber,
        phoneNumber :data.phoneNumber,
        password: data.password,
        speciality: data.speciality,
        type: data.type
    })
    .then(res => res.data)
    .catch(err => {
      const backendMsg = err.response?.data?.message || err.message;
      throw new Error(backendMsg);
    });
}