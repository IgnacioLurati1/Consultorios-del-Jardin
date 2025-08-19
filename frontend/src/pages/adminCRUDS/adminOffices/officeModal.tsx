import { useState } from "react";
import { FaTimes, FaTrash, FaChevronRight } from "react-icons/fa";

export function OfficeModal({visible, onClose, office, onDelete, onEdit, action, onCreate, cities}: {visible: boolean; onClose: () => void; office: any | null; onDelete: () => void; onEdit: (id: string, newOpeningTime: string, newClosingTime: string, newDescription: string, newCityId: string) => void; action: string; onCreate: (newOpeningTime: string, newClosingTime: string, newDescription: string, newCityId: string) => void; cities: any[]; provinces: any[]}) {
  if (!visible) return null;

  if (action === "edit" && office && office.active) {
    const [newOpeningTime, setNewOpeningTime] = useState(office.openingTime);
    const [newClosingTime, setNewClosingTime] = useState(office.closingTime);
    const [newDescription, setNewDescription] = useState(office.description);
    const [newCityId, setNewCityId] = useState(office.city.idCity);

    return (
      <div className="crud-modal" onClick={onClose}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Detalles de la Oficina <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>
          <p>ID: {office.idOffice}</p>

          <p>Descripción: <input type="text" className="input-crud" placeholder={office.description} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></p>
          <p>Horario de Apertura: <input type="time" className="input-crud" value={newOpeningTime} onChange={e => setNewOpeningTime(e.target.value)} /></p>
          <p>Horario de Cierre: <input type="time" className="input-crud" value={newClosingTime} onChange={e => setNewClosingTime(e.target.value)} /></p>
          <p>Ciudad: 
            <select className="input-crud" value={newCityId} onChange={e => setNewCityId(e.target.value)}>
              {cities.map(city => (
                <option key={city.idCity} value={city.idCity}>
                  {city.nameCity} - {city.province.nameProvince}
                </option>
              ))}
            </select>
          </p>
          <div className="buttons">
            <button className="delete-button" onClick={onDelete}>Eliminar Oficina <FaTrash /></button>
            <button className="edit-button" onClick={() => onEdit(office.idOffice, newOpeningTime, newClosingTime, newDescription, newCityId)}>Modificar</button>
          </div>
        </div>
      </div>
    );}

    if (action === "create") {
      const [newOpeningTime, setNewOpeningTime] = useState('');
      const [newClosingTime, setNewClosingTime] = useState('');
      const [newDescription, setNewDescription] = useState('');
      const [newCityId, setNewCityId] = useState('');
      return (
        <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
          if (e.key === 'Enter') {
            onCreate(newOpeningTime, newClosingTime, newDescription, newCityId);
          }
        }}>
          <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
            <div className="titleAndClose">
              <h2 className="crud-modal-title">Crear Nueva Oficina <FaChevronRight /></h2>
              <FaTimes className="close-icon" onClick={onClose} />
            </div>

            <p>Descripción: <input type="text" className="input-crud" placeholder="Descripción de la oficina" value={newDescription} onChange={e => setNewDescription(e.target.value)} /></p>
            <p>Horario de Apertura: <input type="time" className="input-crud" value={newOpeningTime} onChange={e => setNewOpeningTime(e.target.value)} /></p>
            <p>Horario de Cierre: <input type="time" className="input-crud" value={newClosingTime} onChange={e => setNewClosingTime(e.target.value)} /></p>
            <p>Ciudad: 
              <select className="input-crud" value={newCityId} onChange={e => setNewCityId(e.target.value)}>
                {cities.map(city => (
                  <option key={city.idCity} value={city.idCity}>
                    {city.nameCity} - {city.province.nameProvince}
                  </option>
                ))}
              </select>
            </p>
            <div className="buttons">
              <button className="create-button" onClick={() => onCreate(newOpeningTime, newClosingTime, newDescription, newCityId)}>Crear Oficina</button>
            </div>
          </div>
        </div>
      );
    }

    if (action === "edit" && office && !office.active) {
      return (
        <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
          if (e.key === 'Enter') {
            onEdit(office.idOffice, " ", " ", " ", office.city.idCity);
          }
        }}>
          <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
            <div className="titleAndClose">
              <h2 className="crud-modal-title">Detalles de la Oficina <FaChevronRight /></h2>
              <FaTimes className="close-icon" onClick={onClose} />
            </div>
            <p>ID: {office.idOffice}</p>
            <p>Descripción: {office.description}</p>
            <p>Horario de Apertura: {office.openingTime}</p>
            <p>Horario de Cierre: {office.closingTime}</p>
            <p>Ciudad: {office.city.nameCity} , {office.city.province.nameProvince}</p>
            <div className="buttons">
              <button className="delete-button" onClick={onDelete}>Eliminar Oficina <FaTrash /></button>
              <button className="edit-button" onClick={() => onEdit(office.idOffice, " ", " ", " ", office.city.idCity)}>Activar</button>
            </div>
          </div>
        </div>
      );
    }

}