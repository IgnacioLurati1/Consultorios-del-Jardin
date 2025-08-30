import { useEffect, useState, useRef } from "react";
import "../CRUDSModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";

interface CityModalProps {
    visible: boolean;
    city: {
        idCity: string;
        nameCity: string;
        province: {
            idProvince: string;
            nameProvince: string;
            active?: boolean
        };
        active: boolean;
    } | null;
    provinces: {idProvince:string, nameProvince:string}[];
    onClose: () => void;
    onDelete: (idCity: string) => void;
    onEdit : (Updatedcity: {
        idCity: string;
        nameCity: string;
        province:  string;
    }, 
    active: boolean
    ) => void;
    onCreate: (newCity: {
        nameCity: string;
        province: string;
    }) => void;
    type: string;
}

export function CityModal({ visible, city, provinces, onClose, onDelete, onEdit, onCreate, type }: CityModalProps) {
    const [cityData, setCityData] = useState({ idCity: "", nameCity: "", province:"", active:true   });
    const [provinceName, setProvinceName] = useState("");

    useEffect(() => {
        if (visible && city) {
            setCityData({idCity: city.idCity, nameCity: city.nameCity, province: city.province.idProvince, active: city.active});
            setProvinceName(city.province.nameProvince);
        }
    }, [visible, city]);

    const activateButtonRef = useRef<HTMLButtonElement| null>(null);
    const createButtonRef = useRef<HTMLButtonElement| null>(null);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 

        if (type === "edit" && city && city.active === false){
            activateButtonRef.current?.click();
        } else if (type === "create") {
            createButtonRef.current?.click();
        }
    }

    

    if (!visible|| (type ==="edit" && !city)) {
        return null;
    }

    if(provinces.length === 0) {
        return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="titleAndClose">
                        <h2 className="crud-modal-title">{type === "edit"?
                            "Detalles de la Localidad":"Crear Localidad"}<FaChevronRight />
                        </h2>

                        <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    {type === "edit" && city? (
                        <div>
                            <p><strong> ID: {city.idCity}</strong></p>
                        </div>
                    ) : null}
                    {city && type === "edit" ? (<div>
                        <p>Nombre: {cityData.nameCity}</p>
                        <p>Provincia: {provinceName}    <strong>(Inhabilitada)</strong></p>
                        No es posible modificar la Localidad porque no hay provincias disponibles.
                        </div>) : 
                        (<div>
                        No es posible crear una Localidad porque no hay provincias disponibles.
                        </div>)}
                </div>
            </div>
        );
    }

    if (type == "edit" && city && city.province.active=== false) {
        return (
            <div className="crud-modal" onClick={onClose}>
                <div className ="crud-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="titleAndClose">
                        <h2 className="crud-modal-title">
                        "Detalles de la Localidad":<FaChevronRight />
                        </h2>
                        <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    <p><strong> ID: {city.idCity}</strong></p>
                    <div>
                        <p>Nombre: {cityData.nameCity}</p>
                        <p>Provincia: {provinceName}    <strong>(Inhabilitada)</strong></p>
                        No es posible modificar la Localidad porque la provincia a la que pertenece se encuentra inhabilitada. Reactivela si desea continuar.
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
                    "Detalles de la Localidad":"Crear Localidad"}<FaChevronRight /></h2>
                    <FaTimes className="close-icon" onClick={onClose} />
                    </div>
                    {type === "edit" && city? (
                    <div>
                        <p><strong> ID: {city.idCity}</strong></p>
                    </div>
                    ) : null}
                    <div>
                        <p>Nombre:
                        <input
                            className="input-crud"
                            type="text"
                            value={cityData.nameCity}
                            onChange={(e) => setCityData({ ...cityData, nameCity: e.target.value })}
                        /></p>
                    </div>
                    <div>
                        <label>Provincia:</label>
                        <input
                            className="input-crud"
                            type="text"
                            list = "provinces"
                            value={provinceName}
                            onChange={e => {
                            const value = e.target.value;
                            setProvinceName(value);

                            const selectedProvince = provinces.find(p => p.nameProvince === value);

                            if (selectedProvince) {
                            setCityData({ ...cityData, province: selectedProvince.idProvince });
                            } else {
                            setCityData({ ...cityData, province:"" });
                            }}}

                            onBlur = {() => {
                                if (!provinces.find(p => p.nameProvince === provinceName)) {
                                    toast.dismiss();
                                    toast.error("Provincia inválida");
                                    setCityData({ ...cityData, province:""});
                            }}}
                        />
                        <datalist id="provinces">  
                            {provinces.map((province) => (
                                <option key={province.idProvince} value={province.nameProvince}/>
                            ))}
                        </datalist>
                    </div>
                    <div className="buttons">
                        {type === "edit" && city? (
                            city.active === false ? (
                                <>
                                <button autoFocus ref={activateButtonRef} className="create-button" onClick={() => onEdit(cityData, false)}>Activar</button>
                                </>
                            ):
                        <>
                        <button type="button" className="delete-button" onClick={() => {onDelete(cityData.idCity); onClose()}} >Eliminar<FaTrash /></button>
                        <button type="submit" className="edit-button" onClick={()=>onEdit(cityData, true)}>Modificar</button></>
                        ) : (<button autoFocus ref={createButtonRef} type="submit" className="create-button"  onClick={()=>onCreate({nameCity: cityData.nameCity, province:cityData.province})}>Añadir</button>)}
                    </div>
            </div>
        </div>
    )
}