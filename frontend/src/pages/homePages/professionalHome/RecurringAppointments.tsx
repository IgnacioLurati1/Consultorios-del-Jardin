import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaRepeat } from "react-icons/fa6";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { Modal } from "../../../components/modal/Modal";
import { findRecurrences, stopRecurrence, updateRecurrence, FREQUENCY_LABELS } from "../../appointments/recurrencesService";
import { findAllActiveRooms } from "../../adminCRUDS/adminRooms/RoomService";
import { appointmentDate, formatDayLabel, shortHour } from "../../appointments/appointmentTypes";
import type { Recurrence, RecurrenceFrequency, Room } from "../../types";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Los turnos repetibles caen siempre el mismo día: el de la fecha que los originó. */
function weekdayOf(startDate: string): string {
  return DAY_NAMES[appointmentDate(startDate).getDay()];
}

/**
 * Turnos repetibles del profesional, debajo de la agenda del día.
 *
 * Acá se ve la receta, no los turnos: cambiar algo vale para los que falta generar, y
 * los que ya están creados se editan o se cancelan desde la lista de turnos, uno por uno.
 */
export function RecurringAppointments() {
  const [recurrences, setRecurrences] = useState<Recurrence[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState<Recurrence | undefined>(undefined);
  const [form, setForm] = useState({ frequency: "weekly" as RecurrenceFrequency, value: "", room: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    findRecurrences()
      .then(setRecurrences)
      .catch((err) => {
        toast.error(`No pudimos cargar los turnos repetibles: ${err.message}`);
        setRecurrences([]);
      });
  }

  useEffect(load, []);

  useEffect(() => {
    findAllActiveRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  function openEdit(recurrence: Recurrence) {
    setEditing(recurrence);
    setForm({
      frequency: recurrence.frequency,
      value: recurrence.value ? String(recurrence.value) : "",
      room: String(recurrence.room.idRoom),
    });
  }

  function save() {
    if (!editing) return;

    setSaving(true);
    updateRecurrence(editing.idRecurrence, {
      frequency: form.frequency,
      value: Number(form.value || 0),
      idRoom: Number(form.room),
    })
      .then(() => {
        toast.success("Listo: los próximos turnos se van a generar así");
        setEditing(undefined);
        load();
      })
      .catch((err: any) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  function stop(recurrence: Recurrence) {
    stopRecurrence(recurrence.idRecurrence)
      .then(() => {
        toast.success("Se frenó la repetición. Los turnos ya creados siguen en pie.");
        setEditing(undefined);
        load();
      })
      .catch((err: any) => toast.error(err.message));
  }

  return (
    <section className="prof-today">
      <div className="prof-today-head">
        <div>
          <h2 className="prof-today-title">Turnos repetibles</h2>
          <p className="prof-today-date">Se agendan solos hasta cuatro semanas para adelante</p>
        </div>
      </div>

      <div className="adm-panel">
        {recurrences === null ? (
          <div className="prof-today-loading">
            <SkeletonLine height={18} />
            <SkeletonLine width="70%" height={18} />
          </div>
        ) : recurrences.length === 0 ? (
          <div className="adm-empty">
            No tenés turnos repetibles.
            <br />
            Abrí un turno desde la agenda y marcalo como repetible para que se agende solo.
          </div>
        ) : (
          <ul className="prof-repeat-list">
            {recurrences.map((recurrence) => (
              <li className="prof-repeat-item" key={recurrence.idRecurrence}>
                <span className="prof-repeat-icon" aria-hidden="true">
                  <FaRepeat />
                </span>

                <div className="prof-repeat-text">
                  <span className="prof-repeat-when">
                    {weekdayOf(recurrence.startDate)} · {shortHour(recurrence.initialHour)} a {shortHour(recurrence.finalHour)}
                  </span>
                  <span className="prof-repeat-meta">
                    {FREQUENCY_LABELS[recurrence.frequency].toLowerCase()} · {recurrence.room.description}
                    {recurrence.patient ? ` · ${recurrence.patient.surname}, ${recurrence.patient.name}` : " · sin paciente asignado"}
                  </span>
                  <span className="prof-repeat-next">
                    {recurrence.upcoming.length === 0
                      ? "Sin turnos agendados por ahora"
                      : `Próximos: ${recurrence.upcoming
                          .slice(0, 3)
                          .map((item) => formatDayLabel(appointmentDate(item.date)))
                          .join(" · ")}`}
                  </span>
                </div>

                {recurrence.overbooked && <span className="appt-tag-over">Sobreturno</span>}

                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => openEdit(recurrence)}>
                  Configurar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(undefined)}
        title="Turno repetible"
        subtitle={editing ? `${weekdayOf(editing.startDate)} · ${shortHour(editing.initialHour)}` : undefined}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-danger" onClick={() => editing && stop(editing)}>
              Frenar la repetición
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(undefined)}>
              Cerrar
            </button>
            <button type="button" className="adm-btn adm-btn-primary" disabled={saving} onClick={save}>
              Guardar
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">
          Lo que cambies vale para los turnos que falta generar. Los que ya están agendados quedan como están: se editan o se cancelan
          desde la agenda, uno por uno.
        </p>

        <div className="ui-section">
          <label className="ui-field">
            <span>Cada cuánto se repite</span>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurrenceFrequency })}
            >
              {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((key) => (
                <option key={key} value={key}>
                  {FREQUENCY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span>Sala</span>
            <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
              {rooms.map((room) => (
                <option key={room.idRoom} value={room.idRoom}>
                  {room.description}
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
              placeholder="0"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <small>Lo que vas a cobrar por cada uno de los próximos. Vacío queda en 0.</small>
          </label>
        </div>

        <p className="ui-hint">Frenar la repetición no borra ningún turno ya agendado.</p>
      </Modal>
    </section>
  );
}
