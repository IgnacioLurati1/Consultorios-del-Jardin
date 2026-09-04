import type { Appointment, Person } from "../../types.ts";
import { describeState, isCancelled, shortHour } from "../appointmentTypes.ts";
import { FaRegClock, FaLocationDot, FaUser } from "react-icons/fa6";

interface AppointmentCardProps {
  appointment: Appointment;
  user: Person;
  onOpen: (appointment: Appointment) => void;
}

/**
 * Una fila de la vista lista. La franja de la izquierda y el horario se tiñen
 * del mismo color que el cartel de estado, para leer la tarjeta de un vistazo.
 */
export function AppointmentCard({ appointment, user, onOpen }: AppointmentCardProps) {
  const state = describeState(appointment.state);
  const cancelled = isCancelled(appointment.state);
  const isProfessional = user.type === "professional";

  const stateClass = cancelled ? "cancelled" : appointment.state;

  const counterpart = isProfessional
    ? appointment.patient
      ? `${appointment.patient.surname}, ${appointment.patient.name}`
      : "Sin paciente asignado"
    : `${appointment.professional.surname}, ${appointment.professional.name}`;

  return (
    <button type="button" className={`appt-card state-${stateClass}`} onClick={() => onOpen(appointment)}>
      <span className="appt-card-hours">
        <FaRegClock aria-hidden="true" />
        {shortHour(appointment.initialHour)} – {shortHour(appointment.finalHour)}
      </span>

      <span className="appt-card-main">
        <span className={`appt-card-person ${!isProfessional || appointment.patient ? "" : "muted"}`}>
          <FaUser aria-hidden="true" />
          {counterpart}
        </span>
        <span className="appt-card-room">
          <FaLocationDot aria-hidden="true" />
          {appointment.room?.description}
          {appointment.room?.office?.description ? ` · ${appointment.room.office.description}` : ""}
        </span>
      </span>

      <span className="appt-card-tags">
        {appointment.origin === "import" && <span className="appt-tag-import">Importado</span>}
        {appointment.overbooked && <span className="appt-tag-over">Sobreturno</span>}
        <span className={state.className}>{state.label}</span>
      </span>
    </button>
  );
}
