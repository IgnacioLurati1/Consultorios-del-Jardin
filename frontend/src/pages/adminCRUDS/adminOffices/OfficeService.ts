import api from "../../../axios";
import { currentWords } from "../../../lib/installation.ts";
import type {Office} from "../../types.ts"
import { officeIdOf } from "./branches.ts";

interface DBOffice {
    id_office: string;
    closing_time: string;
    description:  string;
    city_id_city: number;
    opening_time: string;
}

export function findAllOffices(): Promise<Office[]>{
    return api.get('/offices')
    .then(response => response.data.data)
    .catch(() => {
        return[];
    });
}

export function findAllActiveOffices(): Promise<Office[]>{
    return api.get('/offices/active')
    .then(response => response.data.data)
    .catch(() => {
        return[];
    });
}

/** `address` vacía queda en null del otro lado: la sucursal usa la dirección general. */
export function createOffice(newDescription: string, newOpeningTime: string, newClosingTime: string, cityId: string, address = ""): Promise<Office | undefined>{
    if(!newDescription.trim() || !newOpeningTime || !newClosingTime || !cityId){
        throw new Error(`Se necesitan todos los campos completos para crear ${currentWords().un("sucursal")}`);
    }

    return api.post('/offices',{
        description: newDescription,
        address: address.trim(),
        openingTime: newOpeningTime,
        closingTime: newClosingTime,
        active: true,
        city: cityId
    })
    .then(created => {
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    })
}

export function removeOffice(id: string): Promise<boolean> {
    if(!id) return Promise.resolve(false);

    return api.patch(`/offices/${id}/toggle`)
    .then(() => {
        return true;
    })
    .catch(err =>{
        const backendMsg = err.response?.data?.message ||  err.message;
        throw new Error(backendMsg);
    });
}

/** `address` sin pasar no se toca; vacía la borra y la sucursal vuelve a la dirección general. */
export function updateOffice(id: string, newDescription: string, newOpeningTime: string, newClosingTime: string, cityId: string, active: boolean, address?: string): Promise<Office | void | undefined>{
    if(!newDescription.trim() || !newOpeningTime || !newClosingTime || !cityId){
        throw new Error(`Se necesitan todos los campos completos para modificar ${currentWords().un("sucursal")}`);
    }

    if(active){
        return api.put(`/offices/${id}`,{
            description: newDescription,
            ...(address === undefined ? {} : { address: address.trim() }),
            city: cityId,
            openingTime: newOpeningTime,
            closingTime: newClosingTime,
        })
        .then(updated => {
            return updated.data.data
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
    } else {
        
        return api.patch(`/offices/${id}/toggle`)
        .then(() => {
            return;
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
    };
}

export function findAllOfficesByProfessional(professionalEmail: string): Promise<DBOffice[]> {
    return api.get(`/offices/professional/${professionalEmail}`)
    .then(response => response.data.data)
    .catch(() => {
        return[];
    });
}

/**
 * Los números de las sucursales donde atiende un profesional, las de sus horarios cargados.
 *
 * Esa ruta devuelve las filas tal como salen de la base (`id_office` y no `idOffice`), así
 * que se leen las dos formas. A diferencia de la de arriba, un error no queda en una lista
 * vacía: "no atiende en ninguna" y "no se pudo saber" se dicen distinto.
 */
export function findOfficeIdsOfProfessional(professionalEmail: string): Promise<string[]> {
    return api.get(`/offices/professional/${encodeURIComponent(professionalEmail)}`)
    .then(response => (Array.isArray(response.data?.data) ? response.data.data : []) as unknown[])
    .then(rows => rows.map(officeIdOf).filter((id): id is string => !!id));
}
