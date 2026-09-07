import { Modal } from "../../components/modal/Modal.tsx";
import { TECLA_MOD } from "../../lib/shortcuts.ts";
import type { Appointment } from "../types.ts";
import { appointmentDate, formatDayLabel, shortHour } from "./appointmentTypes.ts";

interface Props {
  /** El turno que se está por dar de baja. Sin turno, no hay ventana. */
  appointment?: Appointment;
  onClose: () => void;
  onConfirm: (appointment: Appointment) => void;
}

/**
 * Preguntar antes de bajar un turno con el teclado.
 *
 * Desde la ficha del turno no hace falta: hay que abrirla, buscar el botón rojo y
 * apretarlo. Con Retroceso alcanza con que el foco haya quedado sobre un turno, que es
 * justo lo que pasa al cerrar su ficha, y del otro lado hay un mail que sale y un cambio
 * que no se puede deshacer. La ventana dice de quién es el turno y qué día: es lo único
 * que deja darse cuenta de que era otro antes de que sea tarde.
 */
export function CancelAppointmentModal({ appointment, onClose, onConfirm }: Props) {
  if (!appointment) return null;

  // Todavía sin confirmar: el backend lo borra en vez de dejarlo cancelado.
  const pendiente = appointment.state === "pending";
  const paciente = appointment.patient
    ? `${appointment.patient.surname}, ${appointment.patient.name}`
    : "Sin paciente asignado";

  return (
    <Modal
      open
      onClose={onClose}
      title={pendiente ? "¿Eliminar el turno?" : "¿Cancelar el turno?"}
      subtitle={`${formatDayLabel(appointmentDate(appointment.date))} · ${shortHour(appointment.initialHour)} · ${paciente}`}
      size="sm"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="adm-btn adm-btn-danger" onClick={() => onConfirm(appointment)}>
            {pendiente ? "Sí, eliminarlo" : "Sí, cancelarlo"}
          </button>
        </>
      }
    >
      <p className="adm-confirm-lead">
        {pendiente
          ? "El turno todavía no está confirmado, así que se borra y el horario queda libre."
          : "El turno queda cancelado y en el historial, y el horario queda libre."}
      </p>
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
