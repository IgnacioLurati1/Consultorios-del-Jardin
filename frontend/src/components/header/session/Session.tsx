import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaChevronDown, FaRightFromBracket, FaUserPen, FaGear } from "react-icons/fa6";
import { useAuth } from "../../../context/AuthContext";
import { findPerson, getDecodedToken } from "../../../pages/commonServices";
import { Modal } from "../../modal/Modal";
import api from "../../../axios";
import type { Person } from "../../../pages/types";
import "../Header.css";

const PANEL_BY_TYPE: Record<string, { label: string; to: string }> = {
  admin: { label: "Panel de administración", to: "/AdminHome" },
  professional: { label: "Panel del profesional", to: "/ProfessionalHome" },
  client: { label: "Mis turnos", to: "/AppointmentsList" },
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  professional: "Profesional",
  client: "Paciente",
};

/**
 * Bloque de sesión de la barra superior. Sin sesión muestra los accesos a login y
 * registro; con sesión, un menú con los datos de la persona, su panel y la salida.
 */
export function Session() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [person, setPerson] = useState<Person | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const decoded = token ? getDecodedToken() : null;

  useEffect(() => {
    if (!decoded) {
      setPerson(undefined);
      return;
    }

    findPerson(decoded.email)
      .then((data) => setPerson(data ?? undefined))
      .catch(() => setPerson(undefined));
  }, [token]);

  // Cerrar el menú al clickear afuera o con Escape, como cualquier menú del sistema.
  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleLogout() {
    setLeaving(true);
    // La cookie del refresh token la borra el backend; si falla igual salimos.
    await api.post("/people/logout", {}, { withCredentials: true }).catch(() => undefined);
    logout();
    setConfirming(false);
    setLeaving(false);
    setOpen(false);
    navigate("/");
  }

  if (!token || !decoded) {
    return (
      <div className="app-session">
        <Link className="app-header-btn ghost" to="/Login">
          Iniciar sesión
        </Link>
        <Link className="app-header-btn solid" to="/Register">
          Crear cuenta
        </Link>
      </div>
    );
  }

  const name = person ? `${person.name} ${person.surname}` : decoded.email;
  const initials = person ? `${person.name.charAt(0)}${person.surname.charAt(0)}`.toUpperCase() : decoded.email.charAt(0).toUpperCase();
  const panel = PANEL_BY_TYPE[decoded.type];

  return (
    <div className="app-session" ref={menuRef}>
      <button type="button" className="app-user-button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="app-user-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="app-user-name">{name}</span>
        <FaChevronDown className={`app-user-chevron ${open ? "open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="app-user-menu" role="menu">
          <div className="app-user-menu-head">
            <span className="app-user-menu-name">{name}</span>
            <span className="app-user-menu-mail">{decoded.email}</span>
            <span className="adm-badge adm-badge-green">{ROLE_LABEL[decoded.type] ?? decoded.type}</span>
          </div>

          {panel && (
            <Link className="app-user-menu-item" role="menuitem" to={panel.to} onClick={() => setOpen(false)}>
              <FaGear />
              {panel.label}
            </Link>
          )}

          <Link className="app-user-menu-item" role="menuitem" to="/EditProfile" onClick={() => setOpen(false)}>
            <FaUserPen />
            Mis datos
          </Link>

          <button type="button" className="app-user-menu-item danger" role="menuitem" onClick={() => setConfirming(true)}>
            <FaRightFromBracket />
            Cerrar sesión
          </button>
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title="Cerrar sesión"
        subtitle={decoded.email}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setConfirming(false)}>
              Seguir acá
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={handleLogout} disabled={leaving}>
              {leaving ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </>
        }
      >
        <p className="ui-alert ui-alert-info">
          Vas a volver a la página de inicio. Para entrar de nuevo vas a tener que escribir tu email y tu contraseña.
        </p>
      </Modal>
    </div>
  );
}
