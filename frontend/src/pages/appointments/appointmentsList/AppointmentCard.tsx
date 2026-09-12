import type { HTMLAttributes } from "react";
import type { Appointment, Person } from "../../types.ts";
import { cancellationNotice, describeState, isCancelled, isOwnBooking, shortHour } from "../appointmentTypes.ts";
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
  // El turno que sacó para atenderse él. Es el único de su agenda donde no es quien
  // atiende, así que de acá para abajo la tarjeta se arma como la de un paciente.
  const own = isOwnBooking(appointment, user);
  const isProfessional = user.type === "professional" && !own;

  // La marca es para el profesional, que es quien decide qué hacer con una baja sobre la
  // hora. Al paciente no se le pone un cartel encima de algo que ya hizo: la fecha de su
  // baja la ve igual al abrir el turno.
  const notice = isProfessional ? cancellationNotice(appointment) : null;

  // Contestó "Sí, voy" desde el mail del día anterior. Es para quien atiende: le dice a
  // quién no hace falta llamar.
  const confirmed = isProfessional && !!appointment.attendanceConfirmedAt && appointment.state === "accepted";

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
      className={`appt-card state-${stateClass} ${own ? "own" : ""}`}
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
        {/* Con la agenda llena, el color solo dice "este es distinto". El cartel dice
            por qué, que es lo que hace falta para no leerlo como un paciente más. */}
        {own && <span className="appt-tag-own">Turno propio</span>}
        {appointment.origin === "import" && <span className="appt-tag-import">Importado</span>}
        {appointment.overbooked && <span className="appt-tag-over">Turno especial</span>}
        {notice?.short && <span className="adm-badge adm-badge-red">Baja con poco aviso</span>}
        {confirmed && <span className="appt-tag-confirmed">Confirmó que viene</span>}
        <span className={state.className}>{state.label}</span>
      </span>
    </button>
  );
}
