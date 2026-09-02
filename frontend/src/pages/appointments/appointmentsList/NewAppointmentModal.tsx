import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowUpRightFromSquare, FaCalendarCheck, FaBolt } from "react-icons/fa6";
import type { Person, RecurrenceFrequency, Room, Schedule } from "../../types.ts";
import { toISODate } from "../appointmentTypes.ts";
import { Modal } from "../../../components/modal/Modal.tsx";
import { RepeatFields } from "./RepeatFields.tsx";

type Mode = "regular" | "overbooked";

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  patients: Person[];
  /** Horarios de atención del profesional. De ahí salen los turnos normales. */
  schedules: Schedule[];
  onCreate: (data: {
    date: string;
    initialHour: string;
    finalHour: string;
    room: string;
    value: number;
    patientEmail?: string;
    overbooked: boolean;
    /** Si viene, el turno queda marcado como repetible apenas se crea. */
    repeat: { frequency: RecurrenceFrequency; endDate: string | null } | null;
  }) => Promise<void>;
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function dayNameOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function addMinutes(hour: string, minutes: number): string {
  const [h, m] = hour.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const shortHour = (hour: string) => (hour ?? "").slice(0, 5);

/** La hora actual como "HH:MM", para comparar contra los horarios de los módulos. */
function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

interface Slot {
  key: string;
  initialHour: string;
  finalHour: string;
  room: Room;
  duration: number;
}

/**
 * Divide cada módulo del día en turnos del largo que definió el profesional.
 * Si el día es hoy, deja afuera los que ya arrancaron: no tiene sentido ofrecer
 * una franja que ya pasó (el backend la rechazaría igual).
 */
function buildSlots(schedules: Schedule[], isoDate: string): Slot[] {
  if (!isoDate) return [];

  const day = dayNameOf(isoDate);
  const isToday = isoDate === toISODate(new Date());
  const from = isToday ? nowHHMM() : "";
  const slots: Slot[] = [];

  for (const schedule of schedules.filter((s) => s.day === day)) {
    let hour = shortHour(schedule.initialHour);
    const end = shortHour(schedule.finalHour);

    while (addMinutes(hour, schedule.duration) <= end) {
      const finalHour = addMinutes(hour, schedule.duration);

      if (hour > from) {
        slots.push({
          key: `${hour}-${schedule.room.idRoom}`,
          initialHour: hour,
          finalHour,
          room: schedule.room,
          duration: schedule.duration,
        });
      }

      hour = finalHour;
    }
  }

  return slots.sort((a, b) => a.initialHour.localeCompare(b.initialHour));
}

/** Si el profesional atiende ese día, aunque ya no queden turnos por delante. */
function worksOn(schedules: Schedule[], isoDate: string): boolean {
  return !!isoDate && schedules.some((s) => s.day === dayNameOf(isoDate));
}

const emptyForm = {
  date: toISODate(new Date()),
  initialHour: "09:00",
  finalHour: "10:00",
  room: "",
  value: "",
  patientEmail: "",
  /** Que el turno se repita solo, sin tener que abrirlo después para marcarlo. */
  repeat: false,
  frequency: "weekly" as RecurrenceFrequency,
  repeatForever: true,
  repeatUntil: "",
};

/**
 * Alta de un turno desde el profesional (autogestión). Dos formas de darlo:
 * el turno normal, que cae en uno de sus módulos y dura lo que dure ese módulo,
 * y el sobreturno, donde elige día, horario y consultorio a mano.
 * El paciente es opcional: se puede reservar la franja y asignarlo después.
 */
export function NewAppointmentModal({ isOpen, onClose, rooms, patients, schedules, onCreate }: NewAppointmentModalProps) {
  const [mode, setMode] = useState<Mode>("regular");
  const [form, setForm] = useState(emptyForm);
  const [slotKey, setSlotKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("regular");
    setForm({ ...emptyForm, room: rooms[0] ? String(rooms[0].idRoom) : "" });
    setSlotKey("");
    setError(null);
  }, [isOpen, rooms]);

  const slots = useMemo(() => buildSlots(schedules, form.date), [schedules, form.date]);
  const selectedSlot = slots.find((slot) => slot.key === slotKey);
  // Se distingue "hoy ya arrancaron todos" de "ese día no atendés": el mensaje cambia.
  const isToday = form.date === toISODate(new Date());
  const alreadyStarted = isToday && worksOn(schedules, form.date);

  useEffect(() => {
    // Al cambiar de fecha, la franja elegida deja de existir.
    setSlotKey("");
  }, [form.date]);

  function validate(): string | null {
    if (!form.date) return "Elegí una fecha";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = form.date.split("-").map(Number);
    if (new Date(y, m - 1, d) < today) return "No se puede crear un turno en una fecha que ya pasó";

    if (form.value && Number(form.value) < 0) return "El valor no puede ser negativo";

    if (form.repeat && !form.repeatForever && !form.repeatUntil) return "Elegí hasta qué día se repite";
    if (form.repeat && !form.repeatForever && form.repeatUntil < form.date)
      return "La fecha de corte no puede ser anterior al turno";

    if (mode === "regular") {
      if (!selectedSlot) return "Elegí uno de los turnos disponibles";
      return null;
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.initialHour) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.finalHour))
      return "Las horas tienen que tener formato HH:MM";
    if (form.initialHour >= form.finalHour) return "La hora de inicio tiene que ser anterior a la de fin";
    if (!form.room) return "Elegí un consultorio";

    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        date: form.date,
        initialHour: mode === "regular" ? selectedSlot!.initialHour : form.initialHour,
        finalHour: mode === "regular" ? selectedSlot!.finalHour : form.finalHour,
        room: mode === "regular" ? String(selectedSlot!.room.idRoom) : form.room,
        value: Number(form.value || 0),
        patientEmail: form.patientEmail || undefined,
        overbooked: mode === "overbooked",
        repeat: form.repeat ? { frequency: form.frequency, endDate: form.repeatForever ? null : form.repeatUntil } : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={mode === "regular" ? "Nuevo turno" : "Nuevo sobreturno"}
      subtitle={
        mode === "regular"
          ? "Dentro de tus horarios de atención. Queda confirmado directamente"
          : "Fuera de tus horarios: elegís día, hora y consultorio a mano"
      }
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creando…" : mode === "regular" ? "Crear turno" : "Crear sobreturno"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="appt-mode-toggle" role="group" aria-label="Tipo de turno">
          <button type="button" className={mode === "regular" ? "active" : ""} onClick={() => setMode("regular")} aria-pressed={mode === "regular"}>
            <FaCalendarCheck />
            Turno
          </button>
          <button
            type="button"
            className={mode === "overbooked" ? "active" : ""}
            onClick={() => setMode("overbooked")}
            aria-pressed={mode === "overbooked"}
          >
            <FaBolt />
            Sobreturno
          </button>
        </div>

        <label className="ui-field">
          <span>Fecha</span>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>

        {mode === "regular" ? (
          <label className="ui-field">
            <span>Turno disponible</span>
            <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} disabled={slots.length === 0}>
              <option value="">
                {slots.length ? "Elegí un horario…" : alreadyStarted ? "Ya no quedan turnos hoy" : "Ese día no atendés"}
              </option>
              {slots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.initialHour} a {slot.finalHour} · {slot.room.description} ({slot.duration} min)
                </option>
              ))}
            </select>
            {slots.length > 0 ? (
              <small>La duración la define cada módulo de tu grilla de horarios.</small>
            ) : alreadyStarted ? (
              <small>Los turnos de hoy ya arrancaron. Elegí otro día, o cargalo como sobreturno.</small>
            ) : (
              <small>No tenés horarios de atención ese día. Cargalo como sobreturno o revisá tu grilla.</small>
            )}
          </label>
        ) : (
          <>
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
              <span>Consultorio</span>
              <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
                <option value="">Elegí una sala…</option>
                {rooms.map((room) => (
                  <option key={room.idRoom} value={room.idRoom}>
                    {room.description}
                    {room.office?.description ? ` · ${room.office.description}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <Link className="adm-btn adm-btn-ghost appt-schedule-link" to="/scheduleProfessional" target="_blank" rel="noreferrer">
          <FaArrowUpRightFromSquare />
          Ver mis horarios y duraciones
        </Link>
      </div>

      <div className="ui-section">
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
          <small>Si lo dejás vacío queda en 0 y lo podés completar después.</small>
        </label>

        <p className="ui-alert ui-alert-info">Este dato es privado entre el paciente y vos.</p>

        <label className="ui-field">
          <span>Paciente</span>
          <select value={form.patientEmail} onChange={(e) => setForm({ ...form, patientEmail: e.target.value })}>
            <option value="">Sin paciente por ahora</option>
            {patients.map((p) => (
              <option key={p.email} value={p.email}>
                {p.surname}, {p.name} {p.anonymous ? "(anónimo)" : ""}
              </option>
            ))}
          </select>
          <small>Podés dejar la franja reservada y asignar al paciente más adelante.</small>
        </label>

      </div>

      <div className="ui-section">
        <label className="ui-choice">
          <input
            type="checkbox"
            checked={form.repeat}
            onChange={(e) => setForm({ ...form, repeat: e.target.checked })}
          />
          <span>Que se repita</span>
        </label>

        {form.repeat && (
          <RepeatFields
            label="Cada cuánto"
            name="new-repeat-end"
            frequency={form.frequency}
            onFrequency={(frequency) => setForm({ ...form, frequency })}
            forever={form.repeatForever}
            onForever={(repeatForever) => setForm({ ...form, repeatForever })}
            until={form.repeatUntil}
            onUntil={(repeatUntil) => setForm({ ...form, repeatUntil })}
            minDate={form.date}
          />
        )}

        {error && <p className="ui-alert ui-alert-error">{error}</p>}
      </div>
    </Modal>
  );
}
