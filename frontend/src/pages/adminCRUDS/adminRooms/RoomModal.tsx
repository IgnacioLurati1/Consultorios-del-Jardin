import { useEffect, useState, useRef } from "react";
import "../CRUDSModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaExclamationTriangle } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import type {Office} from "../../types.ts"
import type {RoomModalProps} from "./typesRoom.tsx"

export function RoomModal({ visible, room, offices, cities, onClose, onDelete, onEdit, onCreate, type }: RoomModalProps) {

    const [roomData, setRoomData] = useState({ idRoom: "", description: "", office: "", active:true   });
    const [officeDescription, setOfficeDescription] = useState("");
    const [filteredOffices, setFilteredOffices] = useState<Office[]>(offices);
    const [cityName, setCityName] = useState("");
    const [errors, setErrors] = useState<{ description?:string, office?: string}>({});

    useEffect(() => {
        if (visible && room) {
            setRoomData({idRoom: room.idRoom, description: room.description, office: room.office.idOffice, active: room.active});
            setOfficeDescription(room.office.description);
            setCityName(room.office.city.nameCity);
            setErrors({});
        }
    }, [visible, room]);

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

    function validateInputs(){
        const newErrors: typeof errors = {};

        if(!roomData.description.trim()){
            newErrors.description = "La descripción es obligatoria"
        }

        if(!roomData.office){
            newErrors.office = "Se debe elegir un consultorio"
        }

        setErrors(newErrors);

        if( Object.keys(newErrors).length ===0){
            return true
        }else 
            {return false}
    }

    function handleSubmit(){

        if(!validateInputs()) {
            console.log("Validación fallida", errors)
        return;}

        if(type === "edit"){
            onEdit(roomData, true)
        }else{
            onCreate({description: roomData.description, office:roomData.office})
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
                    <h2 className="crud-modal-title">{type === "edit"?
                        "Detalles de la Sala":"Crear Sala"}<FaChevronRight />
                    </h2>
                    <FaTimes className="close-icon" onClick={onClose}/>
                </div>
                <div>
                    {type === "edit" && room? (   
                        <p>ID: {room.idRoom}</p>
                    ) : null}
                </div>
                <div className="crud-input-container">
                    <label>Descripción:</label>
                    <input
                        className={`input-crud ${errors.description? "input-error" : "input-valid"}`}
                        type="text"
                        value={roomData.description}
                        onChange={(e) => 
                            setRoomData({ ...roomData, description: e.target.value })}
                    />
                    <div className="error-container">
                        {errors.description &&
                        <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.description}
                            </div>
                        }
                    </div>
                    
                </div>

                <div className="crud-input-container">
                    <label>Ciudad:</label>
                    <input
                        className="input-crud input-valid"
                        type="text"
                        list = "cities"
                        value = {cityName}
                        placeholder="Seleccione una ciudad"
                        onFocus={() => {
                            setCityName("");
                            setOfficeDescription("");
                            setFilteredOffices(offices);
                            }}
                        onChange={e => {
                            
                            const value = e.target.value;
                            setCityName(value);

                            const selectedCity = cities.find(p => p.nameCity === value);

                            if (selectedCity) {
                            setFilteredOffices(offices.filter(office => office.city.idCity === selectedCity.idCity));
                        }}}

                        onBlur = {() => {
                            if (!cities.find(p => p.nameCity === cityName)) {
                                toast.dismiss();
                                setErrors(prev => ({...prev, office: "Ciudad inválida"}))
                                setFilteredOffices(offices);
                        }else {
                            setErrors(prev => {
                                const { office, ...rest } = prev;
                                return rest;
                                });
                        }}}
                    />
                    <datalist id="cities">  
                        {cities.map((city) => (
                            <option key={city.idCity} value={city.nameCity}/>
                        ))}
                    </datalist>
                    <div>{/*Espacio para alinear inputs*/}</div>
                    
                </div>

                <div className="crud-input-container">
                    <label>Oficina:</label>
                    <input
                        className={`input-crud ${errors.office? "input-error" : "input-valid"}`}
                        type="text"
                        list = "offices"
                        value={officeDescription}
                        placeholder="Seleccione una oficina"
                        onFocus={() => {
                            setOfficeDescription("");
                            }}
                        onChange={e => {
                        const value = e.target.value;
                        setOfficeDescription(value);
                        

                        const selectedOffice = offices.find(p => p.description === value);

                        if (selectedOffice) {
                        setRoomData({ ...roomData, office: selectedOffice.idOffice });
                        setCityName(selectedOffice.city.nameCity);
                        } else {
                        setRoomData({ ...roomData, office:"" });
                        }}}

                        onBlur = {() => {
                            if (!offices.find(p => p.description === officeDescription)) {
                                toast.dismiss();
                                setRoomData({ ...roomData, office:""});
                        }else {
                            setErrors(prev => {
                                const { office, ...rest } = prev;
                                return rest;
                                });
                        }}}
                    />
                    <datalist id="offices">  
                        
                        {cityName && filteredOffices.map((office) => (
                            <option key={office.idOffice} value={office.description}/>
                        ))}
                    </datalist>
                    <div className="error-container">
                        {errors.office && 
                            <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.office}
                            </div>}
                    </div>

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
                    <button type="submit" className="edit-button" onClick={()=>handleSubmit()}>Modificar</button></>
                    ) : (<button autoFocus ref={createButtonRef} type="submit" className="create-button"  onClick={()=>handleSubmit()}>Añadir</button>)}
                </div>

            </div>
        </div>
    )
}

