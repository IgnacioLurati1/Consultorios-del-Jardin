import { useEffect, useState } from "react";

interface EditCityModalProps {
    isOpen: boolean;
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
    onSave : (Updatedcity: {
        idCity: string;
        nameCity: string;
        province:  string;
    }
    ) => void;
}

export function EditCityModal({ isOpen, city, provinces, onClose, onSave }: EditCityModalProps) {
    const [cityData, setCityData] = useState({ idCity: "", nameCity: "", province:""   });
    const [provinceName, setProvinceName] = useState("");

    useEffect(() => {
        if (city) {
            setCityData({idCity: city.idCity, nameCity: city.nameCity, province: city.province.idProvince});
            setProvinceName(city.province.nameProvince);
        }
    }, [city]);

    if (!isOpen || !city) {
        return null;
    }

    return (
        <div>
            <h2>Editar Ciudad</h2>
            <form onSubmit={(e) => {
            e.preventDefault();
            onSave(cityData);}}>
                <div>
                    <label>ID Ciudad:</label>
                    <input
                        type="text"
                        value={city.idCity}
                        readOnly
                    />
                </div>
                <div>
                    <label>Nombre Ciudad:</label>
                    <input
                        type="text"
                        value={cityData.nameCity}
                        onChange={(e) => setCityData({ ...cityData, nameCity: e.target.value })}
                    />
                </div>
                <div>
                    <label>ID Provincia:</label>
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
                <button type="submit">Guardar</button>
                <button type="button" onClick={onClose}>Cancelar</button>
            </form>
        </div>
    )
}