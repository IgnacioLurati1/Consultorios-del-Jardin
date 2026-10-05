import { useEffect, useState } from "react";
import { Modal } from "../../components/modal/Modal.tsx";
import { useWords } from "../../lib/installation.ts";
import { appointmentDate, formatDayLabel, shortHour } from "../appointments/appointmentTypes.ts";
import type { AdminAppointment } from "./controlService.ts";

/** Para la frase que arranca con un ayudante del vocabulario, que viene en minúscula. */
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Props {
  /** El turno que se está por dar de baja. Sin turno, no hay ventana. */
  appointment?: AdminAppointment;
  onClose: () => void;
  /** Avisa ella misma cómo salió; la ventana solo espera para no dejar apretar dos veces. */
  onConfirm: (appointment: AdminAppointment) => Promise<void>;
}

/**
 * Preguntar antes de bajar un turno desde la recepción.
 *
 * Dice lo mismo que la pregunta del lado del profesional (`CancelAppointmentModal`), que
 * es lo que hace el servidor: la baja de la administración se hace en nombre del
 * profesional del turno. No es esa misma ventana porque aquella habla del Ctrl+Z, que en
 * esta pantalla no existe, y pregunta por la lista de espera, que desde acá no se puede
 * contar.
 */
export function CancelAppointmentConfirm({ appointment, onClose, onConfirm }: Props) {
  const w = useWords();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setWorking(false);
  }, [appointment]);

  if (!appointment) return null;

  // Todavía sin confirmar: el servidor lo borra en vez de dejarlo cancelado.
  const pendiente = appointment.state === "pending";
  const paciente = appointment.patient
    ? `${appointment.patient.surname}, ${appointment.patient.name}`
    : `Sin ${w.paciente} asignad${w.o("paciente")}`;

  async function confirm() {
    if (!appointment) return;
    setWorking(true);
    try {
      await onConfirm(appointment);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={pendiente ? `¿Eliminar ${w.el("turno")}?` : `¿Cancelar ${w.el("turno")}?`}
      subtitle={`${formatDayLabel(appointmentDate(String(appointment.date)))} · ${shortHour(appointment.initialHour)} · ${paciente}`}
      size="sm"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="adm-btn adm-btn-danger" onClick={confirm} disabled={working}>
            {working
              ? pendiente
                ? "Eliminando…"
                : "Cancelando…"
              : pendiente
              ? `Sí, eliminar${w.lo("turno")}`
              : `Sí, cancelar${w.lo("turno")}`}
          </button>
        </>
      }
    >
      <p className="adm-confirm-lead">
        {pendiente
          ? `${w.El("turno")} todavía no está confirmad${w.o("turno")}, así que se borra y el horario queda libre.`
          : `${w.El("turno")} queda cancelad${w.o("turno")} y en el historial, y el horario queda libre.`}
      </p>

      <p className="adm-confirm-note">
        {appointment.patient ? `${capital(w.al("paciente"))} le llega un mail avisándole. ` : ""}
        {/* El servidor la cuenta igual que si la bajara el profesional del turno. */}
        {pendiente ? "Cuenta como un pedido rechazado del mes. " : ""}
        Esto no se puede deshacer.
      </p>
    </Modal>
  );
}
