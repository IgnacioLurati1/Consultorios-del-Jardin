import { Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";
import { useSimpleText } from "../../lib/textMode";
import "../../pages/adminCRUDS/adminPanel.css";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Que el subtítulo lleva un dato adentro: una fecha, una cuenta, el nombre de alguien.
   *
   * Con "menos texto" prendido el subtítulo no se dibuja, porque casi siempre reformula
   * el título que tiene arriba. Esto es para los que no: "31 ago al 6 sept" no explica
   * nada, dice qué semana se está mirando, y esconderlo sería esconder información.
   *
   * Lo decide cada pantalla porque varias arman el subtítulo de una manera o de otra
   * según en qué estado estén, y desde acá los dos casos se ven igual: un string.
   */
  subtitleIsData?: boolean;
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
export function AdminHeader({
  title,
  subtitle,
  subtitleIsData,
  backTo = "/AdminHome",
  backLabel = "Menú",
  actions,
}: AdminHeaderProps) {
  const [simple] = useSimpleText();

  return (
    <header className="adm-header">
      <div className="adm-header-titles">
        <h1 className="adm-title">{title}</h1>
        {subtitle && (!simple || subtitleIsData) && <p className="adm-subtitle">{subtitle}</p>}
      </div>

      <div className="adm-toolbar adm-btn-row" style={{ margin: 0 }}>
        {actions}
        <Link className="adm-back" to={backTo}>
          <FaArrowLeft />
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
