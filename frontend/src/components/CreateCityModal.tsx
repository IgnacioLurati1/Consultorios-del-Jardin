import { useState } from "react";

interface CreateCityModalProps {
    visible: boolean;
    provinces: {idProvince:string, nameProvince:string}[];
    onClose: () => void;
    onSave: (newCity: {
        nameCity: string;
        province: string;
    }) => void;
}

    export function CreateCityModal({visible, provinces, onClose, onSave}: CreateCityModalProps) {
        
        const [cityData, setCityData] = useState({ nameCity: "", province: "" });
        const [provinceName, setProvinceName] = useState("");

        if (!visible) {
            return null;
        }

        return (
        <div>
            <h2>Crear Ciudad</h2>
            <form onSubmit={(e) => {
                e.preventDefault();
                onSave(cityData);
                onClose();
                }}>
                <div>
                    <label>Nombre Ciudad:</label>
                    <input
                        type="text"
                        required
                        value = {cityData.nameCity}
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
            
                <button type="submit">Crear</button>
                <button type="button" onClick={onClose}>Cancelar</button>
            </form>
        </div>
    )
}
