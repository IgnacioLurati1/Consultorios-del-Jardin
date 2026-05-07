import type {Person} from "./types"
import api from "../axios"
import {jwtDecode} from "jwt-decode";
import type { TokenPayload } from "./types.ts";

export function findPerson(email: string): Promise<Person|undefined>{
    if(!email) return Promise.resolve(undefined)

    return api.get(`/people/${email}`)
    .then(response => response.data.data)
    .catch(err => {throw new Error(err.response?.data?.message || err.message)})
}

export function getDecodedToken() {
    const storedToken = localStorage.getItem("token")  //Obtengo datos del usuario logeado   
    if (storedToken) {
        const decoded = jwtDecode<TokenPayload>(storedToken);
        return decoded;
    }else{
        return null;
    }
}