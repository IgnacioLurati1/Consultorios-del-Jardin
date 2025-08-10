import {useState} from "react";
import "../styles/ProvinceModal.css";



export function ProvinceModal({visible, onClose, province, onDelete, onEdit}: {visible: boolean; onClose: () => void; province: any | null; onDelete: () => void; onEdit: (id: string, newName: string) => void}) {
    if (!visible || !province) return null;
    const [newName, setNewName] = useState(province.nameProvince);
    return (
    <div className="province-modal" onClick={onClose}>
      <div className="province-modal-content" onClick={e => e.stopPropagation()}>
        <h2>Detalles de la provincia</h2>
        <p><strong>ID: {province.idProvince}</strong></p>

        <p><strong>Nombre: </strong> <input type="text" value={newName} onChange={e => {
            setNewName(e.target.value);
        }}/></p>

        <button onClick={onDelete}>Eliminar</button>
        <button onClick={() => onEdit(province.idProvince, newName)}>Modificar</button>
      </div>
    </div>
  );
}

