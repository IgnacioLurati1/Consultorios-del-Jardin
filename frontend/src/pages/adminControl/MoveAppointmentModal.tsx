import { useEffect, useState } from "react";
import { Modal } from "../../components/modal/Modal.tsx";
import { useWords } from "../../lib/installation.ts";
import { appointmentDate, formatDayLabel, shortHour } from "../appointments/appointmentTypes.ts";
import type { Room } from "../types.ts";
import type { AdminAppointment, AdminAppointmentChanges } from "./controlService.ts";

const HOUR = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface Props {
  /** El turno que se mueve. Sin turno, no hay ventana. */
  appointment?: AdminAppointment;
  rooms: Room[];
  onClose: () => void;
  /** Si falla, el error queda escrito en la ventana y la ventana sigue abierta. */
  onSave: (appointment: AdminAppointment, changes: AdminAppointmentChanges) => Promise<void>;
}

/** Los datos del turno como están guardados, en la forma en que los escribe el formulario. */
function savedForm(appointment: AdminAppointment) {
  return {
    date: String(appointment.date).slice(0, 10),
    initialHour: shortHour(appointment.initialHour),
    finalHour: shortHour(appointment.finalHour),
    room: appointment.room ? String(appointment.room.idRoom) : "",
    value: "",
  };
}

/**
 * Mover un turno desde la recepción: otro día, otro horario, otra sala, u otro valor.
 *
 * El valor arranca vacío y vacío quiere decir "no tocarlo": la lista de Control no trae
 * el valor del turno (se recorta en el servidor junto con lo clínico), así que no hay
 * de dónde sacar el que tiene. Mandar un cero lo pisaría sin que nadie lo haya pedido.
 *
 * Si se tocó el día, el horario o la sala, se mandan los cuatro juntos, igual que la
 * ficha del turno del profesional: es el camino que el servidor ya conoce para revisar
 * choques y avisarle al paciente.
 */
export function MoveAppointmentModal({ appointment, rooms, onClose, onSave }: Props) {
  const w = useWords();
  const [form, setForm] = useState({ date: "", initialHour: "", finalHour: "", room: "", value: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setForm(savedForm(appointment));
    setError(null);
    setSaving(false);
  }, [appointment]);

  if (!appointment) return null;

  const saved = savedForm(appointment);
  // La sala del turno puede estar dada de baja y no venir en la lista de las activas. Sin
  // esto el desplegable arrancaría en blanco, como si el turno no tuviera ninguna.
  const roomMissing = Boolean(saved.room) && !rooms.some((room) => String(room.idRoom) === saved.room);

  function changes(): AdminAppointmentChanges | string {
    if (!form.date) return "Falta la fecha";
    if (!HOUR.test(form.initialHour) || !HOUR.test(form.finalHour)) return "Falta un horario válido";
    if (form.initialHour >= form.finalHour) return "La hora de inicio debe ser anterior a la de fin";
    if (!form.room) return `Falta ${w.el("sala")}`;
    if (form.value.trim() && !(Number(form.value) >= 0)) return "El valor no puede ser negativo";

    const moved =
      form.date !== saved.date ||
      form.initialHour !== saved.initialHour ||
      form.finalHour !== saved.finalHour ||
      form.room !== saved.room;

    const result: AdminAppointmentChanges = moved
      ? { date: form.date, initialHour: form.initialHour, finalHour: form.finalHour, room: Number(form.room) }
      : {};
    if (form.value.trim()) result.value = Number(form.value);

    return Object.keys(result).length ? result : "Sin cambios para guardar";
  }

  async function handleSave() {
    if (!appointment) return;
    const result = changes();
    if (typeof result === "string") {
      setError(result);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(appointment, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const patient = appointment.patient
    ? `${appointment.patient.surname}, ${appointment.patient.name}`
    : `Sin ${w.paciente} asignad${w.o("paciente")}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mover ${w.turno}`}
      subtitle={`${formatDayLabel(appointmentDate(saved.date))} · ${saved.initialHour} a ${saved.finalHour} · ${patient}`}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Fecha</span>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Hora de inicio</span>
            <input type="time" value={form.initialHour} onChange={(e) => setForm({ ...form, initialHour: e.target.value })} />
          </label>
          <label className="ui-field">
            <span>Hora de fin</span>
            <input type="time" value={form.finalHour} onChange={(e) => setForm({ ...form, finalHour: e.target.value })} />
          </label>
        </div>

        <label className="ui-field">
          <span>{w.Sala}</span>
          <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
            <option value="">{`Seleccionar ${w.sala}…`}</option>
            {roomMissing && <option value={saved.room}>{appointment.room.description}</option>}
            {rooms.map((room) => (
              <option key={room.idRoom} value={room.idRoom}>
                {room.description}
                {room.office?.description ? ` · ${room.office.description}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="ui-field">
          <span>Valor</span>
          <input
            type="number"
            min={0}
            step={100}
            placeholder="Sin cambios"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <small>Vacío mantiene el valor actual.</small>
        </label>

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
