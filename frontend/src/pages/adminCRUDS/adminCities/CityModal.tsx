import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";

interface CityModalProps {
  visible: boolean;
  city: {
    idCity: string;
    nameCity: string;
    province: {
      idProvince: string;
      nameProvince: string;
      active?: boolean;
    };
    active: boolean;
  } | null;
  provinces: { idProvince: string; nameProvince: string }[];
  onClose: () => void;
  onDelete: (idCity: string) => void;
  onEdit: (
    Updatedcity: {
      idCity: string;
      nameCity: string;
      province: string;
    },
    active: boolean
  ) => void;
  onCreate: (newCity: { nameCity: string; province: string }) => void;
  type: string;
}

export function CityModal({ visible, city, provinces, onClose, onDelete, onEdit, onCreate, type }: CityModalProps) {
  const [cityData, setCityData] = useState({ idCity: "", nameCity: "", province: "", active: true });
  const [errors, setErrors] = useState<{ nameCity?: string; province?: string }>({});

  const editing = type === "edit" && !!city;

  useEffect(() => {
    if (!visible) return;

    if (city) {
      setCityData({ idCity: city.idCity, nameCity: city.nameCity, province: city.province.idProvince, active: city.active });
    } else {
      setCityData({ idCity: "", nameCity: "", province: "", active: true });
    }
    setErrors({});
  }, [visible, city]);

  if (!visible || (type === "edit" && !city)) return null;

  // Sin provincias no hay dónde ubicar la localidad.
  if (provinces.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={editing ? "Editar localidad" : "Nueva localidad"}
        footer={
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        }
      >
        <p className="ui-alert ui-alert-error">
          No hay ninguna provincia habilitada. Creá o reactivá una provincia antes de {editing ? "editar" : "crear"} localidades.
        </p>
      </Modal>
    );
  }

  function submit() {
    const newErrors: typeof errors = {};
    if (!cityData.nameCity.trim()) newErrors.nameCity = "El nombre es obligatorio";
    if (!cityData.province) newErrors.province = "Elegí una provincia";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (editing) onEdit({ ...cityData, nameCity: cityData.nameCity.trim() }, true);
    else onCreate({ nameCity: cityData.nameCity.trim(), province: cityData.province });
  }

  // Una localidad dada de baja solo se puede reactivar.
  if (editing && city!.active === false) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={city!.nameCity}
        subtitle={`${city!.province.nameProvince} · localidad dada de baja`}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="adm-btn adm-btn-primary" autoFocus onClick={() => onEdit(cityData, false)}>
              Reactivar localidad
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">
          Mientras esté dada de baja no se pueden crear consultorios en esta localidad.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={editing ? "Editar localidad" : "Nueva localidad"}
      subtitle={editing ? city!.nameCity : "Se usa para ubicar los consultorios"}
      footer={
        <>
          {editing && (
            <button
              type="button"
              className="adm-btn adm-btn-danger"
              onClick={() => {
                onDelete(cityData.idCity);
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
            {editing ? "Guardar cambios" : "Crear localidad"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Nombre</span>
          <input
            autoFocus
            value={cityData.nameCity}
            placeholder="Rosario"
            onChange={(e) => setCityData({ ...cityData, nameCity: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {errors.nameCity && <small className="ui-hint">{errors.nameCity}</small>}
        </label>

        <label className="ui-field">
          <span>Provincia</span>
          {/* Antes era un input con datalist: se podía escribir cualquier cosa y quedaba
              en un estado inválido hasta salir del campo. Con un select no hay forma de
              elegir algo que no exista. */}
          <select value={cityData.province} onChange={(e) => setCityData({ ...cityData, province: e.target.value })}>
            <option value="">Elegí una provincia…</option>
            {provinces.map((province) => (
              <option key={province.idProvince} value={province.idProvince}>
                {province.nameProvince}
              </option>
            ))}
          </select>
          {errors.province && <small className="ui-hint">{errors.province}</small>}
        </label>
      </div>
    </Modal>
  );
}
