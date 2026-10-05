import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  FaAlignLeft,
  FaChevronDown,
  FaCompress,
  FaChevronRight,
  FaCircleCheck,
  FaClipboardCheck,
  FaEnvelope,
  FaMoneyBillWave,
  FaPlaneDeparture,
  FaRepeat,
  FaTrashCan,
} from "react-icons/fa6";
import { Link } from "react-router-dom";
import { Modal } from "../../../components/modal/Modal";
import { SkeletonLine } from "../../../components/skeleton/Skeleton";
import { findMyPatients } from "../../patients/patientsService";
import type { Person } from "../../types";
import {
  findSettings,
  updateSettings,
  addVacation,
  removeVacation,
  deletePatientAppointments,
  type AutoMark,
  type AutoMarkWhen,
  type AutoPayWhen,
  type DeleteScope,
  type MailSetting,
  type ProfessionalSettings as Settings,
} from "./settingsService";
import { useSimpleText } from "../../../lib/textMode";
import { useSimpleView } from "../../../lib/simpleView";
import { usePolicies, useWords } from "../../../lib/installation";
import { VacationsModal } from "../../../components/vacations/VacationsModal";
import { shortDate } from "../../../components/vacations/vacationDates";

/**
 * Una automatización: el switch que la prende y, abajo, cómo se configura.
 *
 * Son dos controles y no uno. Tocar el renglón despliega el detalle; tocar el switch
 * prende o apaga. Antes el renglón entero era el switch y el detalle se veía solo
 * mientras estaba prendido: cerrarlo obligaba a apagar la opción, que es lo último que
 * quiere el que solo venía a dejar de mirarlo.
 */
function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
  simple,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  /** El mismo círculo verde que llevan los renglones de arriba y abajo. */
  icon: React.ReactNode;
  /** Con "menos texto" prendido, la descripción no se dibuja: el título ya la dice. */
  simple?: boolean;
  disabled?: boolean;
  /** Cómo se configura. Solo se puede tocar con el switch prendido. */
  children?: React.ReactNode;
}) {
  // Siempre arranca cerrado, esté prendida o no. Es el punto de todo esto: la pantalla
  // se abre corta y cada detalle se mira cuando se lo va a mirar.
  const [open, setOpen] = useState(false);

  const expandable = Boolean(children);
  // Desplegado pero apagado: se ve qué se va a configurar y no se toca. Cambiar un
  // radio ahí adentro prendería la automatización sin que nadie tocara el switch.
  const locked = !checked;

  function flip(value: boolean) {
    // Prenderla es el momento en que alguien viene a configurarla, así que se abre
    // sola. Apagarla no cierra nada: cerrar es decisión del que aprieta el renglón.
    if (value) setOpen(true);
    onChange(value);
  }

  return (
    <div className="prof-setting">
      <div className="prof-setting-row">
        {expandable ? (
          <button
            type="button"
            className="prof-setting-main prof-setting-toggle"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <span className="prof-setting-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="prof-setting-text">
              <span className="prof-setting-label">{label}</span>
              {!simple && <span className="prof-setting-desc">{description}</span>}
            </span>
            <FaChevronDown className={`prof-setting-caret ${open ? "open" : ""}`} aria-hidden="true" />
          </button>
        ) : (
          <div className="prof-setting-main prof-setting-static">
            <span className="prof-setting-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="prof-setting-text">
              <span className="prof-setting-label">{label}</span>
              {!simple && <span className="prof-setting-desc">{description}</span>}
            </span>
          </div>
        )}

        {/* Fuera del botón de al lado: un control adentro de otro control no es HTML
            válido, y el click terminaría en cualquiera de los dos. */}
        <input
          type="checkbox"
          className="adm-switch"
          role="switch"
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={(event) => flip(event.target.checked)}
        />
      </div>

      {/* Siempre montado: es lo que deja que se abra y se cierre con animacion, en vez
          de aparecer de golpe. `inert` lo saca del tab mientras esta cerrado. */}
      {expandable && (
        <div className={`adm-collapsible ${open ? "open" : ""}`}>
          <div>
            <div className={`prof-setting-extra ${locked ? "locked" : ""}`} inert={!open || locked}>
              {locked && <p className="ui-hint">Configuración disponible con la opción activada.</p>}
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
  /** Acá no se esconde entera: lleva en qué estado está la lista, que es un dato. */
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
  simple,
  disabled,
  onChange,
}: {
  mail: MailSetting;
  simple: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="prof-mail">
      <span className="prof-setting-text">
        <span className="prof-mail-label">{mail.label}</span>
        {!simple && <span className="prof-setting-desc">{mail.description}</span>}
      </span>
      <input
        type="checkbox"
        className="adm-switch"
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
  const w = useWords();
  const policies = usePolicies();
  // Lo que el consultorio impone para todos, dicho en una línea cada cosa.
  const imposed = [
    policies.acceptMode === "always" ? `${w.Los("turno")} pedid${w.os("turno")} se confirman solos.` : "",
    policies.acceptMode === "never" ? `${w.Los("turno")} pedid${w.os("turno")} se confirman a mano.` : "",
    policies.markMode === "assisted" ? `${w.Los("turno")} que pasaron se cierran solos como asistidos.` : "",
    policies.markMode === "missed" ? `${w.Los("turno")} que pasaron se cierran solos como ausentes.` : "",
    policies.markMode === "never" ? `${w.Los("turno")} que pasaron se cierran a mano.` : "",
    policies.payMode === "always" ? `${w.Los("turno")} atendid${w.os("turno")} se dan por cobrad${w.os("turno")} solos.` : "",
    policies.payMode === "never" ? "Los cobros se marcan a mano." : "",
  ].filter(Boolean);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [mailsOpen, setMailsOpen] = useState(false);
  const [vacationsOpen, setVacationsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [simple, setSimple] = useSimpleText();
  const [simpleViewOn, setSimpleView] = useSimpleView();
  // Prender la vista simplificada pregunta antes; apagarla no. Lo que hay que avisar es
  // que van a dejar de verse cosas, y eso solo pasa en un sentido.
  const [confirmingSimpleView, setConfirmingSimpleView] = useState(false);
  const [alsoLessText, setAlsoLessText] = useState(false);

  function load() {
    findSettings()
      .then(setSettings)
      .catch((err) => toast.error(`Error al cargar la configuración: ${err.message}`));
  }

  useEffect(load, []);

  function save(data: {
    autoAccept?: boolean;
    autoMark?: AutoMark | null;
    autoMarkWhen?: AutoMarkWhen;
    autoPay?: boolean;
    autoPayWhen?: AutoPayWhen;
    mails?: Record<string, boolean>;
  }) {
    setSaving(true);
    updateSettings(data)
      .then(setSettings)
      .catch((err) => toast.error(err.message))
      .finally(() => setSaving(false));
  }

  const onVacation = settings?.vacations.find((vacation) => vacation.current);
  // Si las carga el profesional (solo o junto con la administración).
  const ownVacations = policies.vacations !== "admin";

  // Cerrado, el renglón tiene que decir si hay algo apagado: es el único momento en que
  // alguien se entera de que dejó de recibir un aviso hace tres meses.
  const mutedMails = settings?.mails.filter((mail) => !mail.enabled).length ?? 0;
  const mailsState =
    mutedMails === 0
      ? "Todos activos."
      : mutedMails === 1
        ? "Uno desactivado."
        : `${mutedMails} desactivados.`;

  return (
    <section className="prof-today">
      <div className="prof-today-head">
        <div>
          <h2 className="prof-today-title">Configuración</h2>
          {!simple && <p className="prof-today-date">Automatizaciones y preferencias</p>}
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
            {/*
              La vista simplificada, primera de todas.
              --------------------------------------
              Va arriba de todo y no al final con "menos texto" porque es la que más
              cambia lo que se ve, y porque el que la necesita es justamente el que no
              llega leyendo hasta el fondo de la configuración.
            */}
            <div className="prof-setting">
              <div className="prof-setting-row">
                <div className="prof-setting-main prof-setting-static">
                  <span className="prof-setting-icon" aria-hidden="true">
                    <FaCompress />
                  </span>
                  <span className="prof-setting-text">
                    <span className="prof-setting-label">Vista simplificada</span>
                    {!simple && (
                      <span className="prof-setting-desc">
                        Muestra lo de uso diario y oculta las herramientas menos usadas.
                      </span>
                    )}
                  </span>
                </div>

                <input
                  type="checkbox"
                  className="adm-switch"
                  role="switch"
                  aria-label="Vista simplificada"
                  checked={simpleViewOn}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      setSimpleView(false);
                      return;
                    }
                    // Prender "menos texto" junto con esto viene marcado solo cuando está
                    // apagado. Son dos cosas distintas y se llevan bien: una acorta lo que
                    // se lee y la otra saca funciones de la pantalla.
                    setAlsoLessText(!simple);
                    setConfirmingSimpleView(true);
                  }}
                />
              </div>
            </div>

            {/* Lo que el consultorio define para todos se cuenta, en vez de un interruptor
                que no se puede mover. */}
            {imposed.length > 0 && (
              <div className="ui-alert ui-alert-info">
                <strong>{`Lo define ${w.el("lugar")} para todos`}</strong>
                {imposed.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}

            {policies.proRecurring && (
            <Link className="prof-setting-link" to="/Recurrences">
              <span className="prof-setting-icon" aria-hidden="true">
                <FaRepeat />
              </span>
              <span className="prof-setting-text">
                <span className="prof-setting-label">{`${w.Turnos} repetibles`}</span>
                {!simple && (
                  <span className="prof-setting-desc">
                    {`${w.Turnos} que se agendan sol${w.os("turno")} cada semana, con ${w.paciente} y fecha de fin.`}
                  </span>
                )}
              </span>
              <FaChevronRight className="prof-setting-chevron" aria-hidden="true" />
            </Link>
            )}

            {/* Solo vale para lo que entre de acá en adelante. Lo que ya está esperando se
                despacha desde la bandeja de pedidos, arriba de todo, que es donde se lo
                está mirando. */}
            {policies.acceptMode === "each" && (
            <Switch
              checked={settings.autoAccept}
              disabled={saving}
              onChange={(value) => save({ autoAccept: value })}
              label={`Confirmar ${w.turnos} automáticamente`}
              icon={<FaCircleCheck />}
              simple={simple}
              description={`${w.Los("turno")} solicitad${w.os("turno")} por ${w.pacientes} quedan confirmad${w.os("turno")} sin aprobación manual.`}
            />
            )}

            {/*
              Las dos automatizaciones de abajo se esconden con la vista simplificada, pero
              solo mientras estén apagadas. Esconder un interruptor encendido dejaría al
              profesional sin forma de apagarlo, y una automatización que no se puede apagar
              y que además no se ve es lo peor de los dos mundos.
            */}
            {policies.markMode === "each" && (!simpleViewOn || settings.autoMark !== null) && (
            <Switch
              checked={settings.autoMark !== null}
              disabled={saving}
              onChange={(value) => save({ autoMark: value ? "assisted" : null })}
              label={`Cerrar ${w.los("turno")} que ya pasaron automáticamente`}
              icon={<FaClipboardCheck />}
              simple={simple}
              description={`${w.Los("turno")} sin marcar reciben la asistencia automáticamente. Se pueden corregir a mano.`}
            >
              <div className="ui-field">
                <span>Cierre</span>
                <div className="ui-choice-row">
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark"
                      checked={settings.autoMark === "assisted"}
                      onChange={() => save({ autoMark: "assisted" })}
                    />
                    <span>Asistió</span>
                  </label>
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark"
                      checked={settings.autoMark === "missed"}
                      onChange={() => save({ autoMark: "missed" })}
                    />
                    <span>No asistió</span>
                  </label>
                </div>
              </div>

              <div className="ui-field">
                <span>Momento</span>
                <div className="ui-choice-row">
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-mark-when"
                      checked={settings.autoMarkWhen === "appointment"}
                      onChange={() => save({ autoMarkWhen: "appointment" })}
                    />
                    <span>{`Al terminar cada ${w.turno}`}</span>
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
                {!simple && (
                  <small>
                    {`Al terminar el día queda margen para cargar a mano ${w.los("turno")} extendid${w.os("turno")} o con demora.`}
                  </small>
                )}
              </div>

              <p className="ui-alert ui-alert-info">
                {`Aplica a ${w.los("turno")} que terminen desde ahora. L${w.os("turno")} anteriores quedan sin cambios.`}
              </p>
            </Switch>
            )}

            {/* Para el consultorio donde se cobra en el momento y siempre: ahí registrar
                cada pago es escribir dos veces lo mismo, y lo único que importa es la
                excepción. Con esto la excepción es lo único que se marca a mano. */}
            {policies.payMode === "each" && (!simpleViewOn || settings.autoPay) && (
            <Switch
              checked={settings.autoPay}
              disabled={saving}
              onChange={(value) => save({ autoPay: value })}
              label={`Considerar cobrad${w.o("turno")} ${w.un("turno")} automáticamente`}
              icon={<FaMoneyBillWave />}
              simple={simple}
              description={`${w.Los("turno")} ya pasad${w.os("turno")} se dan por cobrad${w.os("turno")}. L${w.os("turno")} adeudad${w.os("turno")} se corrigen a mano.`}
            >
              <div className="ui-field">
                <span>Momento</span>
                <div className="ui-choice-row">
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-pay-when"
                      checked={settings.autoPayWhen === "appointment"}
                      onChange={() => save({ autoPayWhen: "appointment" })}
                    />
                    <span>{`Al terminar cada ${w.turno}`}</span>
                  </label>
                  <label className="ui-choice">
                    <input
                      type="radio"
                      name="auto-pay-when"
                      checked={settings.autoPayWhen === "day"}
                      onChange={() => save({ autoPayWhen: "day" })}
                    />
                    <span>Al terminar el día</span>
                  </label>
                </div>
                {!simple && (
                  <small>{`Al terminar el día queda margen para marcar l${w.os("turno")} adeudad${w.os("turno")} antes de dar${w.lo("turno")}s por cobrad${w.os("turno")}.`}</small>
                )}
              </div>

              <p className="ui-alert ui-alert-info">
                {`Aplica solo a ${w.turnos} atendid${w.os("turno")} y sin cobrar. Los cobros parciales y ${w.los("turno")} anteriores a la activación quedan sin cambios.`}
              </p>
            </Switch>
            )}

            {/* Con todos prendidos no hay nada que mirar acá y la lista se esconde. Si el
                profesional apagó alguno, el renglón se queda: es el único lugar donde se
                entera de que dejó de recibir un aviso. */}
            {(!simpleViewOn || mutedMails > 0) && (
            <Dropdown
              label="Avisos por mail"
              description={simple ? mailsState : `Avisos que llegan a la casilla. ${mailsState}`}
              icon={<FaEnvelope />}
              open={mailsOpen}
              onToggle={() => setMailsOpen(!mailsOpen)}
            >
              {settings.mails.map((mail) => (
                <MailRow
                  key={mail.key}
                  mail={mail}
                  simple={simple}
                  disabled={saving}
                  onChange={(enabled) => save({ mails: { [mail.key]: enabled } })}
                />
              ))}
            </Dropdown>
            )}

            {/*
              Menos texto.
              ------------
              Va al final y no arriba de todo porque no es una automatización: no cambia
              nada de lo que el consultorio hace, solo cómo se lee esta pantalla. Y va
              acá abajo también por otra razón: el que llega hasta el fondo leyendo es
              justamente el que ya se cansó de leer.

              Lo que apaga son las descripciones que repiten lo que el título ya dice.
              Lo que dice qué pasa con lo que ya estaba cargado se queda siempre: eso no
              es una explicación de más, es la diferencia entre entender y no entender
              qué va a tocar el día que se prenda.
            */}
            <div className="prof-setting">
              <div className="prof-setting-row">
                <div className="prof-setting-main prof-setting-static">
                  <span className="prof-setting-icon" aria-hidden="true">
                    <FaAlignLeft />
                  </span>
                  <span className="prof-setting-text">
                    <span className="prof-setting-label">Menos texto</span>
                    {!simple && (
                      <span className="prof-setting-desc">
                        Muestra solo los títulos. Los avisos sobre qué se modifica siguen visibles.
                      </span>
                    )}
                  </span>
                </div>

                <input
                  type="checkbox"
                  className="adm-switch"
                  role="switch"
                  aria-label="Menos texto"
                  checked={simple}
                  onChange={(event) => setSimple(event.target.checked)}
                />
              </div>
            </div>

            <div className="prof-setting-actions adm-btn-row">
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setVacationsOpen(true)}>
                <FaPlaneDeparture />
                {onVacation ? `De vacaciones hasta el ${shortDate(onVacation.toDate)}` : ownVacations ? "Cargar vacaciones" : "Ver vacaciones"}
              </button>
              {/* Se lleva por delante el historial de una persona y se usa una vez cada
                  tanto, así que es lo primero que sobra en la vista simplificada. */}
              {!simpleViewOn && policies.proDeleteHistory && (
                <button type="button" className="adm-btn adm-btn-danger" onClick={() => setDeleteOpen(true)}>
                  <FaTrashCan />
                  {`Borrar ${w.los("turno")} de ${w.un("paciente")}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Donde las vacaciones las carga la administración, el profesional las ve y no las
          toca: el servidor lo rechazaría igual. */}
      <VacationsModal
        open={vacationsOpen}
        onClose={() => setVacationsOpen(false)}
        vacations={settings?.vacations ?? null}
        note={ownVacations ? null : "Las vacaciones las carga la administración."}
        onAdd={ownVacations ? (fromDate, toDate, reason) => addVacation(fromDate, toDate, reason).then(load) : undefined}
        onRemove={ownVacations ? (id) => removeVacation(id).then(load) : undefined}
      />
      <DeletePatientModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />

      {/*
        El aviso antes de prender la vista simplificada.
        -----------------------------------------------
        Corto y con lo único que hay que saber: van a dejar de verse cosas, y la forma de
        recuperarlas es apagar esto mismo. No lista cuáles a propósito, porque la lista es
        más larga que la decisión y el interruptor queda acá, a la vista.
      */}
      <Modal
        open={confirmingSimpleView}
        onClose={() => setConfirmingSimpleView(false)}
        size="sm"
        title="Vista simplificada"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirmingSimpleView(false)}>
              Volver
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              onClick={() => {
                setSimpleView(true);
                if (alsoLessText) setSimple(true);
                setConfirmingSimpleView(false);
                toast.success("Vista simplificada activada");
              }}
            >
              <FaCompress />
              Activar
            </button>
          </>
        }
      >
        <p className="adm-confirm-lead">Algunas funciones quedan ocultas.</p>
        <p className="adm-confirm-note">Siguen activas. Para volver a verlas, desactivar este modo desde acá.</p>

        {/* Solo si todavía no lo tiene puesto. Ofrecer prender algo que ya está prendido
            es una línea que no dice nada y una casilla que no hace nada. */}
        {!simple && (
          <label className="ui-choice prof-setting-suggest">
            <input type="checkbox" checked={alsoLessText} onChange={(event) => setAlsoLessText(event.target.checked)} />
            <span>Activar también «menos texto», que oculta las explicaciones largas</span>
          </label>
        )}
      </Modal>
    </section>
  );
}

/**
 * Borrar los turnos de un paciente.
 *
 * Dos pasos a propósito: primero se elige a quién y qué, y recién después aparece el
 * botón que borra. Es definitivo y no hay pantalla desde donde recuperarlo.
 */
function DeletePatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWords();
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
            ? `Sin ${w.turnos} para borrar`
            : `Se borraron ${result.deleted} ${w.turnos}${result.stoppedRecurrences > 0 ? " y se frenaron sus repeticiones" : ""}`
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
      title={`Borrar ${w.los("turno")} de ${w.un("paciente")}`}
      subtitle={confirming ? name : `${w.Paciente} y alcance del borrado`}
      footer={
        confirming ? (
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirming(false)}>
              Volver
            </button>
            <button type="button" className="adm-btn adm-btn-danger" disabled={saving} onClick={run}>
              Borrar definitivamente
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
            Se borran {scope === "all" ? `tod${w.os("turno")} ${w.los("turno")}` : `${w.los("turno")} de hoy en adelante`} de {name}, junto con sus
            observaciones. El borrado es definitivo.
          </p>
          <p className="ui-hint">
            {`Si hay ${w.un("turno")} repetible, se frena para que no vuelva a generar ${w.los("turno")} borrad${w.os("turno")}.`}
          </p>
        </div>
      ) : (
        <div className="ui-section">
          <label className="ui-field">
            <span>{w.Paciente}</span>
            <select value={email} onChange={(event) => setEmail(event.target.value)}>
              <option value="">{`Seleccionar ${w.paciente}`}</option>
              {patients.map((patient) => (
                <option key={patient.email} value={patient.email}>
                  {patient.surname}, {patient.name}
                </option>
              ))}
            </select>
            <small>
              {`Solo ${w.pacientes} propi${w.os("paciente")}. ${w.Los("turno")} con otr${w.os("profesional")} ${w.profesionales} quedan sin cambios.`}
            </small>
          </label>

          <div className="ui-field">
            <span>Alcance</span>
            <div className="ui-choice-row">
              <label className="ui-choice">
                <input type="radio" name="delete-scope" checked={scope === "future"} onChange={() => setScope("future")} />
                <span>De hoy en adelante</span>
              </label>
              <label className="ui-choice">
                <input type="radio" name="delete-scope" checked={scope === "all"} onChange={() => setScope("all")} />
                <span>{`Tod${w.os("turno")}, historial incluido`}</span>
              </label>
            </div>
            <small>
              {scope === "future"
                ? `${w.Los("turno")} ya atendid${w.os("turno")} quedan registrad${w.os("turno")}, con sus observaciones.`
                : `Incluye ${w.los("turno")} ya atendid${w.os("turno")}. El historial de esas sesiones deja de estar disponible.`}
            </small>
          </div>
        </div>
      )}
    </Modal>
  );
}
