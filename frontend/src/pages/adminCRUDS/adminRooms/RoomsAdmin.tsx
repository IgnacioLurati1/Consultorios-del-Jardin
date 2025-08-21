import { useEffect, useState } from "react";
import { RoomLabel  } from "./RoomLabel";   
import {RoomModal} from "./RoomModal";
import "../../adminHome/AdminHome.css";
import "../adminCRUDS.css";
import "./RoomLabelStyle.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaSearch } from 'react-icons/fa';
import { FaPlus } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";

export function RoomsAdmin() {
    
    interface Province {
        idProvince: string;
        nameProvince: string;
        active?: boolean;
    }

    interface City {
        idCity: string;
        nameCity: string;
        province: Province;
        active?: boolean;
    }

    interface Office {
        idOffice: string;
        description: string;
        openingTime: string;
        closingTime: string;
        city: City
        active?: boolean;
    }

    interface Room {
        idRoom: string;
        description: string;
        office: Office;
        active: boolean;
    }

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
    fetch("/api/offices")
        .then(res => res.json())
        .then(data => {
            setOffices(data.data.filter((office: Office) => office.active));
            setLoading(false); })
        .catch(err => {
            setLoading(false);
            toast.error("Error cargando oficinas:" + err)});
    }, []);

    useEffect(() => {
    fetch("/api/cities")
        .then(res => res.json())
        .then(data => {
            setCities(data.data.filter((city: City) => city.active));
            setLoading(false); })
        .catch(err => {
            setLoading(false);
            toast.error("Error cargando ciudades:" + err)});
    }, []);

    useEffect(() => {
        fetch("/api/rooms")
        .then(res => res.json())
        .then(data => {
            setRooms(data.data)
            setFilteredRooms(
                data.data.sort((a: Room, b: Room) => {
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
        })
        .catch(err => {
            setLoading(false);
            toast.error("Error cargando salas: " + err.message);});
    }, []);
    useEffect(() => {
        setFilteredRooms(
            rooms.filter((room: Room) => room.description.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, rooms]);

    function addRoom(newRoom: { description: string; office: string }) {
            fetch("/api/rooms", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newRoom),
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(res.statusText);
                }
                return res.json();})
            .then(response => {
                setRooms([response.data, ...rooms]);
                setModalVisible(false);
                toast.success("Sala creada exitosamente");
            })
            .catch(err => {
                toast.error('Error al crear sala: ' + err.message);
            });
        }

    function deleteRoom(id: string) {
    if (!id) return;

    fetch(`/api/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
    })
        .then(async(res) => {
            if(!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || res.statusText);
            }
            return res.json();
        })
        .then(() => {
            setRooms(rooms.map(room => room.idRoom !== id ? room : { ...room, active: false }));
            setModalVisible(false);
            toast.success("Sala eliminada exitosamente");
        })
            .catch(err => {
                toast.error('Error al eliminar sala: ' + err.message);
        });
    }

    function EditRoom(updatedRoom: { idRoom: string; description: string; office: string} , active: boolean) {
        if (!editData) return;
        if(active){
        fetch(`/api/rooms/${updatedRoom.idRoom}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                description: updatedRoom.description,
                office: updatedRoom.office,
            }),
        })
        .then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || res.statusText);
                console.log(res.statusText);
            }
            return res.json();})
        .then(response => {
                const updatedRoomFromBackend = response.data;
                setRooms(rooms.map(room => room.idRoom === updatedRoomFromBackend.idRoom ? updatedRoomFromBackend : room));
                setModalVisible(false);
                setEditData(null);
                toast.success("Sala editada exitosamente");
            }
        )
        .catch(err => {
            toast.error('Error al editar sala: ' + err.message);
        })}
        else{
            fetch(`/api/rooms/${updatedRoom.idRoom}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    active: true
                }),
            })
            .then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || res.statusText);
                }
                return res.json();})
            .then(response => {
                    const updatedRoomFromBackend = response.data;
                    setRooms(rooms.map(room => room.idRoom !== updatedRoomFromBackend.idRoom ? room : { ...room, active: true }));
                    setModalVisible(false);
                    setEditData(null);
                    toast.success("Sala reactivada exitosamente");
                }
            )
            .catch(err => {
                toast.error('Error reactivar sala: ' + err.message);
            });  
        }
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="admin-home">

            <NavZone title="Administrador de Salas"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <div className="crud-searchBar">
                <FaSearch className="search-icon"/>
                <input className="crud-searchInput"
                type="text"
                placeholder="Ingrese el nombre de la sala"
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="crud-grid">
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
                </ul>
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyRoom);setModalType("create")}}><strong>Agregar sala</strong><FaPlus /></button>
            </div>
            <RoomModal visible={modalVisible} room={editData} offices={offices} cities={cities} onClose={()=> setModalVisible(false)} onEdit={EditRoom} onDelete={deleteRoom} onCreate={addRoom} type = {modalType}/>
        </div>
    );

}