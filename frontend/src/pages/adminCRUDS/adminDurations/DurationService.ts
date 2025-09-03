import {toast} from "react-toastify";
import api from "../../../axios";
//import type {Duration} from "../../types.ts"

export function findAllDurations(): Promise<Duration[]>{
    return api.get('/durations')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener Duraciones: ${err.message}`);
        return [];
    });
}

export function createDuration(newDuration: string):Promise<Duration|undefined>{
    if (!newDuration) {
        toast.error('Se necesita el tiempo de duración')
        return Promise.resolve(undefined);
    }

    return api.post('/Durations', {
        time: newDuration
    })
    .then(created => {
        toast.success('Duración creada con éxito');
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        toast.error(`Error al crear Duración: ${backendMsg}`);
    });
}

export function removeDuration(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/Durations/${id}/toggle-state`)
        .then( ()=>{
            toast.success(`Duración eliminada con éxito`);
            return true;
        })
        .catch(err => {
            toast.error(`Error al eliminar duración: ${err.message}`)
            return false;
        });
}