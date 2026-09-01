import { useEffect, useState } from "react";
import type { Appointment, Person, RecurrenceFrequency, Room } from "../../types.ts";
import { FREQUENCY_LABELS } from "../recurrencesService.ts";
import { appointmentDate, describeState, formatDayLabel, isCancelled, shortHour } from "../appointmentTypes.ts";
import { getPatientMedicalHistory } from "../appointmentsService.ts";
import { SkeletonLine } from "../../../components/skeleton/Skeleton.tsx";
import { Modal } from "../../../components/modal/Modal.tsx";

interface AppointmentDetailModalProps {
  appointment: Appointment | undefined;
  user: Person;
  onClose: () => void;
  onAccept: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onSaveRecord: (appointment: Appointment, data: { state?: string; observations?: string }) => void;
  onAddPatient: (appointment: Appointment, patientEmail: string) => void;
  /** Modifica el turno en sí: fecha, horario, sala y valor. */
  onUpdate: (appointment: Appointment, data: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }) => void;
  /** Marca este turno como repetible (semanal o quincenal). */
  onRepeat: (appointment: Appointment, frequency: RecurrenceFrequency) => void;
  /** Frena la generación automática. No toca los turnos ya creados. */
  onStopRepeat: (appointment: Appointment) => void;
  patients: Person[];
  rooms: Room[];
}

export function AppointmentDetailModal({
  appointment,
  user,
  onClose,
  onAccept,
  onCancel,
  onSaveRecord,
  onAddPatient,
  onUpdate,
  onRepeat,
  onStopRepeat,
  patients,
  rooms,
}: AppointmentDetailModalProps) {
  const [observations, setObservations] = useState("");
  const [state, setState] = useState("");
  const [history, setHistory] = useState<Appointment[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [patientToAdd, setPatientToAdd] = useState("");
  const [editing, setEditing] = useState(false);
  // El valor va como texto: en un input numérico arrancado en 0, escribir 5000
  // obligaba a borrar el cero de adelante.
  const [edit, setEdit] = useState({ date: "", initialHour: "", finalHour: "", room: "", value: "" });
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");

  const isProfessional = user.type === "professional";

  useEffect(() => {
    if (!appointment) return;
    setObservations(appointment.observations ?? "");
    setState(appointment.state);
    setHistory(null);
    setShowHistory(false);
    setPatientToAdd("");
    setEditing(false);
    setFrequency(appointment.recurrence?.frequency ?? "weekly");
    setEdit({
      date: appointment.date?.slice(0, 10) ?? "",
      initialHour: appointment.initialHour?.slice(0, 5) ?? "",
      finalHour: appointment.finalHour?.slice(0, 5) ?? "",
      room: appointment.room ? String(appointment.room.idRoom) : "",
      value: appointment.value ? String(appointment.value) : "",
    });
  }, [appointment]);

  if (!appointment) return null;

  const cancelled = isCancelled(appointment.state);
  const badge = describeState(appointment.state);
  const date = appointmentDate(appointment.date);
  const isPast = date.getTime() < new Date().setHours(0, 0, 0, 0);

  function loadHistory() {
    if (!appointment?.patient) return;
    setShowHistory(true);

    if (history) return; // ya cargado

    setLoadingHistory(true);
    getPatientMedicalHistory(appointment.patient.email)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }

  const recordChanged = state !== appointment.state || (observations ?? "") !== (appointment.observations ?? "");

  function saveEdit() {
    if (!appointment) return;
    onUpdate(appointment, {
      date: edit.date,
      initialHour: edit.initialHour,
      finalHour: edit.finalHour,
      room: edit.room,
      value: Number(edit.value || 0),
    });
  }

  // Mientras se editan los datos del turno el resto se esconde: si no, entre la ficha,
  // el registro clínico y el historial la ventana se pasaba del alto de la pantalla.
  const footer = editing ? (
    <>
      <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(false)}>
        Descartar
      </button>
      <button type="button" className="adm-btn adm-btn-primary" onClick={saveEdit}>
        Guardar turno
      </button>
    </>
  ) : (
    <>
      {isProfessional && appointment.state === "pending" && (
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => onAccept(appointment)}>
          Aceptar turno
        </button>
      )}
      {!cancelled && appointment.state !== "assisted" && (
        <button type="button" className="adm-btn adm-btn-danger" onClick={() => onCancel(appointment)}>
          Cancelar turno
        </button>
      )}
      <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
        Cerrar
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Editar turno" : `Turno #${appointment.numAppointment}`}
      subtitle={`${formatDayLabel(date)} · ${shortHour(appointment.initialHour)} a ${shortHour(appointment.finalHour)}`}
      footer={footer}
    >
      {editing ? (
        <div className="ui-section">
          <label className="ui-field">
            <span>Fecha</span>
            <input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
          </label>

          <div className="ui-field-row">
            <label className="ui-field">
              <span>Hora de inicio</span>
              <input type="time" value={edit.initialHour} onChange={(e) => setEdit({ ...edit, initialHour: e.target.value })} />
            </label>
            <label className="ui-field">
              <span>Hora de fin</span>
              <input type="time" value={edit.finalHour} onChange={(e) => setEdit({ ...edit, finalHour: e.target.value })} />
            </label>
          </div>

          <label className="ui-field">
            <span>Sala</span>
            <select value={edit.room} onChange={(e) => setEdit({ ...edit, room: e.target.value })}>
              {rooms.map((room) => (
                <option key={room.idRoom} value={room.idRoom}>
                  {room.description}
                  {room.office?.description ? ` · ${room.office.description}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span>Valor</span>
            <input
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={edit.value}
              onChange={(e) => setEdit({ ...edit, value: e.target.value })}
            />
            <small>Lo que cobrás por esta consulta. Vacío queda en 0.</small>
          </label>
        </div>
      ) : (
        <>
          <div className="ui-section">
            <div className="ui-section-head">
              <h3 className="ui-section-title">Datos del turno</h3>
              {isProfessional && !cancelled && (
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(true)}>
                  Editar
                </button>
              )}
            </div>

            <div className="ui-detail-list">
              <div className="ui-detail-row">
                <span>Estado</span>
                <span className={badge.className}>{badge.label}</span>
              </div>
              {appointment.overbooked && (
                <div className="ui-detail-row">
                  <span>Tipo</span>
                  <span className="appt-tag-over">Sobreturno</span>
                </div>
              )}
              <div className="ui-detail-row">
                <span>{isProfessional ? "Paciente" : "Profesional"}</span>
                <strong>
                  {isProfessional ? (
                    appointment.patient ? (
                      `${appointment.patient.surname}, ${appointment.patient.name}`
                    ) : (
                      <span className="ui-detail-empty">Sin paciente asignado</span>
                    )
                  ) : (
                    `${appointment.professional.surname}, ${appointment.professional.name}`
                  )}
                </strong>
              </div>
              <div className="ui-detail-row">
                <span>Sala</span>
                <strong>
                  {appointment.room?.description}
                  {appointment.room?.office?.description ? ` · ${appointment.room.office.description}` : ""}
                </strong>
              </div>
              <div className="ui-detail-row">
                <span>Valor</span>
                <strong>{appointment.value ? `$${appointment.value}` : <span className="ui-detail-empty">Sin definir</span>}</strong>
              </div>
            </div>
          </div>

          {/* ---- asignar paciente a un turno que no tiene ---- */}
          {isProfessional && !appointment.patient && !cancelled && (
            <div className="ui-section">
              <h3 className="ui-section-title">Asignar paciente</h3>
              <div className="ui-field-row">
                <label className="ui-field">
                  <select value={patientToAdd} onChange={(e) => setPatientToAdd(e.target.value)}>
                    <option value="">Elegí un paciente…</option>
                    {patients.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.surname}, {p.name} {p.anonymous ? "(anónimo)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  disabled={!patientToAdd}
                  onClick={() => onAddPatient(appointment, patientToAdd)}
                >
                  Asignar
                </button>
              </div>
            </div>
          )}

          {/* ---- turno repetible ---- */}
          {isProfessional && !cancelled && (
            <div className="ui-section">
              <h3 className="ui-section-title">Turno repetible</h3>

              {appointment.recurrence ? (
                <>
                  <p className="ui-alert ui-alert-info">
                    Este turno se repite {appointment.recurrence.frequency === "weekly" ? "todas las semanas" : "cada dos semanas"}. El
                    sistema deja creados los de las próximas cuatro semanas y va agregando los que siguen.
                  </p>

                  <div className="ui-section-actions">
                    <button type="button" className="adm-btn adm-btn-danger" onClick={() => onStopRepeat(appointment)}>
                      Frenar la repetición
                    </button>
                  </div>
                  <p className="ui-hint">Frenarla no borra los turnos ya creados: esos se cancelan de a uno.</p>
                </>
              ) : (
                <>
                  <label className="ui-field">
                    <span>Repetir este turno</span>
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}>
                      {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((key) => (
                        <option key={key} value={key}>
                          {FREQUENCY_LABELS[key]}
                        </option>
                      ))}
                    </select>
                    <small>Mismo horario, misma sala y mismo paciente, hasta cuatro semanas para adelante.</small>
                  </label>

                  <div className="ui-section-actions">
                    <button type="button" className="adm-btn adm-btn-primary" onClick={() => onRepeat(appointment, frequency)}>
                      Repetir turno
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- parte clínica: solo el profesional ---- */}
          {isProfessional && !cancelled && (
            <div className="ui-section">
              <h3 className="ui-section-title">Registro de la consulta</h3>

              <label className="ui-field">
                <span>Estado del turno</span>
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="pending">Pendiente</option>
                  <option value="accepted">Confirmado</option>
                  <option value="assisted">Asistió</option>
                  <option value="missed">No vino</option>
                </select>
                {!isPast && state === "missed" && <small className="ui-hint">Ojo: este turno todavía no pasó.</small>}
              </label>

              <label className="ui-field">
                <span>Observaciones</span>
                <textarea
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Notas de la consulta…"
                />
              </label>

              <div className="ui-section-actions">
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  disabled={!recordChanged}
                  onClick={() => onSaveRecord(appointment, { state, observations })}
                >
                  Guardar registro
                </button>
              </div>
            </div>
          )}

          {/* ---- historial del paciente ---- */}
          {isProfessional && appointment.patient && (
            <div className="ui-section">
              <h3 className="ui-section-title">Historial del paciente</h3>

              {!showHistory ? (
                <div>
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={loadHistory}>
                    Ver historial
                  </button>
                </div>
              ) : loadingHistory ? (
                <div className="appt-history-loading">
                  <SkeletonLine height={16} />
                  <SkeletonLine width="80%" height={16} />
                  <SkeletonLine width="60%" height={16} />
                </div>
              ) : history && history.length > 0 ? (
                <ul className="appt-history">
                  {history.map((item) => (
                    <li key={item.numAppointment}>
                      <span className="appt-history-date">
                        {formatDayLabel(appointmentDate(item.date))} · {shortHour(item.initialHour)}
                      </span>
                      <span className={describeState(item.state).className}>{describeState(item.state).label}</span>
                      {item.observations && <p className="appt-history-obs">{item.observations}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ui-detail-empty">No hay consultas anteriores con este paciente.</p>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
