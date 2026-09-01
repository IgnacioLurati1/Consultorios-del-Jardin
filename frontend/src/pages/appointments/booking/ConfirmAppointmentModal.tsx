import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { appointmentDate, formatDayLabel, shortHour, toISODate } from "../appointmentTypes.ts";
import type { confirmAppointmentModalProps } from "../appointmentTypes.ts";

export function diffInMinutes(time1: string, time2: string): number {
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);

  return h1 * 60 + m1 - (h2 * 60 + m2);
}

/** Confirmación del turno antes de pedirlo. */
export function ConfirmAppointmentModal({ isOpen, onClose, appointment, professional, office, onCreate }: confirmAppointmentModalProps) {
  const [sending, setSending] = useState(false);

  if (!isOpen || !appointment) return null;

  const date = appointmentDate(appointment.date as unknown as string);
  const duration = diffInMinutes(appointment.finalHour, appointment.initialHour);

  async function handleSubmit() {
    if (!appointment) return;

    setSending(true);
    try {
      await onCreate({
        date: toISODate(date),
        initialHour: appointment.initialHour,
        professionalEmail: professional.email,
        officeId: office.idOffice,
      });
      toast.success("Turno pedido. Te avisamos cuando el profesional lo confirme");
      onClose();
    } catch {
      // El mensaje ya lo muestra quien llama; acá solo se reactiva el botón.
      setSending(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title="Confirmar el turno"
      subtitle={formatDayLabel(date)}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={handleSubmit} disabled={sending}>
            {sending ? "Pidiendo…" : "Pedir turno"}
          </button>
        </>
      }
    >
      <div className="ui-section">
        <div className="ui-detail-list">
          <div className="ui-detail-row">
            <span>Horario</span>
            <strong>
              {shortHour(appointment.initialHour)} a {shortHour(appointment.finalHour)}
            </strong>
          </div>
          <div className="ui-detail-row">
            <span>Duración</span>
            <strong>{duration} minutos</strong>
          </div>
          <div className="ui-detail-row">
            <span>Profesional</span>
            <strong>
              {professional.surname}, {professional.name}
            </strong>
          </div>
          {professional.speciality && (
            <div className="ui-detail-row">
              <span>Especialidad</span>
              <strong>{professional.speciality}</strong>
            </div>
          )}
          <div className="ui-detail-row">
            <span>Lugar</span>
            <strong>
              {office.description}
              {office.city?.nameCity ? `, ${office.city.nameCity}` : ""}
            </strong>
          </div>
        </div>

        <p className="ui-alert ui-alert-info">
          El turno queda pendiente hasta que el profesional lo acepte. Vas a ver el estado en “Mis turnos”.
        </p>
      </div>
    </Modal>
  );
}
