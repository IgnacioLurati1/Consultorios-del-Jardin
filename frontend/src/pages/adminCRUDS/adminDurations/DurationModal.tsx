import { useEffect, useState, useRef } from "react";
import "../CRUDSModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";

interface DurationModalProps {
    visible: boolean;
    duration:{
        idDuration: string,
        time:string,
        active:boolean
    } | null;
    
    /*
    onClose: () => void;
    onDelete: (idDuration: string) => void;
    onEdit : (updatedDuration:{
        idDuration: string,
        time:string,
        active:boolean
    }, 
    active: boolean
    ) => void;
    onCreate: (newDuration: {
        time:string,
    }) => void;
    
    */
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onCreate: () => void;
    type: string;
}

export function DurationModal({ visible, duration, onClose, onDelete, onEdit, onCreate, type }: DurationModalProps) {
    
    const [durationData, setDurationData] = useState({idDuration:"", time:"",active:true});

    useEffect(() => {
        if (visible && duration) {
            setDurationData({idDuration: duration.idDuration, time: duration.time, active:duration.active})
        }
    }, [visible, duration]);

    const activateButtonRef = useRef<HTMLButtonElement| null>(null);
    const createButtonRef = useRef<HTMLButtonElement| null>(null);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 

        if (type === "edit" && duration && duration.active === false){
            activateButtonRef.current?.click();
        } else if (type === "create") {
            createButtonRef.current?.click();
        }
    }


    function handleSubmit(){

        console.log("enviado")
        /*
        if(type === "edit"){
            onEdit(durationData, true)
        }else{
            onCreate({time: duration.time})
        }
            */
    }


    if (!visible|| (type ==="edit" && !duration)) {
        return null;
    }

    return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                    <div className="titleAndClose">
                    <h2 className="crud-modal-title">{type === "edit"?
                        "Detalles de la Duracion":"Crear Duración"}<FaChevronRight /></h2>
                        <FaTimes className="close-icon" onClick={onClose} />
                        </div>
    
                        {type === "edit" && duration? (
                        <div>
                            <p><strong> ID: {duration.idDuration}</strong></p>
                        </div>
                        ) : null}
                        <div>
                            <p>Tiempo:
                            <input
                                className={`input-crud`}
                                type="number"
                                min="0" 
                                max="120" step="15"
                                value={durationData.time}
                                onChange={(e) => setDurationData({ ...durationData, time: e.target.value })}
                            /></p>
                        </div>
                        <div className="buttons">
                            {type === "edit" && duration? (
                                duration.active === false ? (
                                    <>
                                    <button autoFocus ref={activateButtonRef} className="create-button" onClick={() => onEdit()}>Activar</button>
                                    </>
                                ):
                            <>
                            <button type="button" className="delete-button" onClick={() => {onDelete(); onClose()}} >Eliminar<FaTrash /></button>
                            <button type="button" className="edit-button" onClick={()=>handleSubmit()}>Modificar</button></>
                            ) : (<button autoFocus ref={createButtonRef} type="button" className="create-button"  onClick={()=>handleSubmit()}>Añadir</button>)}
                        </div>
                </div>
            </div>
        )
}