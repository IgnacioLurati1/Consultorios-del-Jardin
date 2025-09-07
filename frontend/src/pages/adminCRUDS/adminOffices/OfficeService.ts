import {toast} from "react-toastify";
import api from "../../../axios";
import type {Office} from "../../types.ts"

export function findAllOffices(): Promise<Office[]>{
    return api.get('/offices')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener consultorios: ${err.message}`);
        return[];
    });
}

export function findAllActiveOffices(): Promise<Office[]>{
    return api.get('/offices/active')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener consultorios: ${err.message}`)
        return[];
    });
}

export function createOffice(newDescription: string, newOpeningTime: string, newClosingTime: string, cityId: string): Promise<Office | undefined>{
    if(!newDescription.trim() || !newOpeningTime || !newClosingTime || !cityId){
        toast.error('Se necesitan todos los campos compleatados para crear una sala')
        return Promise.resolve(undefined);
    }

    return api.post('/offices',{
        description: newDescription, 
        openingTime: newOpeningTime,
        closingTime: newClosingTime,
        active: true,
        city: cityId
    })
    .then(created => {
        toast.success('Consultorios creado con éxito');
        return created.data.data
    })
    .catch(err => {
        toast.error(`Error al crear consultorio: ${err.message}`)
        throw new Error();
    })
}

export function removeOffice(id: string): Promise<boolean> {
    if(!id) return Promise.resolve(false);

    return api.patch(`/offices/${id}/toggle`)
    .then(() => {
        toast.success(`Consultorio eliminado con éxito`);
        return true;
    })
    .catch(err =>{
        toast.error(`Error al eliminar consultorio: ${err.message}`);
        return false;
    });
}

export function updateOffice(id: string, newDescription: string, openingTime: string, closingTime: string, cityId: string, active: boolean): Promise<Office | void | undefined>{
    if(!newDescription.trim() || !openingTime || !closingTime || !cityId){
        toast.error('No se pueden enviar parámetros vacíos')
        return Promise.resolve(undefined)
    }

    if(active){
        return api.put(`/offices/${id}`,{
            description: newDescription,
            cityId: cityId
        })
        .then(updated => {
            toast.success(`Consultorio modificado con éxito`);
            return updated.data.data
        })
        .catch(err => {
            toast.error(`Error al modificar consultorio: ${err.message}`)
        });
    } else {
        return api.patch(`/offices/${id}/toggle`)
        .then(() => {
            toast.success(`Consultorio activado con éxito`);
        })
        .catch(err => {
            toast.error(`Error al modificar consultorio: ${err.message}`);
        });
    };
}