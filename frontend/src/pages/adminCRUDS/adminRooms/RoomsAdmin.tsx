import { useEffect, useState } from "react";
import { RoomLabel  } from "./RoomLabel";   
import {RoomModal} from "./RoomModal";
import "../../homePages/adminHome/AdminHome.css"
import "../adminCRUDS.css";
import "./RoomLabelStyle.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaPlus } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import type {City,Office,Room} from "../../types.ts"
import { findAllActiveCities} from "../adminCities/CityService.ts"
import { findAllActiveOffices} from "../adminOffices/OfficeService.ts"
import SearchBar from "../../../components/searchBar/searchBar.tsx";
import { findAllRooms, createRoom, updateRoom, removeRoom} from "./RoomService.ts";

export function RoomsAdmin() {

    const [cities, setCities] = useState<City[]>([]);
    const [offices, setOffices] = useState<Office[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editData, setEditData] = useState<Room | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalType, setModalType] = useState("");
    const emptyRoom: Room = {
        idRoom: "",
        description: "",
        active: true,
        office: {
            idOffice: "",
            description: "",
            openingTime: "",
            closingTime: "",
            active: true,
            city: {
                idCity: "",
                nameCity: "",
                active: true,
                    province: {
                        idProvince: "",
                        nameProvince: "",
                        active: true,
                    }
                }
            }
        };

    useEffect(() => {
        findAllActiveOffices()
        .then(data => {
            setOffices(data);
            setLoading(false); 
        })
        .catch(err => {
            setLoading(false);
            toast.error(`Error cargando consultorios: ${err.message}`);    
        });
    }, []);

    useEffect(() => {
        findAllActiveCities()
        .then(data => {
            setCities(data);
        })
        .catch(err => {
            toast.error(`Error cargando ciudades: ${err.message}` )});
    }, []);

    useEffect(() => {
        findAllRooms()
        .then(data => {
            setRooms(data)
            setFilteredRooms(
                data.sort((a: Room, b: Room) => {
                    function weight(room: Room) {
                    if (room.office.active) {
                        return room.active ? 1 : 2;  // oficina activa: sala activa=1, sala inactiva=2
                    } else {
                        return room.active ? 3 : 4;  // oficina inactiva: sala activa=3, sala inactiva=4
                    }
                    }
                    return weight(a) - weight(b);
                })
                );
        })
        .catch(err => {   
            toast.error(`Error cargando salas: ${err.message}`)});
    }, []);

    useEffect(() => {
        setFilteredRooms(
            rooms.filter((room: Room) => room.description.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, rooms]);

    async function addRoom(newRoom: { description: string; office: string }) {
        try{
        const createdRoom = await createRoom(newRoom)
        if(createdRoom){
            setRooms([createdRoom, ...rooms]);
            toast.success(`Sala creada con éxito`);
            setModalVisible(false);
        }
    } catch (error:any){
        toast.error(`Error al crear la Sala: ${error.message}`);
    }
}

    async function deleteRoom(id: string) {
        try{
    if (await removeRoom(id)){
        setRooms(rooms.map(room => room.idRoom !== id ? room : { ...room, active: false }));
        toast.success(`Sala eliminada con éxito`);
        setModalVisible(false);
        }
    } catch (error:any){
        toast.error(`Error al eliminar la Sala: ${error.message}`);
    }
}

    async function EditRoom(updatedRoom: { idRoom: string; description: string; office: string} , active: boolean) {
        try{
        const updatedRoomFromBackend = await updateRoom(updatedRoom, active);
        if(active && updatedRoomFromBackend){
            setRooms(rooms.map(room => room.idRoom === updatedRoomFromBackend.idRoom ? updatedRoomFromBackend : room));
            toast.success(`Sala modificada con éxito`);
            setModalVisible(false);
            setEditData(null);
        }else if(!active){
            setRooms(rooms.map(room => room.idRoom !== updatedRoom.idRoom ? room : { ...room, active: true }));
            toast.success(`Sala reactivada con éxito`);
            setModalVisible(false);
            setEditData(null);
        }
    } catch (error:any){
        toast.error(`Error al modificar la Sala: ${error.message}`);
    }
}

    return (
        <div className="admin-home">

            <NavZone title="Administrador de Salas"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese el nombre de una sala" />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
                {rooms.length === 0 && !loading ? (
                    <div className= "no-content"> No hay salas cargadas </div>
                ): !loading && (
                <ul className = "crud-list">
                    {filteredRooms.map(room => (
                        <li key={room.idRoom}
                        onClick={()=>{
                            setEditData(room);
                            setModalVisible(true); 
                            setModalType("edit")
                            }}>
                            
                            <RoomLabel key={room.idRoom} room={room} active={room.active}></RoomLabel>
                        </li>
                    ))}
                </ul>)}   
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyRoom);setModalType("create")}}><strong>Agregar sala</strong><FaPlus /></button>
            </div>
            <RoomModal visible={modalVisible} room={editData} offices={offices} cities={cities} onClose={()=> setModalVisible(false)} onEdit={EditRoom} onDelete={deleteRoom} onCreate={addRoom} type = {modalType}/>
        </div>
    );

}