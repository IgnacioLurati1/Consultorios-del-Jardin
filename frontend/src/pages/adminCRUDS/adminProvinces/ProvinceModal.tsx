import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";

interface ProvinceModalProps {
  visible: boolean;
  onClose: () => void;
  province: any | null;
  onDelete: () => void;
  onEdit: (id: string, newName: string, active: boolean) => void;
  action: string;
  onCreate: (newName: string) => void;
}

export function ProvinceModal({ visible, onClose, province, onDelete, onEdit, action, onCreate }: ProvinceModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editing = action === "edit" && province;
  const disabled = editing && province.active === false;

  useEffect(() => {
    if (!visible) return;
    // Antes el campo arrancaba vacío y solo mostraba el nombre actual como placeholder:
    // guardar sin escribir nada dejaba la provincia sin nombre.
    setName(editing ? province.nameProvince : "");
    setError(null);
  }, [visible, province, action]);

  if (!visible || (action === "edit" && !province)) return null;

  function submit() {
    if (!name.trim()) {
      setError("El nombre no puede quedar vacío");
      return;
    }

    if (editing) onEdit(province.idProvince, name.trim(), true);
    else onCreate(name.trim());
  }

  // Una provincia dada de baja solo se puede reactivar.
  if (disabled) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={province.nameProvince}
        subtitle="Provincia dada de baja"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="adm-btn adm-btn-primary" autoFocus onClick={() => onEdit(province.idProvince, " ", false)}>
              Reactivar provincia
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">
          Mientras esté dada de baja no se pueden crear localidades en esta provincia ni modificar sus datos.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={editing ? "Editar provincia" : "Nueva provincia"}
      subtitle={editing ? province.nameProvince : "Se usa para agrupar las localidades"}
      footer={
        <>
          {editing && (
            <button type="button" className="adm-btn adm-btn-danger" onClick={onDelete}>
              <FaTrash />
              Dar de baja
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={submit}>
            {editing ? "Guardar cambios" : "Crear provincia"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Nombre</span>
          <input
            autoFocus
            value={name}
            placeholder="Santa Fe"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </label>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
