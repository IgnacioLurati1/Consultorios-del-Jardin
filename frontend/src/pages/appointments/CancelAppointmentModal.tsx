import { Modal } from "../../components/modal/Modal.tsx";
import { TECLA_MOD } from "../../lib/shortcuts.ts";
import type { Appointment } from "../types.ts";
import { appointmentDate, formatDayLabel, shortHour } from "./appointmentTypes.ts";

interface Props {
  /** El turno que se está por dar de baja. Sin turno, no hay ventana. */
  appointment?: Appointment;
  /**
   * Cuánta gente de la lista de espera busca este horario. Con alguien, la ventana deja
   * elegir si se les avisa; en cero es la de siempre.
   */
  waitlistCount?: number;
  onClose: () => void;
  /** `notifyWaitlist` es lo que eligió sobre la lista de espera. Sin nadie esperando, va en false. */
  onConfirm: (appointment: Appointment, notifyWaitlist: boolean) => void;
}

/**
 * Preguntar antes de bajar un turno.
 *
 * Con el teclado se pregunta siempre: con Retroceso alcanza con que el foco haya quedado
 * sobre un turno, que es justo lo que pasa al cerrar su ficha, y del otro lado hay un mail
 * que sale y un cambio que no se puede deshacer. La ventana dice de quién es el turno y
 * qué día: es lo único que deja darse cuenta de que era otro antes de que sea tarde.
 *
 * Desde la ficha se pregunta solo si hay gente esperando ese horario, porque ahí hay algo
 * que decidir: si se cancela porque ese día no se va a estar, avisarles es mandarlos a una
 * puerta cerrada.
 */
export function CancelAppointmentModal({ appointment, waitlistCount = 0, onClose, onConfirm }: Props) {
  if (!appointment) return null;

  // Todavía sin confirmar: el backend lo borra en vez de dejarlo cancelado.
  const pendiente = appointment.state === "pending";
  const paciente = appointment.patient
    ? `${appointment.patient.surname}, ${appointment.patient.name}`
    : "Sin paciente asignado";
  const esperan = waitlistCount;

  return (
    <Modal
      open
      onClose={onClose}
      title={pendiente ? "¿Eliminar el turno?" : "¿Cancelar el turno?"}
      subtitle={`${formatDayLabel(appointmentDate(appointment.date))} · ${shortHour(appointment.initialHour)} · ${paciente}`}
      // Con la pregunta de la lista de espera son tres botones, y en la angosta el último
      // se caía a otro renglón, justo el que hay que leer con más cuidado.
      size={esperan > 0 ? "md" : "sm"}
      footer={
        esperan > 0 ? (
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Volver
            </button>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onConfirm(appointment, false)}>
              {pendiente ? "Eliminar sin avisar" : "Cancelar sin avisar"}
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={() => onConfirm(appointment, true)}>
              {pendiente ? "Eliminar y avisarles" : "Cancelar y avisarles"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Volver
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={() => onConfirm(appointment, false)}>
              {pendiente ? "Sí, eliminarlo" : "Sí, cancelarlo"}
            </button>
          </>
        )
      }
    >
      <p className="adm-confirm-lead">
        {pendiente
          ? "El turno todavía no está confirmado, así que se borra y el horario queda libre."
          : "El turno queda cancelado y en el historial, y el horario queda libre."}
      </p>

      {esperan > 0 && (
        <p className="ui-alert ui-alert-info">
          {esperan === 1
            ? "Hay una persona en tu lista de espera que busca este horario."
            : `Hay ${esperan} personas en tu lista de espera que buscan este horario.`}{" "}
          Si les avisás, les llega un mail y se lo queda el primero que lo reserva. Si lo cancelás porque ese día no vas a
          estar, mejor no avisarles.
        </p>
      )}

      <p className="adm-confirm-note">
        {appointment.patient ? "Al paciente le llega un mail avisándole. " : ""}
        {/* Bajar un pedido sin confirmar es un rechazo, y los rechazos del mes se cuentan.
            No lo dice ninguna otra pantalla, y es la clase de cosa que conviene saber
            antes y no cuando aparece en los números. */}
        {pendiente ? "Cuenta como un pedido rechazado del mes. " : ""}
        Esto no se puede deshacer con {TECLA_MOD} + Z.
      </p>
    </Modal>
  );
}
