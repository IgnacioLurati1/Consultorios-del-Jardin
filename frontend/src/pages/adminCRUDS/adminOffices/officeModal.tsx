import { useState, useEffect } from "react";
import { FaTimes, FaTrash, FaChevronRight } from "react-icons/fa";

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
        province: {
            idProvince: string;
            nameProvince: string;
        };
    };
  } | null;
  cities: {
    idCity: string;
    nameCity: string;
    province: {
        idProvince: string;
        nameProvince: string;
    };
  }[];
    provinces: {
    idProvince: string;
    nameProvince: string;
  }[];
    onClose: () => void;
    onDelete: () => void;
    onEdit: (idOffice: string, description: string, openingTime: string, closingTime: string, cityId: string, active: boolean) => void;
    onCreate: (description: string, openingTime: string, closingTime: string, cityId: string) =>
        void;
    action: 'create' | 'edit';
}

export function OfficeModal({ visible, office, cities, provinces, onClose, onDelete, onEdit, onCreate, action }: OfficeModalProps) {
  if (!visible) return null;

const [description, setDescription] = useState(office?.description || "");
const [openingTime, setOpeningTime] = useState(office?.openingTime || "");
const [closingTime, setClosingTime] = useState(office?.closingTime || "");
const [selectedCity, setSelectedCity] = useState(office?.city?.idCity || "");
const [selectedProvince, setSelectedProvince] = useState(office?.city?.province?.idProvince || "");
const isTimeValid = () => openingTime < closingTime;


const handleCreate = () => {
  if (!isTimeValid()) {
    alert("El horario de cierre debe ser mayor al de apertura.");
    return;
  }
  onCreate(description, openingTime, closingTime, selectedCity);
};

const handleEdit = () => {
  if (!isTimeValid()) {
    alert("El horario de cierre debe ser mayor al de apertura.");
    return;
  }
  if (office)
    onEdit(office.idOffice, description, openingTime, closingTime, selectedCity, office.active);
};

const handleActivate = () => {
  if (office)
    onEdit(office.idOffice, description, openingTime, closingTime, selectedCity, office.active);
};

useEffect(() => {
  if (office) {
    setDescription(office.description);
    setOpeningTime(office.openingTime);
    setClosingTime(office.closingTime);
    setSelectedCity(office.city?.idCity || "");
    setSelectedProvince(office.city?.province?.idProvince || "");
  } else {
    setDescription("");
    setOpeningTime("");
    setClosingTime("");
    setSelectedCity("");
    setSelectedProvince("");
  }
}, [office]);

const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const provinceId = e.target.value;
  setSelectedProvince(provinceId);
  setSelectedCity("");
};


const filteredCities = cities.filter(city => String(city.province.idProvince) === String(selectedProvince));

  return (
    <div className="crud-modal" onClick={onClose}>
      <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
        <div className="titleAndClose">
          <h2 className="crud-modal-title">
            {action === "edit" ? `Detalles de la Oficina ${office?.idOffice}` : "Crear Nueva Oficina"} <FaChevronRight /> 
          </h2>
          <FaTimes className="close-icon" onClick={onClose} />
        </div>
        {action === "edit" && office && office.active && (
  <>
    <p>ID: {office.idOffice}</p>
    <p>Descripción: <input type="text" className="input-crud" placeholder={office.description} value={description} onChange={e => setDescription(e.target.value)} /></p>
    <p>Horario de Apertura: <input type="time" className="input-crud" value={openingTime} onChange={e => setOpeningTime(e.target.value)} /></p>
    <p>Horario de Cierre: <input type="time" className="input-crud" value={closingTime} onChange={e => setClosingTime(e.target.value)} /></p>
    <p>Provincia:
      <select value={selectedProvince} onChange={handleProvinceChange} className="input-crud">
        <option value="" disabled>Seleccione una provincia</option>
        {provinces.map(province => (
          <option key={province.idProvince} value={province.idProvince}>{province.nameProvince}</option>
        ))}
      </select>
    </p>
    <p>Ciudad:
      <select
        value={selectedCity}
        onChange={e => setSelectedCity(e.target.value)}
        className="input-crud"
        disabled={!selectedProvince || filteredCities.length === 0}
      >
        <option value="" disabled>
          { !selectedProvince
            ? "Seleccione una provincia primero"
            : filteredCities.length === 0
              ? "No hay ciudades disponibles"
              : "Seleccione una ciudad"
          }
        </option>
        {filteredCities.map(city => (
          <option key={city.idCity} value={city.idCity}>{city.nameCity}</option>
        ))}
      </select>
    </p>
    <div className="buttons">
      
      {office.active && (
        <>
        <button className="delete-button" onClick={onDelete}>Eliminar oficina <FaTrash /></button>
        <button className="edit-button" onClick={handleEdit}>Modificar oficina</button> 
        </>
      )}
      {!office.active && (
        <button className="edit-button" onClick={handleActivate}>Activar oficina</button>
      )}
    </div>
  </>
)}

{action === "edit" && office && !office.active && (
  <div>
    <p>ID: {office.idOffice}</p>
    <p>Descripción: {office.description}</p>
    <p>Horario de Apertura: {office.openingTime}</p>
    <p>Horario de Cierre: {office.closingTime}</p>
    <p>Provincia: {office.city?.province.nameProvince}</p>
    <p>Ciudad: {office.city?.nameCity}</p>
    <div className="buttons">
      <button autoFocus className="create-button" onClick={handleActivate}>Activar</button>
    </div>
  </div>
)}

        {action === "create" && (
  <>
    <p>Descripción: <input type="text" className="input-crud" placeholder="Descripción de la oficina" value={description} onChange={e => setDescription(e.target.value)} /></p>
    <p>Horario de Apertura: <input type="time" className="input-crud" value={openingTime} onChange={e => setOpeningTime(e.target.value)} /></p>
    <p>Horario de Cierre: <input type="time" className="input-crud" value={closingTime} onChange={e => setClosingTime(e.target.value)} /></p>
    <p>Provincia:
      <select value={selectedProvince} onChange={handleProvinceChange} className="input-crud">
        <option value="" disabled>Seleccione una provincia</option> 
        {provinces.map(province => (
          <option key={province.idProvince} value={province.idProvince}>{province.nameProvince}</option>
        ))}
      </select>
    </p>
    <p>Ciudad:
      <select
        value={selectedCity}
        onChange={e => setSelectedCity(e.target.value)}
        className="input-crud"
        disabled={!selectedProvince || filteredCities.length === 0}
      >
        <option value="" disabled>
          { !selectedProvince
            ? "Seleccione una provincia primero"
            : filteredCities.length === 0
              ? "No hay ciudades disponibles"
              : "Seleccione una ciudad"
          }
        </option>
        {filteredCities.map(city => (
          <option key={city.idCity} value={city.idCity}>{city.nameCity}</option>
        ))}
      </select>
    </p>
    <div className="buttons">
      <button className="create-button" onClick={handleCreate}>Crear oficina</button>
    </div>
  </>
        )}
      </div>
    </div>
  );
}