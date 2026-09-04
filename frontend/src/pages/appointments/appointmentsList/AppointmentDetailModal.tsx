import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa6";
import type { Appointment, PaymentState, Person, RecurrenceFrequency, Room } from "../../types.ts";
import { RepeatFields } from "./RepeatFields.tsx";
import {
  PAYMENT_OPTIONS,
  appointmentDate,
  describePayment,
  describeState,
  formatDayLabel,
  isCancelled,
  shortHour,
} from "../appointmentTypes.ts";
import { getPatientMedicalHistory } from "../appointmentsService.ts";
import { SkeletonLine } from "../../../components/skeleton/Skeleton.tsx";
import { Modal } from "../../../components/modal/Modal.tsx";

/**
 * Una sección de la ficha que se abre y se cierra.
 *
 * La ficha juntó con los años todo lo que se puede hacer con un turno, y abierta de par en
 * par lo que se ve es una pared de campos donde nada resalta. Lo que se mira siempre —qué
 * turno es, cómo cerró la consulta— queda a la vista; lo que se usa de vez en cuando vive
 * acá adentro, cerrado, con el renglón diciendo en qué estado está.
 */
function Fold({
  title,
  summary,
  children,
}: {
  title: string;
  /** Lo que se lee sin abrir: un cartelito, una línea. Es lo que hace útil el título. */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ui-section">
      <button type="button" className="appt-fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ui-section-title">{title}</span>
        {summary}
        <FaChevronDown className={`appt-fold-caret ${open ? "open" : ""}`} aria-hidden="true" />
      </button>

      <div className={`adm-collapsible ${open ? "open" : ""}`}>
        <div>
          <div className="appt-fold-body" inert={!open}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Cuánto entra en una observación.
 *
 * Es el mismo tope que la app, que ya cortaba en 600 y mostraba el contador. Sin esto el
 * campo del navegador aceptaba lo que fuera, así que el mismo dato tenía dos límites
 * distintos según por dónde se cargara.
 *
 * Seiscientos alcanzan para un plan o unas indicaciones. Lo que no entra es una historia
 * clínica entera, que además el paciente lee de un renglón en su ficha del turno.
 */
const OBSERVATIONS_MAX = 600;

interface AppointmentDetailModalProps {
  appointment: Appointment | undefined;
  user: Person;
  onClose: () => void;
  onAccept: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onSaveRecord: (appointment: Appointment, data: { state?: string; observations?: string }) => void;
  onAddPatient: (appointment: Appointment, patientEmail: string) => void;
  /** Modifica el turno en sí: fecha, horario, consultorio y valor. */
  onUpdate: (appointment: Appointment, data: { date?: string; initialHour?: string; finalHour?: string; room?: string; value?: number }) => void;
  /** Marca este turno como repetible (semanal o quincenal), con o sin fecha de corte. */
  onRepeat: (appointment: Appointment, frequency: RecurrenceFrequency, endDate: string | null) => void;
  /** Frena la generación automática. No toca los turnos ya creados. */
  onStopRepeat: (appointment: Appointment) => void;
  /** Registra el cobro. El monto va solo cuando el pago fue parcial. */
  onSavePayment: (appointment: Appointment, paymentState: PaymentState, paidAmount: number | null) => void;
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
  onSavePayment,
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
  // Sin fecha de corte es lo más común (un paciente de tratamiento largo), así que es
  // lo que viene puesto: poner una fecha es la decisión, no lo contrario.
  const [repeatForever, setRepeatForever] = useState(true);
  const [repeatUntil, setRepeatUntil] = useState("");
  // El cobro. El monto va como texto por lo mismo que el valor: en un input numérico
  // arrancado en cero, escribir 3000 obliga a borrar el cero de adelante.
  const [payment, setPayment] = useState<PaymentState>("unpaid");
  const [paidAmount, setPaidAmount] = useState("");

  const isProfessional = user.type === "professional";

  useEffect(() => {
    if (!appointment) return;
    setObservations(appointment.observations ?? "");
    setState(appointment.state);
    setHistory(null);
    setShowHistory(false);
    setPatientToAdd("");
    setEditing(false);
    // Los turnos viejos no tienen registro de cobro. Arrancan en "no pagó", que es lo que
    // hay que elegir para que empiecen a contar, y no cuentan como deuda hasta guardarlo.
    setPayment(appointment.paymentState ?? "unpaid");
    setPaidAmount(appointment.paidAmount ? String(appointment.paidAmount) : "");
    setFrequency(appointment.recurrence?.frequency ?? "weekly");
    setRepeatForever(!appointment.recurrence?.endDate);
    setRepeatUntil(appointment.recurrence?.endDate?.slice(0, 10) ?? "");
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
  // Todavía sin confirmar: el backend lo borra, no lo marca como cancelado.
  const pendingYet = appointment.state === "pending";
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

  // ---- cobro ----
  const value = appointment.value ?? 0;
  const amount = Number(paidAmount);
  const savedPayment = appointment.paymentState ?? null;
  const paymentBadge = describePayment(appointment);

  /**
   * Qué le falta al pago para poder guardarse, en una línea. Null si está bien.
   *
   * Es la misma validación que hace el backend, dicha antes: que el monto sea un número,
   * que sea mayor que cero y que no pase el valor del turno. Igualarlo tampoco vale, y no
   * por capricho: un pago parcial que cubre todo es un turno que figura debiendo cero, y
   * eso hay que explicarlo después en cada pantalla donde aparece.
   */
  function paymentProblem(): string | null {
    if (payment !== "partial") return null;
    if (value <= 0) return "Para registrar un pago parcial el turno tiene que tener un valor cargado.";
    if (!paidAmount.trim() || !Number.isFinite(amount) || amount <= 0) return "Escribí cuánto pagó.";
    if (amount > value) return `El turno vale $${value}: no puede haber pagado más que eso.`;
    if (amount === value) return `Pagó los $${value} completos: marcalo como "Pagó".`;
    return null;
  }

  const paymentIssue = paymentProblem();
  const paymentChanged =
    payment !== (savedPayment ?? "unpaid") ||
    savedPayment === null ||
    (payment === "partial" && amount !== (appointment.paidAmount ?? 0));

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
        <button
          type="button"
          className="adm-btn adm-btn-danger"
          onClick={() => onCancel(appointment)}
          title={
            pendingYet
              ? "El turno todavía no está confirmado: se borra y el horario queda libre."
              : "El turno queda cancelado y en el historial."
          }
        >
          {/* Un turno pendiente no se cancela: se borra. Decirle "cancelar" a las dos
              cosas hacía pensar que quedaba registro de este también. */}
          {pendingYet ? "Eliminar turno" : "Cancelar turno"}
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
            <span>Consultorio</span>
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

          <p className="ui-alert ui-alert-info">Este dato es privado entre el paciente y vos.</p>
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
                <span>Consultorio</span>
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

          {/* ---- el seguimiento, del lado del paciente ---- */}
          {/* Lo que escribe el profesional no es una nota interna: es lo que le queda a
              la persona de la consulta, y muchas veces es lo único que se lleva —un plan
              de alimentación, ejercicios para practicar, qué mirar hasta la próxima—.
              Guardarlo donde no lo puede leer lo vuelve inútil justo para quien lo
              necesita. */}
          {!isProfessional && appointment.observations && (
            <div className="ui-section">
              <h3 className="ui-section-title">Seguimiento</h3>
              <p className="appt-followup">{appointment.observations}</p>
              <p className="ui-hint appt-followup-who">
                Lo escribió {appointment.professional.surname}, {appointment.professional.name} después de la consulta.
              </p>
            </div>
          )}

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
                  rows={3}
                  maxLength={OBSERVATIONS_MAX}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value.slice(0, OBSERVATIONS_MAX))}
                  placeholder="Qué trabajaron y qué sigue hasta la próxima…"
                />
                {/* El contador aparece recién sobre el final: mientras sobra lugar es un
                    número que no le sirve a nadie, y avisar cuando ya no entra más es
                    tarde. */}
                {observations.length >= OBSERVATIONS_MAX - 100 && (
                  <small className={observations.length >= OBSERVATIONS_MAX ? "ui-hint appt-count-full" : "ui-hint"}>
                    {observations.length} de {OBSERVATIONS_MAX} caracteres
                  </small>
                )}
              </label>

              {/* Antes esto no se le mostraba a nadie más y era fácil escribirlo como una
                  nota para uno mismo. Ahora lo lee el paciente, y eso cambia cómo se
                  escribe: decirlo acá, al lado del campo, es la única forma de que se
                  entere antes de guardar y no después. */}
              <p className="ui-alert ui-alert-info">
                Esto lo ven el paciente y vos. Sirve para dejarle el seguimiento —un plan, indicaciones, qué mirar hasta la
                próxima consulta—.
              </p>

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

          {/* ---- cobro ---- */}
          {/* Aparte del registro clínico a propósito: son dos decisiones que se toman en
              momentos distintos —una al terminar la consulta, la otra cuando la persona
              paga— y guardar una no tiene por qué tocar la otra. */}
          {isProfessional && !cancelled && (
            <Fold
              title="Cobro"
              summary={
                paymentBadge ? (
                  <span className={paymentBadge.className}>{paymentBadge.label}</span>
                ) : (
                  <span className="appt-fold-hint">Sin registrar</span>
                )
              }
            >
              <div className="ui-field">
                <span>¿Pagó este turno?</span>
                <div className="ui-choice-row">
                  {PAYMENT_OPTIONS.map((option) => (
                    <label className="ui-choice" key={option.value}>
                      <input
                        type="radio"
                        name="payment-state"
                        checked={payment === option.value}
                        onChange={() => setPayment(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {payment === "partial" && (
                <label className="ui-field">
                  <span>¿Cuánto pagó?</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(0, value - 1)}
                    step={100}
                    placeholder="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                  <small>
                    {value > 0 ? `El turno vale $${value}.` : "Este turno no tiene valor cargado."}
                    {!paymentIssue && amount > 0 && value > 0 ? ` Quedan debiendo $${value - amount}.` : ""}
                  </small>
                </label>
              )}

              {paymentIssue && <p className="ui-alert ui-alert-error">{paymentIssue}</p>}

              {!savedPayment && (
                <p className="ui-hint">
                  Este turno es anterior al registro de cobros, así que no figura como impago en ningún lado hasta que
                  elijas algo acá.
                </p>
              )}

              <div className="ui-section-actions">
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  disabled={!paymentChanged || !!paymentIssue}
                  onClick={() => onSavePayment(appointment, payment, payment === "partial" ? amount : null)}
                >
                  Guardar cobro
                </button>
              </div>
            </Fold>
          )}

          {/* ---- turno repetible ---- */}
          {isProfessional && !cancelled && (
            <Fold
              title="Turno repetible"
              summary={
                appointment.recurrence?.active ? (
                  <span className="adm-badge adm-badge-green">
                    {appointment.recurrence.frequency === "weekly" ? "Todas las semanas" : "Cada dos semanas"}
                  </span>
                ) : (
                  <span className="appt-fold-hint">No se repite</span>
                )
              }
            >

              {/* Vale `active` y no que la repetición exista: al frenarla, el turno le sigue
                  apuntando (es el registro de lo que pasó) y con solo mirar el objeto la
                  ficha seguía diciendo que se repetía. */}
              {appointment.recurrence?.active ? (
                <>
                  <p className="ui-alert ui-alert-info">
                    Este turno se repite {appointment.recurrence.frequency === "weekly" ? "todas las semanas" : "cada dos semanas"}
                    {appointment.recurrence.endDate ? ` hasta el ${new Date(`${appointment.recurrence.endDate.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR")}` : ", sin fecha de corte"}. El
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
                  <RepeatFields
                    frequency={frequency}
                    onFrequency={setFrequency}
                    forever={repeatForever}
                    onForever={setRepeatForever}
                    until={repeatUntil}
                    onUntil={setRepeatUntil}
                    minDate={appointment.date?.slice(0, 10)}
                  />

                  <div className="ui-section-actions">
                    <button
                      type="button"
                      className="adm-btn adm-btn-primary"
                      disabled={!repeatForever && !repeatUntil}
                      onClick={() => onRepeat(appointment, frequency, repeatForever ? null : repeatUntil)}
                    >
                      Repetir turno
                    </button>
                  </div>
                </>
              )}
            </Fold>
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
