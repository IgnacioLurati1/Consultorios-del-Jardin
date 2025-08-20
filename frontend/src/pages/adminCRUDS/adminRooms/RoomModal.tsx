import { useEffect, useState, useRef } from "react";
import "../CRUDSModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";

interface RoomModalProps {
    visible: boolean;

    room: {
        idRoom: string;
        description: string;
        active: boolean;
        office: {
            idOffice: string;
            description: string;
            openingTime: string;
            closingTime: string;
            active?: boolean;
            city: {
                idCity: string;
                nameCity: string;
                active?: boolean;
                province: {
                    idProvince: string;
                    nameProvince: string;
                    active?: boolean;
                };
            };
        };
    } | null;

    offices: {idOffice:string, 
                description: string,
                openingTime: string,
                closingTime: string;}[];

    onClose: () => void;
    onDelete: (idRoom: string) => void;
    onEdit : (UpdatedRoom: {
        idRoom: string;
        description: string;
        office: string;
    }, 
    active: boolean
    ) => void;
    onCreate: (newRoom: {
        description: string;
        office: string;
    }) => void;
    type: string;
}

export function RoomModal({ visible, room, offices, onClose, onDelete, onEdit, onCreate, type }: RoomModalProps) {

    const [roomData, setRoomData] = useState({ idRoom: "", description: "", office:"", active:true   });
    const [officeDescription, setOfficeDescription] = useState("");

    useEffect(() => {
        if (room) {
            setRoomData({idRoom: room.idRoom, description: room.description, office: room.office.idOffice, active: room.active});
            setOfficeDescription(room.office.description);
        }
    }, [room]);

    const activateButtonRef = useRef<HTMLButtonElement| null>(null);
    const createButtonRef = useRef<HTMLButtonElement| null>(null);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 

        if (type === "edit" && room && room.active === false){
            activateButtonRef.current?.click();
        } else if (type === "create") {
            createButtonRef.current?.click();
        }
    }

    

    if (!visible|| (type ==="edit" && !room)) {
        return null;
    }

    if(offices.length === 0) {
        return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="titleAndClose">
                        <h2 className="crud-modal-title">
                            {type === "edit" ? "Detalles de la Sala":"Crear Sala"} <FaChevronRight />
                        </h2>
                        
                        <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    {room && type === "edit" ? (
                        <div>
                            {type === "edit" && room? (
                                <p>ID: {room.idRoom}</p>
                            ) : null}
                            <p>Descripcion: {roomData.description}</p>
                            <p>Oficina: {officeDescription}    <strong>(Inhabilitada)</strong></p>
                            No es posible modificar la sala porque no hay oficinas disponibles.
                        </div>) : 
                        (<div>
                            No es posible crear una sala porque no hay oficinas disponibles.
                        </div>)}
                </div>
            </div>
        );
    }

    if (type == "edit" && room && room.office.active === false) {
        return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="titleAndClose">
                        <h2 className="crud-modal-title">
                        "Detalles de la Sala":<FaChevronRight />
                        </h2>
                        
                        <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    <div>
                        <p>ID: {room.idRoom}</p>
                        <p>Nombre: {roomData.description}</p>
                        <p>Provincia: {officeDescription}    <strong>(Inhabilitada)</strong></p>
                        No es posible modificar la Sala porque la oficina a la que pertenece se encuentra inhabilitada. Reactivela si desea continuar.
                    </div>
                </div>
            </div>
            );
    }


    return (
        <div className="crud-modal" onClick={onClose}>
            <div className ="crud-modal-content" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                <div className="titleAndClose">
                <h2>{type === "edit"?
                    "Detalles de la Sala":"Crear Sala"}<FaChevronRight /></h2>
                    {type === "edit" && room? (
                    <div>
                        <p><strong> ID: {room.idRoom}</strong></p>
                    </div>
                    ) : null}
                    <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    <div>
                        <p>Descripción:
                        <input
                            className="input-crud"
                            type="text"
                            value={roomData.description}
                            onChange={(e) => setRoomData({ ...roomData, description: e.target.value })}
                        /></p>
                    </div>
                    <div>
                        <label>Oficinas:</label>
                        <select
                            className="input-crud"
                            value={officeDescription}
                            onChange={e => {
                            const value = e.target.value;
                            setOfficeDescription(value);

                            const selectedOffice = offices.find(p => p.description === value);

                            if (selectedOffice) {
                            setRoomData({ ...roomData, office: selectedOffice.description });
                            } else {
                            setRoomData({ ...roomData, office:"" });
                            }}}
                            onBlur = {() => {
                                if (!offices.find(p => p.description === officeDescription)) {
                                    toast.dismiss();
                                    toast.error("Provincia inválida");
                                    setRoomData({ ...roomData, office:""});
                            }}}
                        >
                            {offices.map((office) => (
                                <option key={office.idOffice} value={office.description}> {office.description} </option>
                            ))}
                        </select>
                    </div>
                    <div className="buttons">
                        {type === "edit" && room? (
                            room.active === false ? (
                                <>
                                <button autoFocus ref={activateButtonRef} className="create-button" onClick={() => onEdit(roomData, false)}>Activar</button>
                                </>
                            ):
                        <>
                        <button type="button" className="delete-button" onClick={() => {onDelete(roomData.idRoom); onClose()}} >Eliminar<FaTrash /></button>
                        <button type="submit" className="edit-button" onClick={()=>onEdit(roomData, true)}>Modificar</button></>
                        ) : (<button autoFocus ref={createButtonRef} type="submit" className="create-button"  onClick={()=>onCreate({description: roomData.description, office:roomData.office})}>Añadir</button>)}
                    </div>
            </div>
        </div>
    )
}