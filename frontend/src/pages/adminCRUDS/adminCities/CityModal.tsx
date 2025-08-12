import { useEffect, useState } from "react";

interface CityModalProps {
    visible: boolean;
    city: {
        idCity: string;
        nameCity: string;
        province: {
            idProvince: string;
            nameProvince: string;
        };
        
    } | null;
    provinces: {idProvince:string, nameProvince:string}[];
    onClose: () => void;
    onDelete: (idCity: string) => void;
    onEdit : (Updatedcity: {
        idCity: string;
        nameCity: string;
        province:  string;
    }
    ) => void;
    onCreate: (newCity: {
        nameCity: string;
        province: string;
    }) => void;
    type: string;
}

export function CityModal({ visible, city, provinces, onClose, onDelete, onEdit, onCreate, type }: CityModalProps) {
    const [cityData, setCityData] = useState({ idCity: "", nameCity: "", province:""   });
    const [provinceName, setProvinceName] = useState("");

    useEffect(() => {
        if (city) {
            setCityData({idCity: city.idCity, nameCity: city.nameCity, province: city.province.idProvince});
            setProvinceName(city.province.nameProvince);
        }
    }, [city]);

    if (!visible|| (type ==="edit" && !city)) {
        return null;
    }

    return (
        <div className="city-modal" onClick={onClose}>
            <div className ="city-modal-content" onClick={e => e.stopPropagation()}>
                <h2>{type === "edit"?
                    "Editar Ciudad":"Crear Ciudad"}</h2>
                    {type === "edit" && city? (
                    <div>
                        <p><strong> ID: {city.idCity}</strong></p>
                    </div>
                    ) : null}
                    <div>
                        <p><strong>Nombre:</strong></p>
                        <input
                            type="text"
                            value={cityData.nameCity}
                            onChange={(e) => setCityData({ ...cityData, nameCity: e.target.value })}
                        />
                    </div>
                    <div>
                        <label>Provincia:</label>
                        <input
                            type="text"
                            list = "provinces"
                            value={provinceName}
                            onChange={e => {
                            const val = e.target.value;
                            setProvinceName(val);
                            const selectedProvince = provinces.find(p => p.nameProvince === val);
                            if (selectedProvince) {
                            setCityData({ ...cityData, province: selectedProvince.idProvince });
                            } else {
                            setCityData({ ...cityData, province:"" });
                            }}}
                            onBlur = {() => {
                                if (!provinces.find(p => p.idProvince === cityData.province)) {
                                    alert("Provincia inválida");
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
                        {type === "edit"? (
                        <>
                        <button type="button" onClick={() => {onDelete(cityData.idCity) ; onClose()}} >Eliminar</button>
                        <button type="submit" onClick={()=>onEdit(cityData)}>Modificar</button></>
                        ) : (<button type="submit" onClick={()=>onCreate({nameCity: cityData.nameCity, province:cityData.province})}>Añadir</button>)}

                        <button type="button" onClick={onClose}>Cancelar</button>
                    </div>
            </div>
        </div>
    )
}