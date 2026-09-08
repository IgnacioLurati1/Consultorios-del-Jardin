import type { HTMLAttributes } from "react";
import type { Appointment, Person } from "../../types.ts";
import { cancellationNotice, describeState, isCancelled, shortHour } from "../appointmentTypes.ts";
import { FaRegClock, FaLocationDot, FaUser } from "react-icons/fa6";

interface AppointmentCardProps {
  appointment: Appointment;
  user: Person;
  onOpen: (appointment: Appointment) => void;
  /** Click derecho y teclado. Para el paciente viene vacío y la tarjeta es la de siempre. */
  quickActions?: (appointment: Appointment) => HTMLAttributes<HTMLElement>;
}

/**
 * Una fila de la vista lista. La franja de la izquierda y el horario se tiñen
 * del mismo color que el cartel de estado, para leer la tarjeta de un vistazo.
 */
export function AppointmentCard({ appointment, user, onOpen, quickActions }: AppointmentCardProps) {
  const state = describeState(appointment.state);
  const cancelled = isCancelled(appointment.state);
  const isProfessional = user.type === "professional";

  // La marca es para el profesional, que es quien decide qué hacer con una baja sobre la
  // hora. Al paciente no se le pone un cartel encima de algo que ya hizo: la fecha de su
  // baja la ve igual al abrir el turno.
  const notice = isProfessional ? cancellationNotice(appointment) : null;

  /*
   * Un cancelado sale apagado, y está bien: es lo que ya no va a pasar. Pero prendiendo
   * "ver los cancelados" quedan todos iguales, y el que avisó sobre la hora es el único
   * que el profesional está buscando ahí adentro. Va con el color de lo que hay que
   * mirar, igual que un "No vino", que es a lo que se parece en consecuencias.
   */
  const stateClass = cancelled ? (notice?.short ? "cancelled late" : "cancelled") : appointment.state;

  const counterpart = isProfessional
    ? appointment.patient
      ? `${appointment.patient.surname}, ${appointment.patient.name}`
      : "Sin paciente asignado"
    : `${appointment.professional.surname}, ${appointment.professional.name}`;

  return (
    <button
      type="button"
      className={`appt-card state-${stateClass}`}
      onClick={() => onOpen(appointment)}
      {...quickActions?.(appointment)}
    >
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
        {notice?.short && <span className="adm-badge adm-badge-red">Baja con poco aviso</span>}
        <span className={state.className}>{state.label}</span>
      </span>
    </button>
  );
}
