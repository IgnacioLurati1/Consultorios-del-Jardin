import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
 * Un minuto, y solo con la pestaña a la vista. Eran cinco, y cinco eran demasiados para
 * lo que se siente usando esto: se saca un turno, el aviso ya está anotado del lado del
 * consultorio, y la campanita se queda en cero un rato largo. El que probaba iba a
 * abrirla para ver si había llegado, y abrirla es justamente lo que da todo por visto,
 * así que el número no aparecía nunca.
 *
 * Sigue siendo un aviso y no un monitor: es un pedido chico, solo con alguien mirando la
 * pestaña, y abajo hay tres cosas que lo adelantan sin esperar al reloj.
 */
const CADA_MS = 60 * 1000;

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
  // Cambiar de pantalla es la señal más clara de que hay alguien usando esto, y encima es
  // lo que se hace justo después de sacar un turno.
  const { pathname } = useLocation();
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
    // Y también al volver a la pestaña. Volver de otra pestaña no siempre le devuelve el
    // foco a la ventana —volviendo desde otra aplicación sí, cambiando de pestaña no
    // siempre— así que con `focus` solo, el caso más común de "vuelvo a mirar" se
    // quedaba sin preguntar nada.
    document.addEventListener("visibilitychange", mirar);

    return () => {
      vivo = false;
      clearInterval(reloj);
      window.removeEventListener("focus", mirar);
      document.removeEventListener("visibilitychange", mirar);
    };
  }, [pathname]);

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

    /*
     * Se da por visto lo que está en la lista y nada más.
     *
     * El más nuevo de los que hay en pantalla marca hasta dónde llega la lectura. Antes se
     * daba por visto todo lo que hubiera sin leer, incluido lo que había entrado después
     * de la última consulta y todavía no se dibujaba: ese aviso quedaba leído sin haberse
     * mostrado nunca, y era el que uno estaba esperando ver. Lo que llegue después de esto
     * vuelve con la consulta siguiente, con su número.
     *
     * Lo que ya estaba en pantalla se queda igual: esconder lo recién leído sería vaciar
     * la lista en la cara de quien la está por leer. Lo único que cambia es el número y el
     * punto de la izquierda.
     *
     * En pantalla se apaga de una y no cuando contesta el servidor. Es lo que la persona
     * acaba de hacer, y esperar medio segundo para apagar un número se lee como que el
     * botón no anduvo.
     */
    const hastaAca = avisos.reduce((mayor, aviso) => Math.max(mayor, aviso.id), 0);

    setSinVer(0);
    setAvisos((actuales) => actuales.map((aviso) => ({ ...aviso, read: true })));
    void markSeen(hastaAca);
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
