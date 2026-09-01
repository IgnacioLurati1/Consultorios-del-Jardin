import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";

interface OfficeModalProps {
  visible: boolean;
  onClose: () => void;
  office: any | null;
  onDelete: (id: string) => void;
  onEdit: (
    id: string,
    newDescription: string,
    newOpeningTime: string,
    newClosingTime: string,
    newCityId: string,
    active: boolean
  ) => void;
  action: string;
  onCreate: (newDescription: string, newOpeningTime: string, newClosingTime: string, newCityId: string) => void;
  cities: any[];
  provinces: any[];
}

const emptyForm = { description: "", openingTime: "", closingTime: "", city: "", province: "" };

export function OfficeModal({ visible, onClose, office, onDelete, onEdit, action, onCreate, cities, provinces }: OfficeModalProps) {
  // El estado vive acá arriba y no dentro de cada rama: antes cada caso llamaba a
  // useState por su cuenta, y cambiar de caso rompía el orden de los hooks.
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const editing = action === "edit" && !!office;

  useEffect(() => {
    if (!visible) return;

    setForm(
      office
        ? {
            description: office.description,
            openingTime: office.openingTime,
            closingTime: office.closingTime,
            city: office.city.idCity,
            province: office.city.province.idProvince,
          }
        : emptyForm
    );
    setError(null);
  }, [visible, office]);

  if (!visible || (action === "edit" && !office)) return null;

  const filteredCities = form.province ? cities.filter((city) => String(city.province.idProvince) === String(form.province)) : [];

  function submit() {
    if (!form.description.trim()) return setError("La descripción es obligatoria");
    if (!form.openingTime || !form.closingTime) return setError("Cargá el horario de apertura y el de cierre");
    if (form.openingTime >= form.closingTime) return setError("El horario de apertura tiene que ser anterior al de cierre");
    if (!form.city) return setError("Elegí una localidad");

    setError(null);

    if (editing) onEdit(office.idOffice, form.description.trim(), form.openingTime, form.closingTime, form.city, office.active);
    else onCreate(form.description.trim(), form.openingTime, form.closingTime, form.city);
  }

  // Una sucursal dada de baja solo se puede reactivar.
  if (editing && !office.active) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={office.description}
        subtitle="Sucursal dada de baja"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              autoFocus
              onClick={() =>
                onEdit(office.idOffice, office.description, office.openingTime, office.closingTime, office.city.idCity, false)
              }
            >
              Reactivar sucursal
            </button>
          </>
        }
      >
        <div className="ui-section">
          <div className="ui-detail-list">
            <div className="ui-detail-row">
              <span>Horario</span>
              <strong>
                {office.openingTime} a {office.closingTime}
              </strong>
            </div>
            <div className="ui-detail-row">
              <span>Localidad</span>
              <strong>
                {office.city.nameCity}, {office.city.province.nameProvince}
              </strong>
            </div>
          </div>
          <p className="ui-alert ui-alert-info">Mientras esté dada de baja no se pueden dar turnos en sus consultorios.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Editar sucursal" : "Nueva sucursal"}
      subtitle={editing ? office.description : "Dónde atienden los profesionales"}
      footer={
        <>
          {editing && (
            <button type="button" className="adm-btn adm-btn-danger" onClick={() => onDelete(office.idOffice)}>
              <FaTrash />
              Dar de baja
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={submit}>
            {editing ? "Guardar cambios" : "Crear sucursal"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Descripción</span>
          <input
            autoFocus
            value={form.description}
            placeholder="Sucursal Centro"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Abre a las</span>
            <input type="time" value={form.openingTime} onChange={(e) => setForm({ ...form, openingTime: e.target.value })} />
          </label>
          <label className="ui-field">
            <span>Cierra a las</span>
            <input type="time" value={form.closingTime} onChange={(e) => setForm({ ...form, closingTime: e.target.value })} />
          </label>
        </div>

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Provincia</span>
            <select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value, city: "" })}>
              <option value="">Elegí una provincia…</option>
              {provinces.map((province) => (
                <option key={province.idProvince} value={province.idProvince}>
                  {province.nameProvince}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span>Localidad</span>
            <select value={form.city} disabled={!form.province} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              <option value="">{form.province ? "Elegí una localidad…" : "Elegí primero la provincia"}</option>
              {filteredCities.map((city) => (
                <option key={city.idCity} value={city.idCity}>
                  {city.nameCity}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
