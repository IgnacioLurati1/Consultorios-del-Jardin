import api from "../../../axios";
import type {Office} from "../../types.ts"

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

export function createOffice(newDescription: string, newOpeningTime: string, newClosingTime: string, cityId: string): Promise<Office | undefined>{
    if(!newDescription.trim() || !newOpeningTime || !newClosingTime || !cityId){
        throw new Error('Se necesitan todos los campos compleatados para crear una sala');
    }

    return api.post('/offices',{
        description: newDescription, 
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

export function updateOffice(id: string, newDescription: string, newOpeningTime: string, newClosingTime: string, cityId: string, active: boolean): Promise<Office | void | undefined>{
    if(!newDescription.trim() || !newOpeningTime || !newClosingTime || !cityId){
        throw new Error('Se necesitan todos los campos compleatados para modificar una sala');
    }

    if(active){
        return api.put(`/offices/${id}`,{
            description: newDescription,
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