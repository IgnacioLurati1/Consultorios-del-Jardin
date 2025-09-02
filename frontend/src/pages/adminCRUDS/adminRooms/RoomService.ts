import {toast} from "react-toastify";
import api from "../../../axios";
import type {Room} from "../../types.ts"

export function findAllRooms(): Promise<Room[]>{
    return api.get('/rooms')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener salas: ${err.message}`);
        return [];
    });
}

export function findAllActiveRooms(): Promise<Room[]>{
    return api.get('/rooms/active')
    .then(response => response.data.data)
    .catch(err => {
        toast.error(`Error al obtener salas: ${err.message}`);
        return [];
    });
}

export function createRoom(newRoom: { description: string; office: string }): Promise<Room | undefined>{
    if (!newRoom.description.trim() || !newRoom.office) {
        toast.error('Se necesitan los campos necesarios para crear una sala')
        return Promise.resolve(undefined);
    }

    return api.post('/Rooms', {
        description: newRoom.description,
        office: newRoom.office,
    })
    .then(created => {
        toast.success('Sala creada con éxito');
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        toast.error(`Error al crear Sala: ${backendMsg}`);
    });
}

export function removeRoom(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/rooms/${id}/toggle-state`)
        .then( ()=>{
            toast.success(`Sala eliminada con éxito`);
            return true;
        })
        .catch(err => {
            toast.error(`Error al eliminar sala: ${err.message}`)
            return false;
        });
}

export function updateRoom(updatedRoom: { idRoom: string; description: string; office: string} , active: boolean):Promise<Room | undefined | void>{
    if(!updatedRoom.description.trim() || !updatedRoom.office){
        toast.error('No se pueden enviar parámetros vacíos')
        return Promise.resolve(undefined)
    }

    if(active){
        return api.put(`/rooms/${updatedRoom.idRoom}`,{
            description:updatedRoom.description,
            office: updatedRoom.office
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



