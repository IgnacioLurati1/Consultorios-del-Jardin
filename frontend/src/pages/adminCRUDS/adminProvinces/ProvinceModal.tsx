import {useState} from "react";
import "../CRUDSModal.css";
import { FaTimes } from "react-icons/fa";
import { FaChevronRight } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";

export function ProvinceModal({visible, onClose, province, onDelete, onEdit, action, onCreate}: {visible: boolean; onClose: () => void; province: any | null; onDelete: () => void; onEdit: (id: string, newName: string, active:boolean) => void; action: string; onCreate: (newName: string) => void;}) {
    if (!visible) return null;
    if (action === "edit" && province && province.active) {
    const [newName, setNewName] = useState('');

    return (
    <div className="crud-modal" onClick={onClose}>
      <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
        <div className="titleAndClose">
          <h2 className="crud-modal-title">Detalles de la Provincia <FaChevronRight /></h2>
          <FaTimes className="close-icon" onClick={onClose} />
        </div>
        <p>ID: {province.idProvince}</p>

        <p>Nombre:  <input type="text" className="input-crud" placeholder={province.nameProvince} value={newName} onChange={e => {
            setNewName(e.target.value);
        }}/></p>

        <div className="buttons">
          <button className="delete-button" onClick={onDelete}>Eliminar provincia <FaTrash /></button>
          <button className="edit-button" onClick={() => onEdit(province.idProvince, newName, true)}>Modificar</button>
        </div>
      </div>
    </div>
  );}

  if (action === "create") {
    const [newName, setNewName] = useState('');
    return (
      <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
        if (e.key === 'Enter') {
          onCreate(newName);
        }
      }}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()}>
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Crear Nueva Provincia <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>

          <p>Nombre:  <input type="text" className="input-crud" placeholder="Nombre de la provincia" value={newName} onChange={e => {
              setNewName(e.target.value);
          }}/></p>

          <div className="buttons">
            <button className="create-button" onClick={() => onCreate(newName)}>Crear provincia</button>
          </div>
        </div>
      </div>
    );
  }

  if(action === "edit" && province.active == false){
    return (
      <div className="crud-modal" tabIndex={0} onClick={onClose} onKeyDown={e => {
        if (e.key === 'Enter') {
          onEdit(province.idProvince, " ", false);
        }
      }}>
        <div className="crud-modal-content" onClick={e => e.stopPropagation()} >
          <div className="titleAndClose">
            <h2 className="crud-modal-title">Detalles de la Provincia <FaChevronRight /></h2>
            <FaTimes className="close-icon" onClick={onClose} />
          </div>
          <p>ID: {province.idProvince}</p>
          <p>Nombre:  {province.nameProvince}</p>
          <div className="buttons">
            <button autoFocus className="create-button" onClick={() => onEdit(province.idProvince, " ", false)}>Activar</button>
          </div>
        </div>
      </div>
    )
  }

}

