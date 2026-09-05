import { useEffect, useState } from "react";
import { FaEye, FaEyeSlash, FaPen, FaTrash } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import type { Person } from "../../types";
import { SPECIALITIES } from "../../specialities.ts";

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
  /** Guarda los cambios. Solo se ofrece para profesionales. */
  onEdit: (email: string, data: Partial<Person>) => void;
}

const emptyUser = { email: "", name: "", surname: "", docType: "", docNumber: "", phoneNumber: "", speciality: "", about: "" };

/** El mismo tope que valida el backend. */
const ABOUT_MAX = 600;

export function UserModal({
  visible,
  user,
  isSelf = false,
  createdByName,
  onClose,
  onToggleState,
  onToggleBookable,
  onEdit,
}: UserModalProps) {
  const [userData, setUserData] = useState(emptyUser);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El admin solo edita profesionales. Los pacientes quedan en modo lectura: los suyos
  // los mantiene cada persona, y los anónimos, el profesional que los cargó.
  const isProfessional = user?.type === "professional";
  const isAdmin = user?.type === "admin";

  useEffect(() => {
    if (!visible || !user) return;

    setUserData({
      email: user.email,
      name: user.name,
      surname: user.surname,
      docType: user.docType,
      docNumber: user.docNumber,
      phoneNumber: user.phoneNumber,
      speciality: user.speciality ?? "",
      about: user.about ?? "",
    });
    setEditing(false);
    setError(null);
  }, [visible, user]);

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

  const footer = editing ? (
    <>
      <button
        type="button"
        className="adm-btn adm-btn-ghost"
        onClick={() => {
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

      {/* La propia cuenta no se deshabilita desde acá: quien queda afuera no puede pedir
          volver, ni siquiera para sí mismo. El backend lo rechaza igual; esto es para no
          ofrecer un botón que solo puede terminar en un error. */}
      {user.active && isSelf ? null : user.active ? (
        <button
          type="button"
          className="adm-btn adm-btn-danger"
          onClick={() => {
            onToggleState(user.email);
            onClose();
          }}
        >
          <FaTrash />
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
              <option value="">Elegí una…</option>
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
              placeholder="Con qué trabaja, con qué enfoque, a quiénes atiende…"
              value={userData.about}
              onChange={(e) => setUserData({ ...userData, about: e.target.value })}
            />
            <small>
              Opcional. Es lo que lee el paciente antes de elegir con quién atenderse. {userData.about.length}/{ABOUT_MAX}
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
            {isProfessional && (
              <div className="ui-detail-row">
                <span>En la búsqueda de turnos</span>
                <span className={`adm-badge ${user.bookable === false ? "adm-badge-amber" : "adm-badge-green"}`}>
                  {user.bookable === false ? "No aparece" : "Aparece"}
                </span>
              </div>
            )}
            <div className="ui-detail-row">
              <span>Cuenta</span>
              <strong>
                {user.anonymous ? (
                  <span className="adm-badge adm-badge-amber">Anónimo, sin cuenta</span>
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

          {isSelf && user.active && (
            <p className="ui-alert ui-alert-info">
              Es tu propia cuenta. Deshabilitarla tiene que hacerlo otro administrador. Desde afuera no podrías volver a entrar ni
              pedir que te habiliten.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
