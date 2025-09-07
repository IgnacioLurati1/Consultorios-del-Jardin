//import type {Duration} from "../../types.ts";
import { useEffect, useState } from "react";
import { DurationLabel  } from "./DurationLabel";   
import {DurationModal} from "./DurationModal";
import "../../adminHome/AdminHome.css";
import "../adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaPlus } from "react-icons/fa";
import { ToastContainer } from "react-toastify";


interface Duration{
    idDuration: string,
    time:string,
    active:boolean
}

export function DurationsAdmin(){

    const [durations, setDurations] = useState<Duration[]>([])
    const [loading, setLoading] = useState(true);
    const [modalType, setModalType] = useState("")
    const [modalVisible, setModalVisible] = useState(false)
    const emptyDuration: Duration = {idDuration:"", time:"",active:true}
    const [editData, setEditData] = useState<Duration | null>(null)

    useEffect(() => {
        setDurations([
            { idDuration: "1", time: "15", active: true },
            { idDuration: "2", time: "30", active: true },
        ]);
        setLoading(false);
    }, []);

    function falsaFuncion(){

    }

    return (
        <div className="admin-home">

            <NavZone title="Administrador de Duraciones de turnos"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />

            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
                <ul className = "crud-list">
                    {durations.map(duration => (
                        <li key={duration.idDuration}
                        onClick={()=>{
                            setEditData(duration);
                            setModalVisible(true); 
                            setModalType("edit")
                            }}>
                            <DurationLabel key={duration.idDuration} duration={duration}></DurationLabel>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyDuration);setModalType("create")}}><strong>Agregar Duración</strong><FaPlus /></button>
            </div>
            <DurationModal visible={modalVisible} duration={editData} onEdit={()=>falsaFuncion()} onDelete={()=>falsaFuncion()} onCreate={()=>falsaFuncion()} onClose={()=> setModalVisible(false)} type = {modalType}/>
        </div>
    );
}