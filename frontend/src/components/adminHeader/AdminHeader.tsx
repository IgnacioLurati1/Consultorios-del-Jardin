import { Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";
import "../../pages/adminCRUDS/adminPanel.css";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  /** A dónde vuelve el botón. Por defecto, al menú del administrador. */
  backTo?: string;
  backLabel?: string;
  /** Acciones opcionales alineadas a la derecha (botones, filtros, etc.) */
  actions?: React.ReactNode;
}

/**
 * Encabezado común de las pantallas de administración.
 * Reemplaza a la barra flotante de navegación rápida que vivía abajo de todo.
 */
export function AdminHeader({ title, subtitle, backTo = "/AdminHome", backLabel = "Menú", actions }: AdminHeaderProps) {
  return (
    <header className="adm-header">
      <div className="adm-header-titles">
        <h1 className="adm-title">{title}</h1>
        {subtitle && <p className="adm-subtitle">{subtitle}</p>}
      </div>

      <div className="adm-toolbar" style={{ margin: 0 }}>
        {actions}
        <Link className="adm-back" to={backTo}>
          <FaArrowLeft />
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
