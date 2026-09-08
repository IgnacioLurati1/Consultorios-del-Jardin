import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheck, FaCircleExclamation, FaCircleInfo, FaTrash, FaTriangleExclamation } from "react-icons/fa6";
import { useAuth } from "../../context/AuthContext";
import { getDecodedToken } from "../../pages/commonServices";
import {
  dismissAll,
  dismissNotification,
  fetchNotifications,
  markSeen,
  type AppNotification,
  type NotificationTone,
} from "../../lib/notifications";
import "./notifications.css";

/**
 * Cada cuánto se vuelve a mirar si pasó algo.
 *
 * Cinco minutos, y solo con la pestaña a la vista. Es un aviso, no un monitor: enterarse
 * cinco minutos después de que un paciente pidió turno no cambia nada, y cada consulta
 * que no se hace es una que el servidor no atiende.
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
 * Lo que muestra lo guarda el consultorio, así que es lo mismo entrando desde donde sea y
 * está igual después de cerrar sesión y volver (ver lib/notifications).
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

  // La clave es el mail: entrando otra persona en la misma computadora, la campanita
  // arranca de cero en vez de mostrar por un instante los avisos de la anterior.
  return <Campana key={decoded.email} />;
}

function Campana() {
  const navigate = useNavigate();
  const [avisos, setAvisos] = useState<AppNotification[]>([]);
  const [sinVer, setSinVer] = useState(0);
  const [open, setOpen] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  const urgente = avisos.some((aviso) => !aviso.read && aviso.tone === "urgent");

  useEffect(() => {
    let vivo = true;

    function mirar() {
      // Con la pestaña de fondo no se pregunta nada: nadie está mirando la campana.
      if (document.hidden) return;

      fetchNotifications().then(({ lista, sinVer: cuantos }) => {
        if (!vivo) return;
        setAvisos(lista);
        setSinVer(cuantos);
      });
    }

    mirar();
    const reloj = setInterval(mirar, CADA_MS);
    window.addEventListener("focus", mirar);

    return () => {
      vivo = false;
      clearInterval(reloj);
      window.removeEventListener("focus", mirar);
    };
  }, []);

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
    //
    // En pantalla se apaga de una y no cuando contesta el servidor. Es lo que la persona
    // acaba de hacer, y esperar medio segundo para apagar un número se lee como que el
    // botón no anduvo.
    setSinVer(0);
    setAvisos((actuales) => actuales.map((aviso) => ({ ...aviso, read: true })));
    void markSeen();
  }

  function tocar(aviso: AppNotification) {
    setOpen(false);
    if (aviso.to) navigate(aviso.to);
  }

  function borrar(id: number) {
    setAvisos((actuales) => actuales.filter((aviso) => aviso.id !== id));
    void dismissNotification(id);
  }

  function borrarTodo() {
    setAvisos([]);
    setSinVer(0);
    void dismissAll();
  }

  return (
    <div className="app-bell" ref={caja}>
      <button
        type="button"
        className={`app-header-menu app-bell-btn${open ? " open" : ""}`}
        onClick={abrir}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={sinVer === 0 ? "Avisos" : `Avisos, ${sinVer} sin leer`}
      >
        <FaBell />
        {sinVer > 0 && (
          <span className={`app-bell-count${urgente ? " urgente" : ""}`} aria-hidden="true">
            {sinVer > 9 ? "9+" : sinVer}
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
                const Icono = ICONOS[aviso.tone] ?? FaCircleInfo;

                return (
                  <li key={aviso.id} className={`app-bell-item app-bell-item--${aviso.tone}${aviso.read ? "" : " nuevo"}`}>
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
export function haceCuanto(at: number): string {
  const minutos = Math.floor((Date.now() - at) / 60000);

  if (minutos < 2) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}
