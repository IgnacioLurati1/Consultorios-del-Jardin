import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheck, FaCircleExclamation, FaCircleInfo, FaTrash, FaTriangleExclamation } from "react-icons/fa6";
import { useAuth } from "../../context/AuthContext";
import { getDecodedToken } from "../../pages/commonServices";
import {
  dismissAll,
  dismissNotification,
  markSeen,
  readNotifications,
  readSeenMark,
  type AppNotification,
  type NotificationTone,
} from "../../lib/notifications";
import { collectNotifications } from "./notificationSources";
import "./notifications.css";

/**
 * Cada cuánto se vuelve a mirar si pasó algo.
 *
 * Cinco minutos, y solo con la pestaña a la vista. Es un aviso, no un monitor: enterarse
 * cinco minutos después de que un paciente pidió turno no cambia nada, y cada consulta
 * que no se hace es una que el servidor no cobra.
 */
const CADA_MS = 5 * 60 * 1000;

const ICONOS: Record<NotificationTone, React.ComponentType> = {
  urgent: FaCircleExclamation,
  warn: FaTriangleExclamation,
  good: FaCheck,
  info: FaCircleInfo,
};

/**
 * La campanita de la barra de arriba.
 *
 * Junta en un solo lugar lo que hasta ahora solo llegaba por mail. Se dibuja para los
 * tres roles, con la lista que le corresponde a cada uno, y guarda hasta tres días: más
 * atrás no es una novedad, es un archivo, y para eso están las pantallas de verdad.
 *
 * El número se pone en rojo cuando hay algo sin leer, y late cuando entre eso hay algo
 * grave. Late y no cambia de color: el rojo ya lo usa lo normal, y un segundo rojo más
 * rojo no se distinguiría de lejos. El movimiento sí.
 */
export function NotificationBell() {
  const { token } = useAuth();
  if (!token) return null;

  const decoded = getDecodedToken();
  if (!decoded?.email) return null;

  return <Campana email={decoded.email} role={decoded.type} />;
}

function Campana({ email, role }: { email: string; role: string }) {
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<AppNotification[]>(() => readNotifications(email));
  /** Hasta cuándo se leyó. Sale de la cookie y se mueve al abrir la campana. */
  const [marca, setMarca] = useState<number>(() => readSeenMark(email));
  const [open, setOpen] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  const sinVer = useMemo(() => avisos.filter((aviso) => aviso.at > marca), [avisos, marca]);
  const urgente = sinVer.some((aviso) => aviso.tone === "urgent");

  useEffect(() => {
    let vivo = true;

    function mirar() {
      // Con la pestaña de fondo no se pregunta nada: nadie está mirando la campana.
      if (document.hidden) return;

      collectNotifications(role, email)
        .then((lista) => {
          if (vivo) setAvisos(lista);
        })
        // Silencioso: que no se puedan traer los avisos no es motivo para tirarle un
        // error en la cara a alguien que entró a hacer otra cosa.
        .catch(() => undefined);
    }

    mirar();
    const reloj = setInterval(mirar, CADA_MS);
    window.addEventListener("focus", mirar);

    return () => {
      vivo = false;
      clearInterval(reloj);
      window.removeEventListener("focus", mirar);
    };
  }, [role, email]);

  useEffect(() => {
    if (!open) return;

    function afuera(event: MouseEvent) {
      if (caja.current && !caja.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function abrir() {
    const proximo = !open;
    setOpen(proximo);
    if (!proximo) return;

    // Se marcan al abrir, y lo que ya estaba en pantalla se queda igual: esconder lo
    // recién leído sería vaciar la lista en la cara de quien la está por leer. Lo único
    // que cambia es el número y el punto de la izquierda.
    markSeen(email);
    setMarca(Date.now());
  }

  function tocar(aviso: AppNotification) {
    setOpen(false);
    if (aviso.to) navigate(aviso.to);
  }

  function borrar(id: string) {
    dismissNotification(email, id);
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
  }

  function borrarTodo() {
    dismissAll(email);
    setAvisos([]);
  }

  const cuantos = sinVer.length;

  return (
    <div className="app-bell" ref={caja}>
      <button
        type="button"
        className={`app-header-menu app-bell-btn${open ? " open" : ""}`}
        onClick={abrir}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={cuantos === 0 ? "Avisos" : `Avisos, ${cuantos} sin leer`}
      >
        <FaBell />
        {cuantos > 0 && (
          <span className={`app-bell-count${urgente ? " urgente" : ""}`} aria-hidden="true">
            {cuantos > 9 ? "9+" : cuantos}
          </span>
        )}
      </button>

      {open && (
        <div className="app-user-menu app-bell-panel" role="menu">
          <div className="app-bell-head">
            <span className="app-user-menu-name">Avisos</span>
            {avisos.length > 0 && (
              <button type="button" className="app-bell-clear" onClick={borrarTodo}>
                Borrar todo
              </button>
            )}
          </div>

          {avisos.length === 0 ? (
            <p className="app-bell-empty">No hay novedades por el momento</p>
          ) : (
            <ul className="app-bell-list">
              {avisos.map((aviso) => {
                const Icono = ICONOS[aviso.tone];

                return (
                  <li
                    key={aviso.id}
                    className={`app-bell-item app-bell-item--${aviso.tone}${aviso.at > marca ? " nuevo" : ""}`}
                  >
                    <button
                      type="button"
                      className="app-bell-body"
                      onClick={() => tocar(aviso)}
                      disabled={!aviso.to}
                      title={aviso.to ? "Ir a verlo" : "Esto ya no se puede abrir"}
                    >
                      <span className="app-bell-icon" aria-hidden="true">
                        <Icono />
                      </span>

                      <span className="app-bell-text">
                        <span className="app-bell-title">{aviso.title}</span>
                        {aviso.body && <span className="app-bell-note">{aviso.body}</span>}
                        <span className="app-bell-when">{haceCuanto(aviso.at)}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="app-bell-drop"
                      onClick={() => borrar(aviso.id)}
                      aria-label={`Borrar el aviso ${aviso.title}`}
                    >
                      <FaTrash />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** "recién", "hace 2 h", "ayer". Sin relojes: lo que importa es qué tan reciente es. */
function haceCuanto(at: number): string {
  const minutos = Math.floor((Date.now() - at) / 60000);

  if (minutos < 2) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}
