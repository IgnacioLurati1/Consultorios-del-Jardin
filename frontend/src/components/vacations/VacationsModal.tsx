import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../modal/Modal";
import { useWords } from "../../lib/installation";
import { shortDate } from "./vacationDates";
import "./vacations.css";

export interface VacationPeriod {
  id: number;
  fromDate: string;
  toDate: string;
  reason: string | null;
  /** Si hoy cae adentro del período. Es lo que cambia "Borrar" por "Terminar ahora". */
  current: boolean;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Los períodos en los que un profesional no atiende.
 *
 * La usa el profesional para las suyas y la administración para las de cualquiera, según
 * la regla de vacaciones (ver `vacations` en lib/policies). Sin `onAdd` ni `onRemove` es
 * solo para mirar: el profesional ve las que le cargó la administración y `note` dice por
 * qué no puede tocarlas.
 *
 * El de hoy se corta con "Terminar ahora" y no con "Borrar": es la misma operación,
 * pero nadie piensa en volver antes como en borrar un registro.
 */
export function VacationsModal({
  open,
  onClose,
  title = "Vacaciones",
  vacations,
  note,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  vacations: VacationPeriod[] | null;
  /** Lo que se muestra cuando no se pueden cargar ni borrar. */
  note?: string | null;
  onAdd?: (fromDate: string, toDate: string, reason: string) => Promise<void>;
  onRemove?: (id: number) => Promise<void>;
}) {
  const w = useWords();
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [saving, setSaving] = useState(false);

  function add() {
    if (!onAdd) return;
    setSaving(true);
    onAdd(form.fromDate, form.toDate, form.reason)
      .then(() => {
        toast.success("Vacaciones cargadas. Esos días el perfil queda fuera de las búsquedas");
        setForm({ fromDate: "", toDate: "", reason: "" });
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  function remove(id: number, current: boolean) {
    if (!onRemove) return;
    setSaving(true);
    onRemove(id)
      .then(() => toast.success(current ? "Vacaciones finalizadas. El perfil vuelve a las búsquedas" : "Período borrado"))
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Días sin atención"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          {onAdd ? (
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={saving || !form.fromDate || !form.toDate}
              onClick={add}
            >
              Cargar
            </button>
          ) : null}
        </>
      }
    >
      {note ? <p className="ui-alert ui-alert-info">{note}</p> : null}

      {vacations && vacations.length > 0 ? (
        <div className="ui-section">
          <h3 className="ui-section-title">Cargadas</h3>
          <ul className="prof-vacation-list">
            {vacations.map((vacation) => (
              <li className="prof-vacation-item" key={vacation.id}>
                <div className="prof-vacation-text">
                  <span className="prof-vacation-when">
                    {shortDate(vacation.fromDate)} al {shortDate(vacation.toDate)}
                  </span>
                  {vacation.reason && <span className="prof-vacation-reason">{vacation.reason}</span>}
                </div>
                {vacation.current && <span className="adm-badge adm-badge-amber">En curso</span>}
                {onRemove ? (
                  <button
                    type="button"
                    className={vacation.current ? "adm-btn adm-btn-primary" : "adm-btn adm-btn-ghost"}
                    disabled={saving}
                    onClick={() => remove(vacation.id, vacation.current)}
                  >
                    {vacation.current ? "Terminar ahora" : "Borrar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : !onAdd ? (
        <p className="prof-vacation-empty">Sin períodos cargados.</p>
      ) : null}

      {onAdd ? (
        <div className="ui-section">
          <h3 className="ui-section-title">Cargar un período</h3>
          <div className="ui-field-row">
            <label className="ui-field">
              <span>Desde</span>
              <input
                type="date"
                min={today()}
                value={form.fromDate}
                onChange={(event) => setForm({ ...form, fromDate: event.target.value })}
              />
            </label>
            <label className="ui-field">
              <span>Hasta</span>
              <input
                type="date"
                min={form.fromDate || today()}
                value={form.toDate}
                onChange={(event) => setForm({ ...form, toDate: event.target.value })}
              />
            </label>
          </div>

          <label className="ui-field">
            <span>Motivo (opcional)</span>
            <input
              type="text"
              maxLength={80}
              placeholder="Congreso, licencia, vacaciones…"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
            <small>{`Uso interno. ${w.El("paciente")} no lo ve.`}</small>
          </label>

          <p className="ui-alert ui-alert-info">
            {`Esos días el perfil queda fuera de la búsqueda y sin horarios ofrecidos. ${w.Los("turno")} ya dad${w.os("turno")} quedan sin cambios.`}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
