
import "../styles/ProvinceModal.css";

export function ProvinceModal({visible, onClose, province, onDelete}: {visible: boolean; onClose: () => void; province: any | null; onDelete: () => void}) {
    if (!visible || !province) return null;

    return (
    <div className="province-modal" onClick={onClose}>
      <div className="province-modal-content" onClick={e => e.stopPropagation()}>
        <h2>Detalles de la provincia</h2>
        <p><strong>ID:</strong> {province.idProvince}</p>
        <p><strong>Nombre:</strong> {province.nameProvince}</p>

        <button onClick={onDelete}>Eliminar</button>
      </div>
    </div>
  );
}

