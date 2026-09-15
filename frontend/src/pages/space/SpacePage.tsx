import { Link, Navigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa6";
import { EntranceCanvas } from "../../components/entrance/EntranceCanvas";
import { useDesktop } from "../../components/entrance/useDesktop";
import "./SpacePage.css";

/**
 * El hall del consultorio a pantalla completa, el mismo del fondo del ingreso pero sin la
 * tarjeta adelante. Se llega desde el pie de la página de inicio.
 *
 * Es solo para computadoras: desde el celular (o si la ventana se achica) vuelve al inicio,
 * que es donde estaba el link.
 */
export function SpacePage() {
  const desktop = useDesktop();

  if (!desktop) return <Navigate to="/" replace />;

  return (
    <div className="space-page entrance-host">
      <h1 className="space-title">Nuestro espacio común</h1>
      <EntranceCanvas centered />

      <Link to="/" className="entrance-toggle">
        <FaArrowLeft aria-hidden="true" />
        Volver al inicio
      </Link>

      <p className="space-hint">Las puertas, la lámpara y las plantas se pueden tocar</p>
    </div>
  );
}
