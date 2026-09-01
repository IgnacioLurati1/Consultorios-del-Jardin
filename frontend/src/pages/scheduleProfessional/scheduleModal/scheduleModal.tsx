import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import type { Room, Office, City } from "../../types.ts";
import type { scheduleModalProps } from "../scheduleTypes.ts";
import { Modal } from "../../../components/modal/Modal.tsx";
import "./scheduleModal.css";

// Duraciones permitidas para un módulo. Es la única lista válida, también en el backend.
const durations: number[] = [30, 45, 60];

function validateOfficeTimes(initialHour: string, finalHour: string): boolean {
  if (!initialHour || !finalHour) return false;
  return initialHour < finalHour;
}

const emptySchedule = { day: "", initialHour: "", finalHour: "", person: "", room: "", duration: 60 };

export function ScheduleModal({
  isOpen,
  onClose,
  schedule,
  cellKey,
  daysSpanish,
  professional,
  rooms,
  offices,
  cities,
  onCreate,
  onDelete,
  isProfessional,
  onUpdateDuration,
}: scheduleModalProps) {
  const [newScheduleData, setNewScheduleData] = useState({ ...emptySchedule, person: professional.email });
  const [room, setRoom] = useState<Room>();
  const [office, setOffice] = useState<Office>();
  const [city, setCity] = useState<City>();
  const [errors, setErrors] = useState<{
    initialHour?: string;
    finalHour?: string;
    city?: string;
    office?: string;
    room?: string;
    duration?: string;
  }>({});
  const [editedDuration, setEditedDuration] = useState<number>(schedule?.duration ?? 30);

  useEffect(() => {
    if (schedule) setEditedDuration(schedule.duration);
  }, [schedule]);

  useEffect(() => {
    if (cellKey && isOpen) {
      const [day, hour] = cellKey.split("-");
      setNewScheduleData({ day, initialHour: hour, finalHour: "", person: professional.email, room: "", duration: 60 });
      setOffice(undefined);
      setRoom(undefined);
      setCity(undefined);
      setErrors({});
    }
  }, [cellKey, isOpen]);

  if (!isOpen) return null;

  const filteredOffices = city ? offices.filter((o) => o.city.idCity === city.idCity) : [];
  const filteredRooms = office ? rooms.filter((r) => r.office.idOffice === office.idOffice) : [];

  function validateInputs() {
    const newErrors: typeof errors = {};

    if (!newScheduleData.initialHour.trim()) newErrors.initialHour = "Ingresá la hora de inicio";
    else if (newScheduleData.initialHour < "08:00") newErrors.initialHour = "El consultorio abre a las 08:00";

    if (!newScheduleData.finalHour.trim()) newErrors.finalHour = "Ingresá la hora de fin";
    else if (newScheduleData.finalHour > "21:00") newErrors.finalHour = "El consultorio cierra a las 21:00";

    if (
      newScheduleData.initialHour.trim() &&
      newScheduleData.finalHour.trim() &&
      !validateOfficeTimes(newScheduleData.initialHour, newScheduleData.finalHour)
    ) {
      newErrors.finalHour = "La hora de fin tiene que ser posterior a la de inicio";
    }

    if (!city) newErrors.city = "Elegí una localidad";
    if (!office) newErrors.office = "Elegí un consultorio";
    if (!room) newErrors.room = "Elegí una sala";
    if (!newScheduleData.duration) newErrors.duration = "Elegí la duración de los turnos";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validateInputs()) {
      toast.dismiss();
      return;
    }

    if (!schedule && onCreate) {
      onCreate({
        day: newScheduleData.day,
        initialHour: newScheduleData.initialHour,
        finalHour: newScheduleData.finalHour,
        room: newScheduleData.room,
        personEmail: professional.email,
        duration: newScheduleData.duration,
      });
    }
  }

  /* ---------- ver un horario ya cargado ---------- */
  if (schedule) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title="Horario"
        subtitle={`${schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)} de ${schedule.initialHour} a ${schedule.finalHour}`}
        footer={
          <>
            {!isProfessional && onDelete && (
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                onClick={() => onDelete(schedule.person.email, schedule.day, schedule.initialHour)}
              >
                Eliminar horario
              </button>
            )}
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
          </>
        }
      >
        <div className="ui-section">
          <div className="ui-detail-list">
            <div className="ui-detail-row">
              <span>Profesional</span>
              <strong>
                {schedule.person.surname}, {schedule.person.name}
              </strong>
            </div>
            <div className="ui-detail-row">
              <span>Sala</span>
              <strong>{schedule.room.description}</strong>
            </div>
            {!onUpdateDuration && (
              <div className="ui-detail-row">
                <span>Duración de cada turno</span>
                <strong>{schedule.duration} min</strong>
              </div>
            )}
          </div>
        </div>

        {/* El profesional define cuánto dura cada turno de este módulo. */}
        {onUpdateDuration && (
          <div className="ui-section">
            <h3 className="ui-section-title">Duración de cada turno</h3>
            <div className="duration-editor-row">
              <select
                id="schedule-duration"
                className="input-modal"
                value={editedDuration}
                onChange={(e) => setEditedDuration(Number(e.target.value))}
              >
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                disabled={editedDuration === schedule.duration}
                onClick={() => onUpdateDuration(schedule.day, schedule.initialHour, schedule.person.email, editedDuration)}
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  /* ---------- el profesional no crea sus propios horarios ---------- */
  if (isProfessional) {
    return (
      <Modal
        open
        onClose={onClose}
        size="sm"
        title="Franja libre"
        footer={
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        }
      >
        <p className="ui-alert ui-alert-info">
          Los horarios de atención los carga el administrador del consultorio. Escribile para que te agregue esta franja a la grilla.
        </p>
      </Modal>
    );
  }

  /* ---------- alta de horario (admin) ---------- */
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo horario"
      subtitle={`${professional.surname}, ${professional.name}`}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSubmit}>
            Crear horario
          </button>
        </>
      }
    >
      <div className="ui-section">
        <label className="ui-field">
          <span>Día</span>
          <select value={newScheduleData.day} onChange={(e) => setNewScheduleData({ ...newScheduleData, day: e.target.value })}>
            {daysSpanish.map((day) => (
              <option key={day} value={day}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <div className="ui-field-row">
          <label className="ui-field">
            <span>Empieza a las</span>
            <input
              type="time"
              step="3600"
              value={newScheduleData.initialHour}
              onChange={(e) => setNewScheduleData({ ...newScheduleData, initialHour: e.target.value })}
            />
            {errors.initialHour && <small className="ui-hint">{errors.initialHour}</small>}
          </label>
          <label className="ui-field">
            <span>Termina a las</span>
            <input
              type="time"
              step="3600"
              value={newScheduleData.finalHour}
              onChange={(e) => setNewScheduleData({ ...newScheduleData, finalHour: e.target.value })}
            />
            {errors.finalHour && <small className="ui-hint">{errors.finalHour}</small>}
          </label>
        </div>

        <label className="ui-field">
          <span>Duración de cada turno</span>
          <select
            value={newScheduleData.duration}
            onChange={(e) => setNewScheduleData({ ...newScheduleData, duration: Number(e.target.value) })}
          >
            {durations.map((dur) => (
              <option key={dur} value={dur}>
                {dur} min
              </option>
            ))}
          </select>
          {errors.duration && <small className="ui-hint">{errors.duration}</small>}
        </label>
      </div>

      <div className="ui-section">
        <h3 className="ui-section-title">Dónde atiende</h3>

        <label className="ui-field">
          <span>Localidad</span>
          <select
            value={city?.idCity || ""}
            onChange={(e) => {
              setCity(cities.find((c) => String(c.idCity) === e.target.value));
              setOffice(undefined);
              setRoom(undefined);
              setNewScheduleData({ ...newScheduleData, room: "" });
            }}
          >
            <option value="">Elegí una localidad…</option>
            {cities.map((c) => (
              <option key={c.idCity} value={c.idCity}>
                {c.nameCity}
              </option>
            ))}
          </select>
          {errors.city && <small className="ui-hint">{errors.city}</small>}
        </label>

        <label className="ui-field">
          <span>Consultorio</span>
          <select
            value={office?.idOffice || ""}
            disabled={!city}
            onChange={(e) => {
              setOffice(offices.find((o) => String(o.idOffice) === e.target.value));
              setRoom(undefined);
              setNewScheduleData({ ...newScheduleData, room: "" });
            }}
          >
            <option value="">{city ? "Elegí un consultorio…" : "Elegí primero la localidad"}</option>
            {filteredOffices.map((o) => (
              <option key={o.idOffice} value={o.idOffice}>
                {o.description}
              </option>
            ))}
          </select>
          {errors.office && <small className="ui-hint">{errors.office}</small>}
        </label>

        <label className="ui-field">
          <span>Sala</span>
          <select
            value={room?.idRoom || ""}
            disabled={!office}
            onChange={(e) => {
              const selected = rooms.find((r) => String(r.idRoom) === e.target.value);
              setRoom(selected);
              setNewScheduleData({ ...newScheduleData, room: selected ? selected.idRoom : "" });
            }}
          >
            <option value="">{office ? "Elegí una sala…" : "Elegí primero el consultorio"}</option>
            {filteredRooms.map((r) => (
              <option key={r.idRoom} value={r.idRoom}>
                {r.description}
              </option>
            ))}
          </select>
          {errors.room && <small className="ui-hint">{errors.room}</small>}
        </label>
      </div>
    </Modal>
  );
}
