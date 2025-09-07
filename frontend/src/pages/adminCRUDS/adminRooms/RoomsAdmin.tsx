import { useEffect, useState } from "react";
import { RoomLabel  } from "./RoomLabel";   
import {RoomModal} from "./RoomModal";
import "../../adminHome/AdminHome.css";
import "../adminCRUDS.css";
import "./RoomLabelStyle.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaPlus } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import type {City,Office,Room} from "../../types.ts" //Puede que province sea necesario
import { findAllActiveCities} from "../adminCities/CityService.ts"
//import { findAllActiveOffices} from "../adminOffices/OfficeService.ts" //--------FALTA LO DE ALAN -
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

    useEffect(() => { //Se cambia fetch por findAllActiveOffices cuando Alan lo tenga listo
    fetch("/api/offices")
        .then(res => res.json())
        .then(data => {
            setOffices(data.data.filter((office: Office) => office.active));
            setLoading(false); })
        .catch(err => {
            setLoading(false);
            toast.error("Error cargando oficinas:" + err)});
    }, []);

    /*useEffect(() => {
        findAllActiveOffices()
        .then(data => {
        setOffices(data);
        setLoading(false); })
    }, []);  --------- FALTA LO DE ALAN - luego se implementa este codigo y se borra el de arriba*/

    useEffect(() => {
        findAllActiveCities()
        .then(data => {
            setCities(data);
            setLoading(false); })
        .catch(err => {
            setLoading(false);
            toast.error("Error cargando ciudades:" + err)});
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
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        setFilteredRooms(
            rooms.filter((room: Room) => room.description.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, rooms]);

    async function addRoom(newRoom: { description: string; office: string }) {
        const createdRoom = await createRoom(newRoom)
        if(createdRoom){
            setRooms([createdRoom, ...rooms]);
            setModalVisible(false);
        }
    }

    async function deleteRoom(id: string) {
    if (await removeRoom(id)){
        setRooms(rooms.map(room => room.idRoom !== id ? room : { ...room, active: false }));
        setModalVisible(false);
        }
    }

    async function EditRoom(updatedRoom: { idRoom: string; description: string; office: string} , active: boolean) {

        const updatedRoomFromBackend = await updateRoom(updatedRoom, active);
        if(active && updatedRoomFromBackend){
            setRooms(rooms.map(room => room.idRoom === updatedRoomFromBackend.idRoom ? updatedRoomFromBackend : room));
            setModalVisible(false);
            setEditData(null);
        }else if(!active){
            setRooms(rooms.map(room => room.idRoom !== updatedRoom.idRoom ? room : { ...room, active: true }));
            setModalVisible(false);
            setEditData(null);
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
                {rooms.length === 0 ? (
                    <div className= "no-content"> No hay salas cargadas </div>
                ):(
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