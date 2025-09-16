import { toast } from "react-toastify";
import type {Person} from "./types"
import api from "../axios"

export function findPerson(email: string): Promise<Person|undefined>{
    if(!email) return Promise.resolve(undefined)

    return api.get(`/people/${email}`)
    .then(response => response.data.data)

}