import {toast} from "react-toastify";
import api from "../../../axios";
import type {City} from "../../types.ts"

export function findAllCities(): Promise<City[]>{
    return api.get('/cities')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener Localidades: ${err.message}`);
        return [];
    });
}

export function findAllActiveCities(): Promise<City[]>{
    return api.get('/cities/active')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener Localidades: ${err.message}`);
        return [];
    });
}

export function createCity(newCity: { nameCity: string; province: string }): Promise<City | undefined>{
    if (!newCity.nameCity.trim() || !newCity.province) {
        toast.error('Se necesitan los campos necesarios para crear una Localidad')
        return Promise.resolve(undefined);
    }

    return api.post('/Cities', {
        nameCity: newCity.nameCity,
        province: newCity.province,
    })
    .then(created => {
        toast.success('Localidad creada con éxito');
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        toast.error(`Error al crear Localidad: ${backendMsg}`);
    });
}

export function removeCity(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/cities/${id}/toggle-state`)
        .then( ()=>{
            toast.success(`Localidad eliminada con éxito`);
            return true;
        })
        .catch(err => {
            toast.error(`Error al eliminar localidad: ${err.message}`)
            return false;
        });
}

export function updateCity(updatedCity: { idCity: string; nameCity: string; province: string} , active: boolean):Promise<City | undefined | void>{
    if(!updatedCity.nameCity.trim() || !updatedCity.province){
        toast.error('No se pueden enviar parámetros vacíos')
        return Promise.resolve(undefined)
    }

    if(active){
        return api.put(`/cities/${updatedCity.idCity}`,{
            nameCity:updatedCity.nameCity,
            province: updatedCity.province
        })
        .then(updated => {
            toast.success(`Localidad modificada con éxito`);
            return updated.data.data
        })
        .catch(err =>{
            const backendMsg = err.response?.data?.message || err.message;
            toast.error(`Error al crear Localidad: ${backendMsg}`);
        });
    }
    else{

        return api.patch(`/cities/${updatedCity.idCity}/toggle-state`)
        .then(()=>{
            toast.success(`Localidad reactivada con éxito`);
        })
        .catch(err => {
            toast.error(`Error al modificar Localidad: ${err.message}`);
        });
    };
}



