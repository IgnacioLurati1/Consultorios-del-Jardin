import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaChevronDown, FaChevronRight, FaEnvelope, FaPlaneDeparture, FaRepeat, FaTrashCan } from "react-icons/fa6";
import { Link } from "react-router-dom";
import { Modal } from "../../../components/modal/Modal";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { findMyPatients } from "../../patients/patientsService";
import type { Person } from "../../types";
import {
  findSettings,
  updateSettings,
  acceptPendingAppointments,
  addVacation,
  removeVacation,
  deletePatientAppointments,
  type AutoMark,
  type AutoMarkWhen,
  type DeleteScope,
  type MailSetting,
  type ProfessionalSettings as Settings,
} from "./settingsService";

/** "14/09" alcanza dentro de un renglón que ya dice de qué se trata. */
function shortDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
  /** Las opciones que solo tienen sentido con el switch prendido. */
  children?: React.ReactNode;
}) {
  return (
    <div className="prof-setting">
      <label className="prof-setting-main">
        <span className="prof-setting-text">
          <span className="prof-setting-label">{label}</span>
          <span className="prof-setting-desc">{description}</span>
        </span>
        <input
          type="checkbox"
          className="prof-switch"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>

      {/* Siempre montado: es lo que deja que se abra y se cierre con animacion, en vez
          de aparecer de golpe. `inert` lo saca del tab mientras esta cerrado. */}
      {children && (
        <div className={`adm-collapsible ${checked ? "open" : ""}`}>
          <div>
            <div className="prof-setting-extra" inert={!checked}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Un renglón que se abre, con la misma caja que los switches de al lado.
 *
 * Lo que hay adentro no es una opción sino una lista, y una lista siempre desplegada
 * arriba de las dos automatizaciones las empuja fuera de la pantalla. Cerrado ocupa un
 * renglón y dice en qué estado está, que es lo que se mira de reojo.
 */
function Dropdown({
  label,
  description,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="prof-setting">
      <button type="button" className="prof-setting-main prof-setting-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="prof-setting-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="prof-setting-text">
          <span className="prof-setting-label">{label}</span>
          <span className="prof-setting-desc">{description}</span>
        </span>
        <FaChevronDown className={`prof-setting-caret ${open ? "open" : ""}`} aria-hidden="true" />
      </button>

      <div className={`adm-collapsible ${open ? "open" : ""}`}>
        <div>
          <div className="prof-setting-extra" inert={!open}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Un aviso por mail, con su switch.
 *
 * El texto lo escribe el backend y no esta pantalla: el que sabe cuándo sale cada mail
 * es el que lo manda, y si mañana deja de mandarse tiene que desaparecer de acá sin que
 * nadie se acuerde de venir a borrarlo.
 */
function MailRow({
  mail,
  disabled,
  onChange,
}: {
  mail: MailSetting;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="prof-mail">
      <span className="prof-setting-text">
        <span className="prof-mail-label">{mail.label}</span>
        <span className="prof-setting-desc">{mail.description}</span>
      </span>
      <input
        type="checkbox"
        className="prof-switch"
        role="switch"
        checked={mail.enabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

/**
 * Lo que el consultorio hace solo, y las dos operaciones que no se pueden deshacer.
 *
 * Va al final del panel a propósito: son decisiones que se toman una vez y después se
 * olvidan, no cosas que se miren todos los días.
 */
export function ProfessionalSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [mailsOpen, setMailsOpen] = useState(false);
  const [vacationsOpen, setVacationsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function load() {
    findSettings()
      .then(setSettings)
      .catch((err) => toast.error(`No pudimos cargar tu configuración: ${err.message}`));
  }

  useEffect(load, []);

  function save(data: {
    autoAccept?: boolean;
    autoMark?: AutoMark | null;
    autoMarkWhen?: AutoMarkWhen;
    mails?: Record<string, boolean>;
  }) {
    setSaving(true);
    updateSettings(data)
      .then(setSettings)
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  /**
   * Prender la confirmación automática y vaciar la bandeja son dos decisiones: la
   * primera vale para lo que entre después, y esta se lleva puesto lo que ya está.
   */
  function acceptBacklog() {
    setSaving(true);
    acceptPendingAppointments()
      .then((accepted) => {
        toast.success(accepted === 0 ? "No tenías pedidos esperando" : `Confirmaste ${accepted} pedidos`);
        load();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  const onVacation = settings?.vacations.find((vacation) => vacation.current);

  // Cerrado, el renglón tiene que decir si hay algo apagado: es el único momento en que
  // alguien se entera de que dejó de recibir un aviso hace tres meses.
  const mutedMails = settings?.mails.filter((mail) => !mail.enabled).length ?? 0;
  const mailsState =
    mutedMails === 0
      ? "Ahora te llegan todos."
      : mutedMails === 1
        ? "Apagaste uno."
        : `Apagaste ${mutedMails}.`;

  return (
    <section className="prof-today">
      <div className="prof-today-head">
        <div>
          <h2 className="prof-today-title">Configuración</h2>
          <p className="prof-today-date">Lo que la app hace sola, para que no lo hagas vos</p>
        </div>
      </div>

      <div className="adm-panel">
        {settings === null ? (
          <div className="prof-today-loading">
            <SkeletonLine height={18} />
            <SkeletonLine width="70%" height={18} />
          </div>
        ) : (
          <>
            <Link className="prof-setting-link" to="/Recurrences">
              <span className="prof-setting-icon" aria-hidden="true">
                <FaRepeat />
              </span>
              <span className="prof-setting-text">
                <span className="prof-setting-label">Turnos repetibles</span>
                <span className="prof-setting-desc">
                  Los que se agendan solos todas las semanas, con quién son y hasta cuándo van.
                </span>
              </span>
              <FaChevronRight className="prof-setting-chevron" aria-hidden="true" />
            </Link>

            <Switch
              checked={settings.autoAccept}
              disabled={saving}
              onChange={(value) => save({ autoAccept: value })}
              label="Confirmar turnos automáticamente"
              description="Cuando un paciente pide un horario tuyo, queda confirmado sin que tengas que aprobarlo."
            >
              {settings.pending > 0 && (
                <div className="prof-setting-inline">
                  <span>
                    Tenés {settings.pending} {settings.pending === 1 ? "pedido esperando" : "pedidos esperando"} de antes.
                  </span>
                  <button type="button" className="adm-btn adm-btn-ghost" disabled={saving} onClick={acceptBacklog}>
                    Confirmarlos también
                  </button>
                </div>
              )}
            </Switch>

            <Switch
              checked={settings.autoMark !== null}
              disabled={saving}
              onChange={(value) => save({ autoMark: value ? "assisted" : null })}
              label="Cerrar los turnos que ya pasaron automáticamente"
              description="Al turno que quedó sin marcar se le pone asistencia solo. Podés corregir el que no dé."
            >
              <div className="ui-field">
                <span>¿Cómo los cierro?</span>
                <div className="ui-choice-row">
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark"
                      checked={settings.autoMark === "assisted"}
                      onChange={() => save({ autoMark: "assisted" })}
                    />
                    <span>Como que vino</span>
                  </label>
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark"
                      checked={settings.autoMark === "missed"}
                      onChange={() => save({ autoMark: "missed" })}
                    />
                    <span>Como que no vino</span>
                  </label>
                </div>
              </div>

              <div className="ui-field">
                <span>¿Cuándo?</span>
                <div className="ui-choice-row">
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark-when"
                      checked={settings.autoMarkWhen === "appointment"}
                      onChange={() => save({ autoMarkWhen: "appointment" })}
                    />
                    <span>Al terminar cada turno</span>
                  </label>
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark-when"
                      checked={settings.autoMarkWhen === "day"}
                      onChange={() => save({ autoMarkWhen: "day" })}
                    />
                    <span>Al terminar el día</span>
                  </label>
                </div>
                <small>
                  Al terminar el día te da tiempo a cargar a mano el que se estiró o el que llegó tarde.
                </small>
              </div>

              <p className="ui-alert ui-alert-info">
                Vale para los turnos que terminen de ahora en adelante. Lo que quedó abierto de antes no se toca.
              </p>
            </Switch>

            <Dropdown
              label="Avisos por mail"
              description={`Cuáles te llegan a la casilla. ${mailsState}`}
              icon={<FaEnvelope />}
              open={mailsOpen}
              onToggle={() => setMailsOpen(!mailsOpen)}
            >
              {settings.mails.map((mail) => (
                <MailRow
                  key={mail.key}
                  mail={mail}
                  disabled={saving}
                  onChange={(enabled) => save({ mails: { [mail.key]: enabled } })}
                />
              ))}
            </Dropdown>

            <div className="prof-setting-actions">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setVacationsOpen(true)}>
                <FaPlaneDeparture />
                {onVacation ? `De vacaciones hasta el ${shortDate(onVacation.toDate)}` : "Tomarme vacaciones"}
              </button>
              <button type="button" className="adm-btn adm-btn-danger" onClick={() => setDeleteOpen(true)}>
                <FaTrashCan />
                Borrar los turnos de un paciente
              </button>
            </div>
          </>
        )}
      </div>

      <VacationsModal
        open={vacationsOpen}
        onClose={() => setVacationsOpen(false)}
        settings={settings}
        onChanged={load}
      />
      <DeletePatientModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </section>
  );
}

/**
 * Los períodos en los que no atiende.
 *
 * El de hoy se corta con "Ya volví" y no con "Borrar": es la misma operación, pero
 * nadie piensa en volver antes como en borrar un registro.
 */
function VacationsModal({
  open,
  onClose,
  settings,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings | null;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [saving, setSaving] = useState(false);

  function add() {
    setSaving(true);
    addVacation(form.fromDate, form.toDate, form.reason)
      .then(() => {
        toast.success("Listo, esos días no vas a aparecer en las búsquedas");
        setForm({ fromDate: "", toDate: "", reason: "" });
        onChanged();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  function remove(id: number, current: boolean) {
    setSaving(true);
    removeVacation(id)
      .then(() => {
        toast.success(current ? "Bienvenido de vuelta: ya aparecés en las búsquedas" : "Período borrado");
        onChanged();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vacaciones"
      subtitle="Los días que no atendés"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            disabled={saving || !form.fromDate || !form.toDate}
            onClick={add}
          >
            Cargar
          </button>
        </>
      }
    >
      {settings && settings.vacations.length > 0 && (
        <div className="ui-section">
          <h3 className="ui-section-title">Cargadas</h3>
          <ul className="prof-vacation-list">
            {settings.vacations.map((vacation) => (
              <li className="prof-vacation-item" key={vacation.id}>
                <div className="prof-vacation-text">
                  <span className="prof-vacation-when">
                    {shortDate(vacation.fromDate)} al {shortDate(vacation.toDate)}
                  </span>
                  {vacation.reason && <span className="prof-vacation-reason">{vacation.reason}</span>}
                </div>
                {vacation.current && <span className="adm-badge adm-badge-amber">En curso</span>}
                <button
                  type="button"
                  className={vacation.current ? "adm-btn adm-btn-primary" : "adm-btn adm-btn-ghost"}
                  disabled={saving}
                  onClick={() => remove(vacation.id, vacation.current)}
                >
                  {vacation.current ? "Ya volví" : "Borrar"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ui-section">
        <h3 className="ui-section-title">Cargar un período</h3>
        <div className="ui-field-row">
          <label className="ui-field">
            <span>Desde</span>
            <input
              type="date"
              min={today()}
              value={form.fromDate}
              onChange={(event) => setForm({ ...form, fromDate: event.target.value })}
            />
          </label>
          <label className="ui-field">
            <span>Hasta</span>
            <input
              type="date"
              min={form.fromDate || today()}
              value={form.toDate}
              onChange={(event) => setForm({ ...form, toDate: event.target.value })}
            />
          </label>
        </div>

        <label className="ui-field">
          <span>Motivo (opcional)</span>
          <input
            type="text"
            maxLength={80}
            placeholder="Congreso, licencia, vacaciones…"
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
          />
          <small>Es para vos: el paciente no lo ve.</small>
        </label>

        <p className="ui-alert ui-alert-info">
          Esos días no aparecés en la búsqueda ni se ofrece ningún horario tuyo. Los turnos que ya tenías dados quedan
          como están.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Borrar los turnos de un paciente.
 *
 * Dos pasos a propósito: primero se elige a quién y qué, y recién después aparece el
 * botón que borra. Es definitivo y no hay pantalla desde donde recuperarlo.
 */
function DeletePatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [patients, setPatients] = useState<Person[]>([]);
  const [email, setEmail] = useState("");
  const [scope, setScope] = useState<DeleteScope>("future");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    findMyPatients()
      .then(setPatients)
      .catch(() => setPatients([]));
  }, [open]);

  function close() {
    setEmail("");
    setScope("future");
    setConfirming(false);
    onClose();
  }

  function run() {
    setSaving(true);
    deletePatientAppointments(email, scope)
      .then((result) => {
        toast.success(
          result.deleted === 0
            ? "Ese paciente no tenía turnos para borrar"
            : `Se borraron ${result.deleted} turnos${result.stoppedRecurrences > 0 ? " y se frenaron sus repeticiones" : ""}`
        );
        close();
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  const chosen = patients.find((patient) => patient.email === email);
  const name = chosen ? `${chosen.surname}, ${chosen.name}` : "";

  return (
    <Modal
      open={open}
      onClose={close}
      title="Borrar los turnos de un paciente"
      subtitle={confirming ? name : "Elegí de quién y qué se borra"}
      footer={
        confirming ? (
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirming(false)}>
              Volver
            </button>
            <button type="button" className="adm-btn adm-btn-danger" disabled={saving} onClick={run}>
              Sí, borrarlos para siempre
            </button>
          </>
        ) : (
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={close}>
              Cancelar
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-danger"
              disabled={!email}
              onClick={() => setConfirming(true)}
            >
              Continuar
            </button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="ui-section">
          <p className="ui-alert ui-alert-error">
            Vas a borrar {scope === "all" ? "todos los turnos" : "los turnos de hoy en adelante"} de {name}. Se
            eliminan permanentemente, junto con las observaciones que hayas cargado, y no hay forma de recuperarlos.
          </p>
          <p className="ui-hint">
            Si tenía un turno repetible con vos, se frena para que no vuelva a generar los que estás borrando.
          </p>
        </div>
      ) : (
        <div className="ui-section">
          <label className="ui-field">
            <span>Paciente</span>
            <select value={email} onChange={(event) => setEmail(event.target.value)}>
              <option value="">Elegí un paciente</option>
              {patients.map((patient) => (
                <option key={patient.email} value={patient.email}>
                  {patient.surname}, {patient.name}
                </option>
              ))}
            </select>
            <small>Solo tus pacientes. Se borran los turnos con vos, no los que tenga con otro profesional.</small>
          </label>

          <div className="ui-field">
            <span>¿Qué borro?</span>
            <div className="ui-choice-row">
              <label className="ui-choice">
                <input type="radio" name="delete-scope" checked={scope === "future"} onChange={() => setScope("future")} />
                <span>De hoy en adelante</span>
              </label>
              <label className="ui-choice">
                <input type="radio" name="delete-scope" checked={scope === "all"} onChange={() => setScope("all")} />
                <span>Todos, historial incluido</span>
              </label>
            </div>
            <small>
              {scope === "future"
                ? "Lo que ya atendiste queda registrado, con sus observaciones."
                : "Se lleva también lo ya atendido: no vas a poder consultar qué pasó en esas sesiones."}
            </small>
          </div>
        </div>
      )}
    </Modal>
  );
}
