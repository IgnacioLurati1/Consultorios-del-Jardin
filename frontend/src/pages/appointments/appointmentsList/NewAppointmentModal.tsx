import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowUpRightFromSquare, FaCalendarCheck, FaBolt } from "react-icons/fa6";
import type { Person, RecurrenceFrequency, Room, Schedule } from "../../types.ts";
import { toISODate } from "../appointmentTypes.ts";
import { buildDaySlots, worksOn } from "../freeSlots.ts";
import { Modal } from "../../../components/modal/Modal.tsx";
import { PatientPicker } from "../../../components/patientPicker/PatientPicker.tsx";
import { RepeatFields } from "./RepeatFields.tsx";

type Mode = "regular" | "overbooked";

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  patients: Person[];
  /** Horarios de atención del profesional. De ahí salen los turnos normales. */
  schedules: Schedule[];
  /**
   * Franja ya elegida, cuando la ventana se abre desde un hueco de la agenda.
   *
   * Llega como día más la clave de la franja —la misma que arma la grilla de horarios—
   * en vez de día, hora y consultorio sueltos. Así lo que queda seleccionado es una
   * franja que existe de verdad, y no una hora que se le parece.
   */
  preset?: { date: string; slotKey: string } | null;
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
export function NewAppointmentModal({ isOpen, onClose, rooms, patients, schedules, preset, onCreate }: NewAppointmentModalProps) {
  const [mode, setMode] = useState<Mode>("regular");
  const [form, setForm] = useState(emptyForm);
  const [slotKey, setSlotKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode("regular");
    setForm({ ...emptyForm, date: preset?.date ?? emptyForm.date, room: rooms[0] ? String(rooms[0].idRoom) : "" });
    setSlotKey(preset?.slotKey ?? "");
    setError(null);
  }, [isOpen, rooms, preset]);

  const slots = useMemo(() => buildDaySlots(schedules, form.date), [schedules, form.date]);
  const selectedSlot = slots.find((slot) => slot.key === slotKey);
  // Se distingue "hoy ya arrancaron todos" de "ese día no atendés": el mensaje cambia.
  const isToday = form.date === toISODate(new Date());
  const alreadyStarted = isToday && worksOn(schedules, form.date);

  function validate(): string | null {
    if (!form.date) return "Falta la fecha";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = form.date.split("-").map(Number);
    if (new Date(y, m - 1, d) < today) return "La fecha ya pasó";

    if (form.value && Number(form.value) < 0) return "El valor no puede ser negativo";

    if (form.repeat && !form.repeatForever && !form.repeatUntil) return "Falta la fecha de fin de la repetición";
    if (form.repeat && !form.repeatForever && form.repeatUntil < form.date)
      return "La fecha de fin no puede ser anterior al turno";

    if (mode === "regular") {
      if (!selectedSlot) return "Falta elegir un turno disponible";
      return null;
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.initialHour) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.finalHour))
      return "Formato de hora inválido. Debe ser HH:MM";
    if (form.initialHour >= form.finalHour) return "La hora de inicio debe ser anterior a la de fin";
    if (!form.room) return "Falta el consultorio";

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
      title={mode === "regular" ? "Nuevo turno" : "Nuevo turno especial"}
      subtitle={
        mode === "regular"
          ? "Dentro de los horarios de atención. Queda confirmado"
          : "Fuera de los horarios de atención, con día, hora y consultorio a elección"
      }
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creando…" : mode === "regular" ? "Crear turno" : "Crear turno especial"}
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
            Turno especial
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
                {slots.length ? "Seleccionar horario…" : alreadyStarted ? "Sin turnos restantes hoy" : "Sin atención ese día"}
              </option>
              {slots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.initialHour} a {slot.finalHour} · {slot.room.description} ({slot.duration} min)
                </option>
              ))}
            </select>
            {slots.length > 0 ? (
              <small>La duración la define cada módulo de la grilla.</small>
            ) : alreadyStarted ? (
              <small>Los turnos de hoy ya comenzaron. Queda la opción de otro día o de un turno especial.</small>
            ) : (
              <small>Sin horarios de atención ese día. Queda la opción de un turno especial o de ajustar la grilla.</small>
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
                <option value="">Seleccionar consultorio…</option>
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
          Ver horarios y duraciones
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
          <small>Vacío equivale a 0. Se puede completar después.</small>
        </label>

        <p className="ui-alert ui-alert-info">Dato visible solo para el profesional y el paciente.</p>

        {/* No es un <label> porque adentro hay una lista de botones, y un botón adentro
            de una etiqueta no se comporta igual en todos los navegadores. */}
        <div className="ui-field">
          <span>Paciente</span>
          <PatientPicker
            patients={patients}
            value={form.patientEmail}
            onChange={(patientEmail) => setForm({ ...form, patientEmail })}
            placeholder="Sin paciente"
          />
          <small>La franja queda reservada y el paciente se asigna después.</small>
        </div>

      </div>

      <div className="ui-section">
        <label className="ui-choice">
          <input
            type="checkbox"
            checked={form.repeat}
            onChange={(e) => setForm({ ...form, repeat: e.target.checked })}
          />
          <span>Repetir</span>
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
