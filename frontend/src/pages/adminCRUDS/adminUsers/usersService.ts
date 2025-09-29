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

