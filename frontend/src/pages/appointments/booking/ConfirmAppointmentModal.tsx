import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "../../../components/modal/Modal.tsx";
import { appointmentDate, formatDayLabel, shortHour, toISODate } from "../appointmentTypes.ts";
import type { confirmAppointmentModalProps } from "../appointmentTypes.ts";
import { hasBranches, useInstallation, useWords } from "../../../lib/installation.ts";
import { branchFromOffice, branchPlace } from "../../adminCRUDS/adminOffices/branches.ts";

export function diffInMinutes(time1: string, time2: string): number {
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);

  return h1 * 60 + m1 - (h2 * 60 + m2);
}

/** Confirmación del turno antes de pedirlo. */
export function ConfirmAppointmentModal({
  isOpen,
  onClose,
  appointment,
  professional,
  office,
  onCreate,
  blockedReason,
}: confirmAppointmentModalProps) {
  const w = useWords();
  const installation = useInstallation();
  const multi = hasBranches(installation);
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
      toast.success(`${w.Turno} solicitad${w.o("turno")}. Queda pendiente de confirmación ${w.del("profesional")}`);
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
      title={`Confirmar ${w.turno}`}
      subtitle={formatDayLabel(date)}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Volver
          </button>
          {/* Quien no puede pedirlo no se lleva un botón apagado. Un botón que no se puede
              apretar deja preguntándose qué falta para poder; abajo está dicho. */}
          {!blockedReason && (
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSubmit} disabled={sending}>
              {sending ? "Solicitando…" : `Solicitar ${w.turno}`}
            </button>
          )}
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
            <span>{w.Profesional}</span>
            <strong>
              {professional.surname}, {professional.name}
            </strong>
          </div>
          {professional.speciality && (
            <div className="ui-detail-row">
              <span>{w.Especialidad}</span>
              <strong>{professional.speciality}</strong>
            </div>
          )}
          {/* Con varias sucursales, también la calle: es la pregunta que sigue a "en cuál". */}
          {multi ? (
            <div className="ui-detail-row">
              <span>{w.Sucursal}</span>
              <strong>{[office.description, branchPlace(branchFromOffice(office), installation)].filter(Boolean).join(" · ")}</strong>
            </div>
          ) : (
            <div className="ui-detail-row">
              <span>Lugar</span>
              <strong>
                {office.description}
                {office.city?.nameCity ? `, ${office.city.nameCity}` : ""}
              </strong>
            </div>
          )}
        </div>

        {/* El horario se muestra igual, y eso es a propósito: mirar la agenda de un
            profesional es lo que el administrador vino a hacer. Lo que no puede es
            quedarse con el turno. */}
        {blockedReason ? (
          <p className="ui-alert ui-alert-warn">{blockedReason}</p>
        ) : (
          <p className="ui-alert ui-alert-info">
            {`Pendiente hasta la confirmación ${w.del("profesional")}. El estado figura en “Mis ${w.turnos}”.`}
          </p>
        )}
      </div>
    </Modal>
  );
}
