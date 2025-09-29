import { FaChevronRight, FaTimes, FaTrash } from "react-icons/fa";
import "../CRUDSModal.css";
import { useEffect, useRef, useState } from "react";

interface UserModalProps {
    visible: boolean;
    user: {
        email: string
        name: string;
        surname: string;
        docType: string;
        docNumber: string;
        phoneNumber:string;
        type: string;
        active: boolean;
    }|null;
    onClose: () => void;
    onDelete: () => void;
}

export function UserModal({visible, user, onClose, onDelete}:UserModalProps){

    const [userData, setUserData] = useState({email:"", name:"", surname:"", docType:"", docNumber:"", phoneNumber:"", type:"", active:true})
    const activateButtonRef = useRef<HTMLButtonElement| null>(null);

    useEffect(() => {
            if (visible && user) {
                setUserData({email:user.email, name:user.name, surname:user.surname, docType:user.docType, docNumber:user.docNumber, phoneNumber:user.phoneNumber, type:user.type, active:user.active});
            }
        }, [visible, user]);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 

        activateButtonRef.current?.click();

    }

    if (!visible|| !user) {
        return null;
    }

    return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
                 <div className="titleAndClose">
                    <h2 className="crud-modal-title">"Detalles del usuario"<FaChevronRight /></h2>
                        <FaTimes className="close-icon" onClick={onClose} />
                        </div>
                
                    <p className="input-crud">Email: {userData.email}</p>
                    <p className="input-crud">Nombre: {userData.name}</p>
                    <p className="input-crud">Apellido: {userData.surname}</p>
                    <p className="input-crud">Tipo Doc: {userData.docType}</p>
                    <p className="input-crud">Nro Doc: {userData.docNumber}</p>
                    <p className="input-crud">Teléfono:{userData.phoneNumber}</p>
                    <p className="input-crud">Tipo: {userData.type}</p>
                
                    <div className="buttons">
                        {user?.active === false ? (
                            <>
                               <button autoFocus ref={activateButtonRef} className="create-button">Activar</button>
                            </>):(
                            <>
                                <button autoFocus ref={activateButtonRef} type="button" className="delete-button">Eliminar<FaTrash /></button>
                            </>)}
                    </div>
                </div>
            </div>
            )
    }