import { useEffect, useState } from "react";

interface Province {
    idProvince: string;
    nameProvince: string;
}

interface City {
    idCity: string;
    nameCity: string;
    province: { idProvince: string; nameProvince?: string };
}

interface OfficeModalProps {
    visible: boolean;
    office: {
        idOffice: string;
        description: string;
        openingTime: string;
        closingTime: string;
        active: boolean;
        city: {
            idCity: string;
            nameCity: string;
            province?: Province;
        };
    } | null;
    cities: City[];
    provinces: Province[];
    onClose: () => void;
    onDelete: (idOffice: string) => void;
    onEdit: (updatedOffice: {
        idOffice: string;
        description: string;
        openingTime: string;
        closingTime: string;
        city: string;
        active: boolean;
    }) => void;
    onCreate: (newOffice: {
        description: string;
        openingTime: string;
        closingTime: string;
        city: string;
        active: boolean;
    }) => void;
    type: string; 
}

export function OfficeModal({
    visible,
    office,
    cities,
    provinces,
    onClose,
    onDelete,
    onEdit,
    onCreate,
    type,
}: OfficeModalProps) {
    const [officeData, setOfficeData] = useState({
        idOffice: "",
        description: "",
        openingTime: "",
        closingTime: "",
        city: "",
        active: true,
    });

    const [selectedProvince, setSelectedProvince] = useState("");

    useEffect(() => {
        if (office) {
            setOfficeData({
                idOffice: office.idOffice,
                description: office.description,
                openingTime: office.openingTime,
                closingTime: office.closingTime,
                city: office.city.idCity,
                active: office.active,
            });

            const provinceId = office.city.province?.idProvince || "";
            setSelectedProvince(provinceId);
        } else {
            setOfficeData({
                idOffice: "",
                description: "",
                openingTime: "",
                closingTime: "",
                city: "",
                active: true,
            });
            setSelectedProvince("");
        }
    }, [office]);

    if (!visible) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type: inputType } = e.target;
        setOfficeData((prev) => ({
            ...prev,
            [name]: inputType === "checkbox"
                ? (e.target as HTMLInputElement).checked
                : value,
        }));
    };

    const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const provinceId = e.target.value;
        setSelectedProvince(provinceId);

        const firstCity = cities.find(c => String(c.province.idProvince) === String(provinceId));
        setOfficeData(prev => ({
            ...prev,
            city: firstCity ? firstCity.idCity : "",
        }));
    };

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setOfficeData(prev => ({
            ...prev,
            city: e.target.value,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!officeData.city) {
            alert("Debe seleccionar una ciudad");
            return;
        }

        const payload = {
            description: officeData.description,
            openingTime: officeData.openingTime,
            closingTime: officeData.closingTime,
            city: officeData.city,
            active: officeData.active,
        };

        if (type === "edit" && office) {
            onEdit({ ...payload, idOffice: office.idOffice });
        } else {
            onCreate(payload);
        }

        onClose();
    };

    const handleDelete = () => {
        if (office && window.confirm("¿Seguro que deseas dar de baja esta oficina?")) {
            onDelete(office.idOffice);
            onClose();
        }
    };

    const filteredCities = selectedProvince
        ? cities.filter(c => String(c.province.idProvince) === String(selectedProvince))
        : [];

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2>{type === "edit" ? "Editar Oficina" : "Nueva Oficina"}</h2>
                <form onSubmit={handleSubmit}>

                    {/* Description */}
                    <div className="form-group">
                        <label htmlFor="description">Descripción</label>
                        <input
                            type="text"
                            id="description"
                            name="description"
                            value={officeData.description}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    {/* Provinces */}
                    <div className="form-group">
                        <label htmlFor="province">Provincia</label>
                        <select
                            id="province"
                            name="province"
                            value={selectedProvince}
                            onChange={handleProvinceChange}
                            required
                        >
                            <option value="">Selecciona una provincia</option>
                            {provinces.map((prov) => (
                                <option key={prov.idProvince} value={prov.idProvince}>
                                    {prov.nameProvince}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Cities */}
                    <div className="form-group">
                        <label htmlFor="city">Ciudad</label>
                        <select
                            id="city"
                            name="city"
                            value={officeData.city}
                            onChange={handleCityChange}
                            required
                            disabled={filteredCities.length === 0}
                        >
                            <option value="">Selecciona una ciudad</option>
                            {filteredCities.map(city => (
                                <option key={city.idCity} value={city.idCity}>
                                    {city.nameCity}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Hour */}
                    <div className="form-group">
                        <label htmlFor="openingTime">Hora de apertura</label>
                        <input
                            type="time"
                            id="openingTime"
                            name="openingTime"
                            value={officeData.openingTime}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="closingTime">Hora de cierre</label>
                        <input
                            type="time"
                            id="closingTime"
                            name="closingTime"
                            value={officeData.closingTime}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    {/* State */}
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                name="active"
                                checked={officeData.active}
                                onChange={handleInputChange}
                            />
                            Activo
                        </label>
                    </div>

                    {/* Buttons */}
                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary">
                            {type === "edit" ? "Guardar Cambios" : "Crear Oficina"}
                        </button>
                        {type === "edit" && (
                            <button type="button" className="btn btn-danger" onClick={handleDelete}>
                                Dar de Baja
                            </button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
