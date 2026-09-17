import { useEffect, useMemo, useState } from "react";
import { FaBan, FaBell, FaBellSlash, FaEnvelope, FaEye, FaEyeSlash, FaPen, FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import type { Person } from "../../types";
import { SPECIALITIES } from "../../specialities.ts";
import { deletionLabel, deletionThisMonth } from "./accountDeletion.ts";

interface UserModalProps {
  visible: boolean;
  user: Person | undefined;
  /** Si la ficha abierta es la del administrador que está mirando. */
  isSelf?: boolean;
  /** Nombre del profesional que cargó a este paciente, si fue cargado a mano. */
  createdByName?: string;
  onClose: () => void;
  onToggleState: (email: string) => void;
  /** Muestra o esconde al profesional de la búsqueda de turnos. Solo para profesionales. */
  onToggleBookable: (email: string) => void;
  /** Prende o apaga su lista de espera. Solo para profesionales. */
  onToggleWaitlist?: (email: string) => void;
  /**
   * Borra al paciente de la base. Solo se ofrece para pacientes.
   *
   * `force` es el sí a la segunda pregunta, la que el servidor pide cuando la persona
   * tiene turnos cargados. Devuelve el motivo si el servidor lo frenó, y nada si salió.
   */
  onDelete?: (email: string, force: boolean) => Promise<{ message: string; code?: string } | null>;
  /** Corrige el correo de un paciente sin cuenta. Devuelve el motivo si no se pudo. */
  onChangeEmail?: (email: string, newEmail: string) => Promise<string | null>;
  /** Guarda los cambios. Solo se ofrece para profesionales. */
  onEdit: (email: string, data: Partial<Person>) => void;
}

const emptyUser = { email: "", name: "", surname: "", docType: "", docNumber: "", phoneNumber: "", speciality: "", about: "" };

/** El mismo tope que valida el backend. */
const ABOUT_MAX = 600;

/**
 * Cómo se lee la fecha de borrado, con el cierre de mes al que corresponde.
 *
 * "A partir de" y no "el": la limpieza corre una vez por semana, así que la cuenta que
 * cumple su fecha un martes se borra el lunes siguiente. Lo que la fecha promete es que
 * hasta ahí se puede recuperar.
 */
function deletionSentence(bannedAt?: string | null): string {
  const date = deletionLabel(bannedAt ?? undefined);
  return `${date}, ${deletionThisMonth(bannedAt ?? undefined) ? "al cierre de este mes" : "al cierre del mes que viene"}`;
}

/**
 * La última vez que entró, y por dónde. Se cuenta un acceso por día y por canal, así que
 * alcanza con el día.
 */
function lastAccess(user: Person): string | null {
  const channels = [
    { at: user.lastWebAccess, by: "la página" },
    { at: user.lastAppAccess, by: "la app" },
  ].filter((channel) => channel.at) as { at: string; by: string }[];
  if (channels.length === 0) return null;

  const latest = channels.reduce((a, b) => (new Date(b.at) > new Date(a.at) ? b : a));
  const date = new Date(latest.at);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString("es-AR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
  return `${day}, por ${latest.by}`;
}

export function UserModal({
  visible,
  user,
  isSelf = false,
  createdByName,
  onClose,
  onToggleState,
  onToggleBookable,
  onToggleWaitlist,
  onDelete,
  onChangeEmail,
  onEdit,
}: UserModalProps) {
  const [userData, setUserData] = useState(emptyUser);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Lo que está esperando un sí. Los tres cambian algo que no se deshace solo, así que
   * ninguno pasa de un clic. Apagar la lista de espera la vacía y avisa a quien estaba,
   * deshabilitar le pone fecha de borrado a la cuenta, y eliminar borra al paciente.
   */
  const [confirming, setConfirming] = useState<null | "waitlist" | "disable" | "delete" | "delete-todo" | "email">(null);
  /** El correo nuevo, mientras se lo escribe. Corregirlo mueve la ficha entera. */
  const [newEmail, setNewEmail] = useState("");
  /** Lo que contestó el servidor al frenar la baja, que dice cuántos turnos hay. */
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // El admin solo edita profesionales. Los pacientes quedan en modo lectura: los suyos
  // los mantiene cada persona, y los sin cuenta, el profesional que los cargó.
  const isProfessional = user?.type === "professional";
  const isAdmin = user?.type === "admin";
  const isPatient = user?.type === "client";

  // Lo que hay guardado, que es de donde arranca la ficha y a donde vuelve al descartar.
  const savedFields = useMemo(
    () => ({
      email: user?.email ?? "",
      name: user?.name ?? "",
      surname: user?.surname ?? "",
      docType: user?.docType ?? "",
      docNumber: user?.docNumber ?? "",
      phoneNumber: user?.phoneNumber ?? "",
      speciality: user?.speciality ?? "",
      about: user?.about ?? "",
    }),
    [user]
  );

  useEffect(() => {
    if (!visible || !user) return;

    setUserData(savedFields);
    setEditing(false);
    setError(null);
    setConfirming(null);
    setNewEmail("");
    setDeleteWarning(null);
    setBusy(false);
  }, [visible, user, savedFields]);

  if (!visible || !user) return null;

  function validate(): string | null {
    if (!userData.name.trim() || !userData.surname.trim()) return "El nombre y el apellido no pueden quedar vacíos";
    if (!/^\d+$/.test(userData.docNumber.trim())) return "El documento tiene que tener solo dígitos";
    if (!/^\d{10}$/.test(userData.phoneNumber.replace(/\D/g, "")))
      return "El teléfono tiene que tener 10 dígitos, sin 0 ni 15 (ej: 3411234567)";
    if (!userData.speciality.trim()) return "La especialidad no puede quedar vacía";
    return null;
  }

  function handleSave() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    // El email es la PK y la contraseña no se toca desde acá: no se mandan.
    onEdit(userData.email, {
      name: userData.name.trim(),
      surname: userData.surname.trim(),
      docType: userData.docType,
      docNumber: userData.docNumber.trim(),
      phoneNumber: userData.phoneNumber.replace(/\D/g, ""),
      speciality: userData.speciality.trim(),
      about: userData.about.trim(),
    });
  }

  /**
   * Guarda el correo nuevo de un paciente sin cuenta.
   *
   * Del otro lado no es editar un campo: el correo es la clave de la persona en la base,
   * así que el servidor mueve la ficha entera con sus turnos.
   */
  async function handleEmail() {
    const wanted = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wanted)) {
      setError("El correo nuevo no tiene un formato válido");
      return;
    }

    setBusy(true);
    const problem = await onChangeEmail?.(user!.email, wanted);
    setBusy(false);

    if (problem) setError(problem);
    else onClose();
  }

  /**
   * Borra la ficha. La primera vez sin `force`: si la persona tiene turnos cargados, el
   * servidor frena y cuenta cuántos son, y eso se muestra antes de volver a preguntar.
   */
  async function handleDelete(force: boolean) {
    setBusy(true);
    const problem = await onDelete?.(user!.email, force);
    setBusy(false);

    if (!problem) {
      onClose();
      return;
    }

    // `HAS_APPOINTMENTS` es el servidor diciendo que esa persona tiene historial, y que
    // hace falta decir que sí de nuevo sabiendo qué se lleva puesto.
    if (problem.code === "HAS_APPOINTMENTS") {
      setDeleteWarning(problem.message);
      setConfirming("delete-todo");
      setError(null);
    } else {
      setError(problem.message);
      setConfirming(null);
    }
  }

  const footer = editing ? (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => {
          // Descartar vuelve a lo guardado, y no solo cierra el modo edición. Sin esto la
          // ficha quedaba mostrando el texto que nadie guardó, así que la presentación se
          // veía cambiada acá y seguía siendo la vieja para los pacientes.
          setUserData(savedFields);
          setEditing(false);
          setError(null);
        }}
      >
        Descartar
      </button>
      <button type="button" className="adm-btn adm-btn-primary" onClick={handleSave}>
        Guardar cambios
      </button>
    </>
  ) : confirming === "email" ? (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => {
          setConfirming(null);
          setError(null);
        }}
      >
        Volver
      </button>
      <button type="button" className="adm-btn adm-btn-primary" disabled={busy} onClick={handleEmail}>
        {busy ? "Guardando…" : "Guardar el correo"}
      </button>
    </>
  ) : confirming ? (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => {
          setConfirming(null);
          setError(null);
        }}
      >
        Volver
      </button>
      <button
        type="button"
        className="adm-btn adm-btn-danger"
        disabled={busy}
        onClick={() => {
          if (confirming === "waitlist") {
            onToggleWaitlist?.(user.email);
            onClose();
            return;
          }
          if (confirming === "disable") {
            onToggleState(user.email);
            onClose();
            return;
          }
          void handleDelete(confirming === "delete-todo");
        }}
      >
        {confirming === "waitlist" ? <FaBellSlash /> : confirming === "disable" ? <FaBan /> : <FaTrash />}
        {confirming === "waitlist"
          ? "Sí, apagarla"
          : confirming === "disable"
          ? "Sí, deshabilitar"
          : confirming === "delete-todo"
          ? "Eliminar igual"
          : "Sí, eliminar"}
      </button>
    </>
  ) : (
    <>
      {isProfessional && (
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(true)}>
          <FaPen />
          Editar datos
        </button>
      )}

      {/* Dos formas distintas de sacar a alguien de circulación: esta lo esconde de la
          búsqueda de turnos y lo deja trabajando; la de al lado lo saca del sistema. */}
      {isProfessional && user.active && (
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          onClick={() => {
            onToggleBookable(user.email);
            onClose();
          }}
        >
          {user.bookable === false ? <FaEye /> : <FaEyeSlash />}
          {user.bookable === false ? "Volver a ofrecerlo" : "Sacar de la búsqueda"}
        </button>
      )}

      {/* Prenderla es inmediato; apagarla se confirma, porque se lleva puesta la lista. */}
      {isProfessional && user.active && onToggleWaitlist && (
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          onClick={() => {
            if (user.waitlistEnabled === false) {
              onToggleWaitlist(user.email);
              onClose();
            } else {
              setConfirming("waitlist");
            }
          }}
        >
          {user.waitlistEnabled === false ? <FaBell /> : <FaBellSlash />}
          {user.waitlistEnabled === false ? "Prender la lista de espera" : "Apagar la lista de espera"}
        </button>
      )}

      {/* La propia cuenta no se deshabilita desde acá: quien queda afuera no puede pedir
          volver, ni siquiera para sí mismo. El backend lo rechaza igual; esto es para no
          ofrecer un botón que solo puede terminar en un error. */}
      {/* Eliminar es la única baja sin vuelta, y por eso está solo donde no se lleva nada
          puesto: un paciente sin turnos. El servidor lo vuelve a comprobar. */}
      {/* Solo en los que no tienen cuenta. Quien tiene la suya entra con ese correo, y
          cambiárselo desde acá sería sacarle la llave de su casa. */}
      {isPatient && user.anonymous && onChangeEmail && (
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          onClick={() => {
            setNewEmail(user.email);
            setError(null);
            setConfirming("email");
          }}
        >
          <FaEnvelope />
          Corregir el correo
        </button>
      )}

      {isPatient && onDelete && (
        <button type="button" className="adm-btn adm-btn-danger" onClick={() => setConfirming("delete")}>
          <FaTrash />
          Eliminar
        </button>
      )}

      {user.active && isSelf ? null : user.active ? (
        <button type="button" className="adm-btn adm-btn-danger" onClick={() => setConfirming("disable")}>
          <FaBan />
          Deshabilitar
        </button>
      ) : (
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          onClick={() => {
            onToggleState(user.email);
            onClose();
          }}
        >
          Habilitar
        </button>
      )}
      <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
        Cerrar
      </button>
    </>
  );

  return (
    <Modal
      open={visible}
      onClose={onClose}
      size="sm"
      title={editing ? "Editar profesional" : `${user.surname}, ${user.name}`}
      subtitle={user.email}
      footer={footer}
    >
      {editing ? (
        <div className="ui-section">
          <div className="ui-field-row">
            <label className="ui-field">
              <span>Nombre</span>
              <input value={userData.name} onChange={(e) => setUserData({ ...userData, name: e.target.value })} />
            </label>
            <label className="ui-field">
              <span>Apellido</span>
              <input value={userData.surname} onChange={(e) => setUserData({ ...userData, surname: e.target.value })} />
            </label>
          </div>

          <div className="ui-field-row">
            <label className="ui-field">
              <span>Tipo de documento</span>
              <select value={userData.docType} onChange={(e) => setUserData({ ...userData, docType: e.target.value })}>
                <option value="DNI">DNI</option>
                <option value="LC">LC</option>
                <option value="LE">LE</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Número de documento</span>
              <input value={userData.docNumber} onChange={(e) => setUserData({ ...userData, docNumber: e.target.value })} />
            </label>
          </div>

          <label className="ui-field">
            <span>Teléfono</span>
            <input value={userData.phoneNumber} onChange={(e) => setUserData({ ...userData, phoneNumber: e.target.value })} />
          </label>

          <label className="ui-field">
            <span>Especialidad</span>
            <select value={userData.speciality} onChange={(e) => setUserData({ ...userData, speciality: e.target.value })}>
              <option value="">Seleccionar…</option>
              {/* Si el profesional tiene cargada una especialidad vieja que ya no está
                  en la lista, se ofrece igual: guardar no debería cambiársela sola. */}
              {(SPECIALITIES.includes(userData.speciality) || !userData.speciality
                ? SPECIALITIES
                : [...SPECIALITIES, userData.speciality]
              ).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span>Acerca de mí</span>
            <textarea
              rows={4}
              maxLength={ABOUT_MAX}
              placeholder="Áreas de trabajo, enfoque, población que se atiende…"
              value={userData.about}
              onChange={(e) => setUserData({ ...userData, about: e.target.value })}
            />
            <small>
              Opcional. Visible para el paciente al elegir profesional. {userData.about.length}/{ABOUT_MAX}
            </small>
          </label>

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>
      ) : (
        <div className="ui-section">
          <div className="ui-detail-list">
            <div className="ui-detail-row">
              <span>Tipo</span>
              <strong>{isAdmin ? "Administración" : isProfessional ? "Profesional" : "Paciente"}</strong>
            </div>
            <div className="ui-detail-row">
              <span>Estado</span>
              <span className={`adm-badge ${user.active ? "adm-badge-green" : "adm-badge-red"}`}>
                {user.active ? "Habilitado" : "Deshabilitado"}
              </span>
            </div>
            {/* Una cuenta deshabilitada tiene fecha de vencimiento, y el día que la borren
                se va con sus turnos. Hasta ahí, habilitarla la salva. */}
            {!user.active && (
              <div className="ui-detail-row">
                <span>Se elimina a partir del</span>
                <strong>{deletionSentence(user.bannedAt)}</strong>
              </div>
            )}
            {isProfessional && (
              <div className="ui-detail-row">
                <span>En la búsqueda de turnos</span>
                <span className={`adm-badge ${user.bookable === false ? "adm-badge-amber" : "adm-badge-green"}`}>
                  {user.bookable === false ? "No aparece" : "Aparece"}
                </span>
              </div>
            )}
            {isProfessional && (
              <div className="ui-detail-row">
                <span>Lista de espera</span>
                <span className={`adm-badge ${user.waitlistEnabled === false ? "adm-badge-amber" : "adm-badge-green"}`}>
                  {user.waitlistEnabled === false ? "No la usa" : "La usa"}
                </span>
              </div>
            )}
            <div className="ui-detail-row">
              <span>Cuenta</span>
              <strong>
                {user.anonymous ? (
                  <span className="adm-badge adm-badge-amber">Sin cuenta</span>
                ) : (
                  "Registrada"
                )}
              </strong>
            </div>
            {createdByName && (
              <div className="ui-detail-row">
                <span>{user.anonymous ? "Cargado por" : "Cargado originalmente por"}</span>
                <strong>{createdByName}</strong>
              </div>
            )}
            <div className="ui-detail-row">
              <span>Documento</span>
              <strong>
                {userData.docType} {userData.docNumber || <span className="ui-detail-empty">sin cargar</span>}
              </strong>
            </div>
            <div className="ui-detail-row">
              <span>Teléfono</span>
              <strong>{userData.phoneNumber || <span className="ui-detail-empty">sin cargar</span>}</strong>
            </div>
            {isProfessional && (
              <div className="ui-detail-row">
                <span>Especialidad</span>
                <strong>{userData.speciality || <span className="ui-detail-empty">sin cargar</span>}</strong>
              </div>
            )}
            {isProfessional && (
              <div className="ui-detail-row">
                <span>Último acceso</span>
                <strong>{lastAccess(user) ?? <span className="ui-detail-empty">nunca entró</span>}</strong>
              </div>
            )}
            {isProfessional && (
              <div className="ui-detail-row">
                <span>Acerca de mí</span>
                <strong>{userData.about || <span className="ui-detail-empty">sin cargar</span>}</strong>
              </div>
            )}
          </div>

          {user.anonymous && (
            <p className="ui-alert ui-alert-info">
              Lo cargó un profesional para poder darle turnos. Si la persona se registra con este email, la cuenta pasa a ser real y
              conserva su historial.
            </p>
          )}

          {confirming === "waitlist" && (
            <p className="ui-alert ui-alert-warn">
              Al desactivarla, la lista de espera se vacía y las personas anotadas reciben un aviso. Desde ese momento, el
              profesional figura sin lista de espera.
            </p>
          )}

          {confirming === "email" && (
            <label className="ui-field">
              <span>Correo nuevo</span>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="paciente@mail.com" autoFocus />
              <small>Se mueve la ficha entera con sus turnos.</small>
            </label>
          )}

          {confirming === "delete-todo" && (
            <p className="ui-alert ui-alert-warn">
              {deleteWarning}. Se van también sus turnos, con lo cobrado y lo anotado en cada uno.
            </p>
          )}

          {confirming === "disable" && (
            <p className="ui-alert ui-alert-warn">
              Deja de entrar en el momento. La cuenta y sus turnos se eliminan a partir del {deletionSentence()}. Hasta esa
              fecha se puede volver a habilitar.
            </p>
          )}

          {confirming === "delete" && (
            <p className="ui-alert ui-alert-warn">
              Se borra la ficha y todo lo suyo, sin vuelta atrás. Si el correo está mal, conviene corregirlo.
            </p>
          )}

          {error && !editing && <p className="ui-alert ui-alert-error">{error}</p>}

          {isSelf && user.active && (
            <p className="ui-alert ui-alert-info">
              Cuenta propia. Solo otro administrador puede deshabilitarla, porque sin acceso no habría forma de pedir la
              habilitación.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
