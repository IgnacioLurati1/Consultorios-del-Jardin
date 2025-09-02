import { useState } from "react";
import { FaTimes, FaTrash, FaChevronRight } from "react-icons/fa";

export function OfficeModal({visible, onClose, office, onDelete, onEdit, action, onCreate, cities, provinces}: {visible: boolean; onClose: () => void; office: any | null; onDelete: () => void; onEdit: (id: string, newDescription: string, newOpeningTime: string, newClosingTime: string, newCityId: string, active: boolean) => void; action: string; onCreate: ( newDescription: string, newOpeningTime: string, newClosingTime: string, newCityId: string) => void; cities: any[]; provinces: any[]}) {
  if (!visible) return null;

  if (action === "edit" && office && office.active) {
    const [newOpeningTime, setNewOpeningTime] = useState(office.openingTime);
    const [newClosingTime, setNewClosingTime] = useState(office.closingTime);
    const [newDescription, setNewDescription] = useState(office.description);
    const [newCityId, setNewCityId] = useState(office.city.idCity);
    const [newProvinceId, setNewProvinceId] = useState(office.city.province.idProvince);

    const filteredCities = newProvinceId 
      ? cities.filter(city => city.province.idProvince == newProvinceId)
      : cities;

    const handleProvinceChange = (e: any) => {
      setNewProvinceId(e.target.value);
      setNewCityId('');
    };

    return (
      <div className="crud-modal" onClick={onClose}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Detalles del Consultorio <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>
          <p>ID: {office.idOffice}</p>

          <p>Descripción: <input type="text" className="input-crud" placeholder={office.description} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></p>
          <p>Horario de Apertura: <input type="time" className="input-crud" value={newOpeningTime} onChange={e => setNewOpeningTime(e.target.value)} /></p>
          <p>Horario de Cierre: <input type="time" className="input-crud" value={newClosingTime} onChange={e => setNewClosingTime(e.target.value)} /></p>    
          <p>Provincia:
              <select className="input-crud" value={newProvinceId} onChange={handleProvinceChange}>  {}
                <option value="">Seleccione una provincia</option>  {}
                {provinces.map(province => (
                  <option key={province.idProvince} value={province.idProvince}>
                    {province.nameProvince}
                  </option>
                ))}
              </select>
            </p>
          <p>Ciudad: 
            <select className="input-crud" value={newCityId} onChange={e => setNewCityId(e.target.value)}>
              <option value="">Seleccione una ciudad</option>  {}
              {filteredCities.map(city => (
                <option key={city.idCity} value={city.idCity}>
                  {city.nameCity}  {}
                </option>
              ))}
            </select>
          </p>
          <div className="buttons">
            <button className="delete-button" onClick={onDelete}>Eliminar Consultorio <FaTrash /></button>
            <button className="edit-button" onClick={() => onEdit(office.idOffice, newDescription , newOpeningTime, newClosingTime, newCityId, office.active)}>Modificar</button>
          </div>
        </div>
      </div>
    );
  }

  if (action === "create") {
    const [newOpeningTime, setNewOpeningTime] = useState('');
    const [newClosingTime, setNewClosingTime] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newCityId, setNewCityId] = useState('');
    const [newProvinceId, setNewProvinceId] = useState('');

    const filteredCities = newProvinceId 
      ? cities.filter(city => city.province.idProvince == newProvinceId)
      : [];

    const handleProvinceChange = (e: any) => {
      setNewProvinceId(e.target.value);
      setNewCityId('');
    };

    return (
      <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
        if (e.key === 'Enter') {
          onCreate(newDescription, newOpeningTime, newClosingTime, newCityId);
          
        }
      }}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Crear Nuevo Consultorio <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>

          <p>Descripción: <input type="text" className="input-crud" placeholder="Descripción del Consultorio" value={newDescription} onChange={e => setNewDescription(e.target.value)} /></p>
          <p>Horario de Apertura: <input type="time" className="input-crud" value={newOpeningTime} onChange={e => setNewOpeningTime(e.target.value)} /></p>
          <p>Horario de Cierre: <input type="time" className="input-crud" value={newClosingTime} onChange={e => setNewClosingTime(e.target.value)} /></p>       
          <p>Provincia:
            <select className="input-crud" value={newProvinceId} onChange={handleProvinceChange}> {}
              <option value="">Seleccione una provincia</option> {}
              {provinces.map(province => (
                <option key={province.idProvince} value={province.idProvince}>
                  {province.nameProvince}
                </option>
              ))}
            </select>
          </p>
          <p>Ciudad: 
            <select className="input-crud" value={newCityId} onChange={e => setNewCityId(e.target.value)}>
              <option value="">Seleccione una ciudad</option> {}
              {filteredCities.map(city => (
                <option key={city.idCity} value={city.idCity}>
                  {city.nameCity}
                </option>
              ))}
            </select>
          </p>
          <div className="buttons">
            <button className="create-button" onClick={() => onCreate(newDescription, newOpeningTime, newClosingTime, newCityId)}>Crear Consultorio</button> {}
          </div>
        </div>
      </div>
    );
  }

  if (action === "edit" && office && !office.active) {
    return (
      <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
        if (e.key === 'Enter') {
          onEdit(office.idOffice, office.description, office.openingTime, office.closingTime, office.city.idCity, true)
        }
      }}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Detalles del Consultorio <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>
          <p>ID: {office.idOffice}</p>
          <p>Descripción: {office.description}</p>
          <p>Horario de Apertura: {office.openingTime}</p>
          <p>Horario de Cierre: {office.closingTime}</p>
          <p>Provincia: {office.city.province.nameProvince}</p>
          <p>Ciudad: {office.city.nameCity}</p>
          <div className="buttons">
            <button className="edit-button" onClick={() => onEdit(office.idOffice, office.description, office.openingTime, office.closingTime, office.city.idCity, true)}>Activar</button>
          </div>
        </div>
      </div>
    );
  }
}
