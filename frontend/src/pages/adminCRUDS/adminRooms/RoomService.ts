import api from "../../../axios";
import type {Room} from "../../types.ts"

interface DBRoom {
    id_room: string;
    description:  string;
    office_id_office: number;
}

export function findAllRooms(): Promise<Room[]>{
    return api.get('/rooms')
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function findAllActiveRooms(): Promise<Room[]>{
    return api.get('/rooms/active')
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}

export function createRoom(newRoom: { description: string; office: string }): Promise<Room | undefined>{
    if (!newRoom.description.trim() || !newRoom.office) {
        throw new Error('Se necesitan los campos necesarios para crear una sala');
    }

    return api.post('/Rooms', {
        description: newRoom.description,
        active: true,
        office: newRoom.office
    })
    .then(created => {
        return created.data.data
    })
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function removeRoom(id: string): Promise<boolean>{
    if(!id) return Promise.resolve(false)
    
    return api.patch(`/rooms/${id}/toggle-state`)
        .then( ()=>{
            return true;
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
}

export function updateRoom(updatedRoom: { idRoom: string; description: string; office: string} , active: boolean):Promise<Room | undefined | void>{
    if(!updatedRoom.description.trim() || !updatedRoom.office){
        throw new Error('Se necesitan los campos necesarios para modificar una sala');
    }

    if(active){
        return api.put(`/rooms/${updatedRoom.idRoom}`,{
            description:updatedRoom.description,
            office: updatedRoom.office
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

        return api.patch(`/rooms/${updatedRoom.idRoom}/toggle-state`)
        .then(()=>{
            return;
        })
        .catch(err => {
            const backendMsg = err.response?.data?.message || err.message;
            throw new Error(backendMsg);
        });
    };
}

export function findRoomsByOfficeAndProfessional(officeId: string, professionalEmail: string): Promise<DBRoom[]> {
    return api.get(`/rooms/office/professional/${officeId}/${professionalEmail}`)
    .then(response => response.data.data)
    .catch(() => {
        return [];
    });
}


