import api from "../../axios";
import type {Schedule, Person} from "../types.ts"

export function findAllProfessionals(): Promise<Person[]>{
    return api.get('/people/type/professional')
    .then(response => response.data.data)
    .catch(()=> {
        return [];
    });
}

export function findProfessionalSchedules(professionalEmail: string): Promise<Schedule[]>{
    if(!professionalEmail) return Promise.resolve([])

    return api.get(`/schedules/by-email/${professionalEmail}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
});
}

export function createSchedule(newSchedule: { day: string; initialHour: string; finalHour: string, room:String, personEmail:string, allowedType: string, duration: number}): Promise<Schedule | undefined>{
    console.log(newSchedule)
    
    if (!newSchedule.day.trim() || !newSchedule.initialHour.trim() || !newSchedule.finalHour.trim() || !newSchedule.room || !newSchedule.personEmail || !newSchedule.allowedType.trim() || !newSchedule.duration) {
        throw new Error('Se necesitan los campos necesarios para crear un horario');
    }

    return api.post('/schedules', {
        day: newSchedule.day,
        initialHour: newSchedule.initialHour,
        finalHour: newSchedule.finalHour,
        room: newSchedule.room,
        person: newSchedule.personEmail,
        allowedType: newSchedule.allowedType,
        duration: newSchedule.duration,
        active:true
    })
    .then(created => {
        return created.data.data
    })
    .catch(err =>{
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    })
}

export function removeSchedule(professionalEmail: string, day: string, initialHour:string): Promise<boolean>{
    if(!professionalEmail) return Promise.resolve(false)
    
    return api.patch(`/schedules/toggle/${professionalEmail}/${day}/${initialHour}`)
        .then( ()=>{
            return true;
        })
        .catch(err =>{
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        })
}

/*

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