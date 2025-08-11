import {useState} from "react";
import "../styles/ProvinceModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";




export function ProvinceModal({visible, onClose, province, onDelete, onEdit}: {visible: boolean; onClose: () => void; province: any | null; onDelete: () => void; onEdit: (id: string, newName: string) => void}) {
    if (!visible || !province) return null;
    const [newName, setNewName] = useState('');

    return (
    <div className="province-modal" onClick={onClose}>
      <div className="province-modal-content" onClick={e => e.stopPropagation()}>
        <div className="titleAndClose">
          <h2 className="province-modal-title">Detalles de la Provincia <FaChevronRight /></h2>
          <FaTimes className="close-icon" onClick={onClose} />
        </div>
        <p>ID: {province.idProvince}</p>

        <p>Nombre:  <input type="text" className="input-province" placeholder={province.nameProvince} value={newName} onChange={e => {
            setNewName(e.target.value);
        }}/></p>

        <div className="buttons">
          <button className="delete-button" onClick={onDelete}>Eliminar provincia <FaTrash /></button>
          <button className="edit-button" onClick={() => onEdit(province.idProvince, newName)}>Modificar</button>
        </div>
      </div>
    </div>
  );
}

