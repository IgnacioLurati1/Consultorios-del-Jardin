import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { FaHouse, FaLeaf, FaRepeat } from "react-icons/fa6";
import "./ErrorPage.css";

// La aplicación no siempre vive en la raíz del dominio: publicada cuelga del nombre del
// repositorio. Estos dos links recargan la página entera a propósito —es la forma de salir
// de un router roto— y por eso no pueden pasar por el router: hay que ponerles el prefijo
// a mano o terminan en el 404 del hosting, fuera de la aplicación.
const HOME = import.meta.env.BASE_URL;

/** El texto crudo del error, para que sirva si alguien nos lo copia y pega. */
function detailOf(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Sin detalle";
}

/**
 * La pantalla que aparece cuando el front se rompe de verdad. Reemplaza al cartel
 * técnico de React Router, que asusta sin necesidad: acá lo primero que se lee es que
 * los datos están a salvo, y el detalle queda plegado para quien lo necesite.
 */
export function ErrorPage() {
  const error = useRouteError();

  return (
    <div className="er-page">
      <div className="er-card">
        <span className="er-badge" aria-hidden="true">
          <FaLeaf />
        </span>

        <h1 className="er-title">Se nos trabó algo</h1>

        <p className="er-text">
          El problema es nuestro, no tuyo. Tus turnos y tus datos siguen guardados tal como estaban.
          Nada de lo que hiciste se perdió.
        </p>

        <p className="er-text er-text-quiet">Casi siempre se arregla volviendo a cargar la pantalla.</p>

        <div className="er-actions">
          {/* Recarga entera, no navegación: si el router quedó en un estado raro, esto lo limpia. */}
          <button type="button" className="er-btn er-btn-main" onClick={() => window.location.reload()}>
            <FaRepeat aria-hidden="true" />
            Volver a cargar
          </button>
          <a className="er-btn" href={HOME}>
            <FaHouse aria-hidden="true" />
            Ir al inicio
          </a>
        </div>

        <details className="er-detail">
          <summary>Ver el detalle técnico</summary>
          <code>{detailOf(error)}</code>
          <p className="er-detail-note">
            Si vuelve a pasar, copiá esta línea y <a href={`${HOME}contacto`}>contanos</a>.
          </p>
        </details>
      </div>
    </div>
  );
}
