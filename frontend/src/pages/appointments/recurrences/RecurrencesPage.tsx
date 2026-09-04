import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FaRepeat } from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader";
import { Modal } from "../../../components/modal/Modal";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { Toasts } from "../../../components/toast/Toasts";
import { findRecurrences, stopRecurrence, updateRecurrence, FREQUENCY_LABELS } from "../recurrencesService";
import { findAllActiveRooms } from "../../adminCRUDS/adminRooms/RoomService";
import { appointmentDate, formatDayLabel, shortHour } from "../appointmentTypes";
import type { Recurrence, RecurrenceFrequency, Room } from "../../types";
import "../../adminCRUDS/adminPanel.css";
import "../../homePages/professionalHome/professionalHome.css";
import "./recurrences.css";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Los turnos repetibles caen siempre el mismo día: el de la fecha que los originó. */
function weekdayOf(startDate: string): string {
  return DAY_NAMES[appointmentDate(startDate).getDay()];
}

function shortDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

/** El orden en que se lee una agenda: por día de la semana y después por hora. */
function byWhen(a: Recurrence, b: Recurrence): number {
  const dayA = appointmentDate(a.startDate).getDay();
  const dayB = appointmentDate(b.startDate).getDay();

  // El domingo cierra la semana en vez de abrirla, que es como se lee una agenda.
  const weekA = dayA === 0 ? 7 : dayA;
  const weekB = dayB === 0 ? 7 : dayB;

  return weekA - weekB || a.initialHour.localeCompare(b.initialHour);
}

/**
 * Los turnos repetibles del profesional, en su propia pantalla.
 *
 * Antes vivían apretados al pie del panel, donde no entraba más que el día y la hora.
 * Acá hay lugar para lo que hace falta para decidir: con quién es cada uno, hasta
 * cuándo va, y qué turnos dejó agendados.
 *
 * Sigue siendo la receta y no los turnos: cambiar algo vale para los que falta generar,
 * y los que ya están creados se editan o se cancelan desde la agenda, uno por uno.
 */
export function RecurrencesPage() {
  const [recurrences, setRecurrences] = useState<Recurrence[] | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState<Recurrence | undefined>(undefined);
  const [form, setForm] = useState({
    frequency: "weekly" as RecurrenceFrequency,
    value: "",
    room: "",
    forever: true,
    endDate: "",
  });
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

  const ordered = useMemo(() => (recurrences ? [...recurrences].sort(byWhen) : null), [recurrences]);

  function openEdit(recurrence: Recurrence) {
    setEditing(recurrence);
    setForm({
      frequency: recurrence.frequency,
      value: recurrence.value ? String(recurrence.value) : "",
      room: String(recurrence.room.idRoom),
      forever: !recurrence.endDate,
      endDate: recurrence.endDate?.slice(0, 10) ?? "",
    });
  }

  function save() {
    if (!editing) return;

    setSaving(true);
    updateRecurrence(editing.idRecurrence, {
      frequency: form.frequency,
      value: Number(form.value || 0),
      idRoom: Number(form.room),
      endDate: form.forever ? null : form.endDate,
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

  const total = ordered?.length ?? 0;

  return (
    <div className="adm-page">
      <AdminHeader
        title="Turnos repetibles"
        subtitle={
          total === 0
            ? "Los turnos que se agendan solos"
            : `${total} ${total === 1 ? "repetición activa" : "repeticiones activas"} · se agendan solas hasta cuatro semanas para adelante`
        }
        backTo="/ProfessionalHome"
        backLabel="Panel"
      />

      {ordered === null ? (
        <div className="adm-panel">
          <div className="prof-today-loading">
            <SkeletonLine height={18} />
            <SkeletonLine width="70%" height={18} />
            <SkeletonLine width="45%" height={18} />
          </div>
        </div>
      ) : ordered.length === 0 ? (
        <div className="adm-panel">
          <div className="adm-empty">
            No tenés turnos repetibles.
            <br />
            Abrí un turno desde la agenda y marcalo como repetible para que se agende solo.
          </div>
        </div>
      ) : (
        <div className="rec-grid">
          {ordered.map((recurrence) => (
            <article className="rec-card adm-enter" key={recurrence.idRecurrence}>
              <header className="rec-card-head">
                <span className="rec-card-icon" aria-hidden="true">
                  <FaRepeat />
                </span>
                <div className="rec-card-titles">
                  <h2 className="rec-card-when">
                    {weekdayOf(recurrence.startDate)} · {shortHour(recurrence.initialHour)}
                  </h2>
                  <p className="rec-card-freq">
                    {FREQUENCY_LABELS[recurrence.frequency].toLowerCase()}, hasta las{" "}
                    {shortHour(recurrence.finalHour)}
                  </p>
                </div>
              </header>

              <div className="rec-card-facts">
                <div className="rec-fact">
                  <span>Paciente</span>
                  <strong>
                    {recurrence.patient ? (
                      `${recurrence.patient.surname}, ${recurrence.patient.name}`
                    ) : (
                      <span className="ui-detail-empty">sin asignar</span>
                    )}
                  </strong>
                </div>
                <div className="rec-fact">
                  <span>Consultorio</span>
                  <strong>{recurrence.room.description}</strong>
                </div>
                <div className="rec-fact">
                  <span>Valor</span>
                  <strong>{recurrence.value ? `$${recurrence.value.toLocaleString("es-AR")}` : "—"}</strong>
                </div>
                <div className="rec-fact">
                  <span>Hasta</span>
                  <strong>{recurrence.endDate ? shortDate(recurrence.endDate) : "sin fecha de corte"}</strong>
                </div>
              </div>

              <div className="rec-card-next">
                <span className="rec-card-next-label">Próximos</span>
                {recurrence.upcoming.length === 0 ? (
                  <span className="ui-detail-empty">Sin turnos agendados por ahora</span>
                ) : (
                  <ul className="rec-next-list">
                    {recurrence.upcoming.slice(0, 4).map((item) => (
                      <li key={item.numAppointment}>{formatDayLabel(appointmentDate(item.date))}</li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="rec-card-foot">
                {recurrence.overbooked && <span className="appt-tag-over">Sobreturno</span>}
                {recurrence.endDate && <span className="appt-tag-until">hasta el {shortDate(recurrence.endDate)}</span>}
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => openEdit(recurrence)}>
                  Configurar
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

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
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={saving || (!form.forever && !form.endDate)}
              onClick={save}
            >
              Guardar
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">
          Lo que cambies vale para los turnos que falta generar. Los que ya están agendados quedan como están: se editan
          o se cancelan desde la agenda, uno por uno.
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

          <div className="ui-field">
            <span>¿Hasta cuándo?</span>
            <div className="ui-choice-row">
              <label className="ui-choice">
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={form.forever}
                  onChange={() => setForm({ ...form, forever: true })}
                />
                <span>Sin fecha de corte</span>
              </label>
              <label className="ui-choice">
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={!form.forever}
                  onChange={() => setForm({ ...form, forever: false })}
                />
                <span>Hasta una fecha</span>
              </label>
            </div>

            {!form.forever && (
              <input
                type="date"
                value={form.endDate}
                min={editing?.startDate?.slice(0, 10)}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            )}

            <small>
              {form.forever
                ? "Se repite hasta que la frenes a mano."
                : "Adelantar la fecha no borra los turnos ya creados. Esos se cancelan desde la agenda."}
            </small>
          </div>

          <label className="ui-field">
            <span>Consultorio</span>
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
            <p className="ui-alert ui-alert-info">Este dato es privado entre el paciente y vos.</p>
          </label>
        </div>

        <p className="ui-hint">Frenar la repetición no borra ningún turno ya agendado.</p>
      </Modal>

      <Toasts />
    </div>
  );
}
