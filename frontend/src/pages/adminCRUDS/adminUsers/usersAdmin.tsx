import "../adminCRUDS.css"
import { FaPlus } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import { NavZone } from "../../../components/navZone/NavZone";
import SearchBar from "../../../components/searchBar/searchBar";
import { UserLabel } from "./userLabel";
import { getAllUsers } from "./usersService";
import { useEffect, useState } from "react";
import type { Person } from "../../types";
import { UserModal } from "./userModal";


export function UsersAdmin(){

    const[users, setUsers] = useState<Person[]>([])
    const[loading, setLoading] = useState(true)
    const [filteredUsers, setFilteredUsers] = useState<Person[]>([])
    const [searchTerm, setSearchTerm] = useState('');
    const [modalData, setModalData]=useState<Person|null>(null)
    const [modalVisible, setModalVisible] = useState(false)

    useEffect(()=>{
        getAllUsers()
        .then(res => {
            setUsers(res);
            setLoading(false)}
            )
        .catch(err => {toast.error(`Error al obtener los usuarios ${err.message}`)});
    },[])
    
    useEffect(() => {
        const normalize = (str: string) =>
            str
                ?.normalize("NFD")
                .replace(/\p{Diacritic}/gu, "")
                .replace(/\s+/g, "")
                .toLowerCase();

        const search = normalize(searchTerm);

        setFilteredUsers(
            users.filter((user: Person) => {
                return (
                    normalize(user.name).includes(search) ||
                    normalize(user.surname).includes(search) ||
                    normalize(user.email).includes(search)
                );
            })
        );
    }, [searchTerm, users]);

    return (
            <div className="admin-home">
    
                <NavZone title="Administrador de Usuarios"/>
                <ToastContainer 
                    className = {`toast-container`}
                    draggable={false}
                />
                <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese el nombre, apellido o email del usuario" />
                <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
                    <ul className = "crud-list">
                        {filteredUsers.map(user => (
                            <li key={user.email}
                            onClick={()=>{
                                setModalData(user);
                                setModalVisible(true); 
                                }}>
                                <UserLabel key={user.email} user={user}></UserLabel>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <button className="crud-add-button" onClick={()=>{}}><strong>Registrar profesional</strong><FaPlus /></button>
                </div>
                <UserModal visible= {modalVisible} user={modalData} onClose={()=>setModalVisible(false)} onDelete={()=>{}}></UserModal>
            </div>
        );
}