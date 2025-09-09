/*import {toast} from "react-toastify";
import api from "../../../axios";
import type {Schedule} from "../types.ts"

export function findAllSchedules(): Promise<Schedule[]>{
    return api.get('/schedules')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener horarios: ${err.message}`);
        return [];
    });
}

export function findAllActiveSchedules(): Promise<Schedule[]>{
    return api.get('/schedules/active')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener horarios: ${err.message}`);
        return [];
    });
}

export function findProfessionalSchedules(professionalEmail: string): Promise<Schedule[]>{
    if(!professionalEmail) return Promise.resolve([])

    return api.get(`/by-email/${professionalEmail}`)
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener horarios del profesional: ${err.message}`);
        return [];
});



export function createSchedule(newSchedule: { day: string; initialHour: string; finalHour: string, Room:String, Person:string, allowedType: string}): Promise<Schedule | undefined>{
    if (!newSchedule.day.trim() || !newSchedule.initialHour.trim() || !newSchedule.finalHour.trim() || !newSchedule.Room || !newSchedule.Person || !newSchedule.allowedType.trim()) {
        toast.error('Se necesitan los campos necesarios para crear un horario')
        return Promise.resolve(undefined);
    }

    return api.post('/Schedules', {
        day: newSchedule.day,
        initialHour: newSchedule.initialHour,
        finalHour: newSchedule.finalHour,
        Room: newSchedule.Room,
        Person: newSchedule.Person,
        allowedType: newSchedule.allowedType,
        active:true
    })
    .then(created => {
        toast.success('Horario creada con éxito');
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        toast.error(`Error al crear Horario: ${backendMsg}`);
    });
}

export function removeSchedule(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/schedules/${id}/toggle-state`)
        .then( ()=>{
            toast.success(`Horario eliminada con éxito`);
            return true;
        })
        .catch(err => {
            toast.error(`Error al eliminar horario: ${err.message}`)
            return false;
        });
}

export function updateSchedule(updatedSchedule: { day: string; initialHour: string; finalHour: string, Room:String, Person:string, allowedType: string} , active: boolean):Promise<Schedule | undefined | void>{
    if(!updatedSchedule.day.trim() || !updatedSchedule.initialHour.trim() || !updatedSchedule.finalHour.trim() || !updatedSchedule.Room || !updatedSchedule.Person || !updatedSchedule.allowedType.trim()){
        toast.error('No se pueden enviar parámetros vacíos')
        return Promise.resolve(undefined)
    }

    if(active){
        return api.put(`/rooms/${updatedSchedule.Room}`,{
            day: newSchedule.day,
            initialHour: newSchedule.initialHour,
            finalHour: newSchedule.finalHour,
            Room: newSchedule.Room,
            Person: newSchedule.Person,
            allowedType: newSchedule.allowedType
        })
        .then(updated => {
            toast.success(`Sala modificada con éxito`);
            return updated.data.data
        })
        .catch(err =>{
            const backendMsg = err.response?.data?.message || err.message;
            toast.error(`Error al crear sala: ${backendMsg}`);
        });
    }
    else{

        return api.patch(`/rooms/${updatedRoom.idRoom}/toggle-state`)
        .then(()=>{
            toast.success(`Sala reactivada con éxito`);
        })
        .catch(err => {
            toast.error(`Error al modificar sala: ${err.message}`);
        });
    };
}
*/


