import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import type { RoomModalProps } from "./typesRoom.tsx";

export function RoomModal({ visible, room, offices, cities, onClose, onDelete, onEdit, onCreate, type }: RoomModalProps) {
  const [roomData, setRoomData] = useState({ idRoom: "", description: "", office: "", active: true });
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<{ description?: string; office?: string }>({});

  const editing = type === "edit" && !!room;

  useEffect(() => {
    if (!visible) return;

    if (room) {
      setRoomData({ idRoom: room.idRoom, description: room.description, office: room.office.idOffice, active: room.active });
      setCity(room.office.city.idCity);
    } else {
      setRoomData({ idRoom: "", description: "", office: "", active: true });
      setCity("");
    }
    setErrors({});
  }, [visible, room]);

  if (!visible || (type === "edit" && !room)) return null;

  // Sin sucursales habilitadas no hay dónde poner el consultorio.
  if (offices.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={editing ? "Editar consultorio" : "Nuevo consultorio"}
        footer={
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        }
      >
        <p className="ui-alert ui-alert-error">
          No hay ninguna sucursal habilitada. Creá o reactivá una antes de {editing ? "editar" : "crear"} consultorios.
        </p>
      </Modal>
    );
  }

  if (editing && room!.office.active === false) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={room!.description}
        subtitle={`${room!.office.description} · sucursal dada de baja`}
        footer={
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        }
      >
        <p className="ui-alert ui-alert-error">
          Este consultorio no se puede modificar porque la sucursal a la que pertenece está dada de baja. Reactivala primero.
        </p>
      </Modal>
    );
  }

  const filteredOffices = city ? offices.filter((office) => String(office.city.idCity) === String(city)) : [];

  function submit() {
    const newErrors: typeof errors = {};
    if (!roomData.description.trim()) newErrors.description = "La descripción es obligatoria";
    if (!roomData.office) newErrors.office = "Elegí una sucursal";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (editing) onEdit({ ...roomData, description: roomData.description.trim() }, true);
    else onCreate({ description: roomData.description.trim(), office: roomData.office });
  }

  if (editing && room!.active === false) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={room!.description}
        subtitle={`${room!.office.description} · consultorio dado de baja`}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="adm-btn adm-btn-primary" autoFocus onClick={() => onEdit(roomData, false)}>
              Reactivar consultorio
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">Mientras esté dado de baja no se pueden dar turnos ni cargar horarios en este consultorio.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={editing ? "Editar consultorio" : "Nuevo consultorio"}
      subtitle={editing ? room!.description : "Dentro de una sucursal"}
      footer={
        <>
          {editing && (
            <button
              type="button"
              className="adm-btn adm-btn-danger"
              onClick={() => {
                onDelete(roomData.idRoom);
                onClose();
              }}
            >
              <FaTrash />
              Dar de baja
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={submit}>
            {editing ? "Guardar cambios" : "Crear consultorio"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Descripción</span>
          <input
            autoFocus
            value={roomData.description}
            placeholder="Consultorio 1"
            onChange={(e) => setRoomData({ ...roomData, description: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {errors.description && <small className="ui-hint">{errors.description}</small>}
        </label>

        {/* La localidad no se guarda: solo acota la lista de sucursales. */}
        <label className="ui-field">
          <span>Localidad</span>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setRoomData({ ...roomData, office: "" });
            }}
          >
            <option value="">Elegí una localidad…</option>
            {cities.map((c) => (
              <option key={c.idCity} value={c.idCity}>
                {c.nameCity}
              </option>
            ))}
          </select>
        </label>

        <label className="ui-field">
          <span>Sucursal</span>
          <select value={roomData.office} disabled={!city} onChange={(e) => setRoomData({ ...roomData, office: e.target.value })}>
            <option value="">{city ? "Elegí una sucursal…" : "Elegí primero la localidad"}</option>
            {filteredOffices.map((office) => (
              <option key={office.idOffice} value={office.idOffice}>
                {office.description}
              </option>
            ))}
          </select>
          {errors.office && <small className="ui-hint">{errors.office}</small>}
        </label>
      </div>
    </Modal>
  );
}
