import api from "../../../axios";
import type {City} from "../../types.ts"

export function findAllCities(): Promise<City[]>{
    return api.get('/cities')
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function findAllActiveCities(): Promise<City[]>{
    return api.get('/cities/active')
    .then(response => response.data.data)
    .catch(()=> {
        return [];
    });
}

export function createCity(newCity: { nameCity: string; province: string }): Promise<City | undefined>{
    if (!newCity.nameCity.trim() || !newCity.province) {
        throw new Error('Se necesitan los campos necesarios para crear una localidad');
    }

    return api.post('/Cities', {
        nameCity: newCity.nameCity,
        province: newCity.province,
    })
    .then(created => {
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function removeCity(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/cities/${id}/toggle-state`)
        .then( ()=>{
            return true;
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
}

export function updateCity(updatedCity: { idCity: string; nameCity: string; province: string} , active: boolean):Promise<City | undefined | void>{
    if(!updatedCity.nameCity.trim() || !updatedCity.province){
        throw new Error('Se necesitan los campos necesarios para modificar una localidad');
    }

    if(active){
        return api.put(`/cities/${updatedCity.idCity}`,{
            nameCity:updatedCity.nameCity,
            province: updatedCity.province
        })
        .then(updated => {
            return updated.data.data
        })
        .catch(err =>{
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
    }
    else{

        return api.patch(`/cities/${updatedCity.idCity}/toggle-state`)
        .then(()=>{
            return;
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
    };
}