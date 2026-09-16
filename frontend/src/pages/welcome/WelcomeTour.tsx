import { useEffect, useState } from "react";
import type { IconType } from "react-icons";
// Los mismos íconos que usan las tarjetas del panel, de donde salgan.
import { FaCalendarAlt, FaClipboardList, FaUserInjured } from "react-icons/fa";
import { FaArrowRight, FaChartColumn, FaMoon } from "react-icons/fa6";
import logoClaro from "../../assets/LogoRecortadoOscuro.png";

/** Cuánto tarda el negro en tapar todo. Tiene que coincidir con la entrada en welcome.css. */
export const COVERED_MS = 1250;

/** Lo que tarda el saludo en irse cuando toca "Comenzar". También está en el CSS. */
const LEAVING_MS = 700;

/** Un caracter cada tanto: escrito de un saque no parece alguien hablando. */
const TYPING_MS = 22;

interface Beat {
  icon?: IconType;
  title?: string;
  /** Lo que dice la tarjeta de abajo, igual que en el panel. */
  description?: string;
  /** Lo que dice el asistente arriba. */
  say: string;
}

/**
 * Lo que cuenta el asistente, en el orden en que conviene escucharlo.
 *
 * Los cuatro primeros son las cuatro tarjetas del panel, con el mismo ícono, el mismo
 * nombre y la misma descripción: la idea es que cuando entre las reconozca. El quinto no
 * es del panel pero es lo primero que se toca sin querer, así que mejor contarlo. El
 * último no muestra nada: es la despedida.
 */
const TOUR: Beat[] = [
  {
    icon: FaClipboardList,
    title: "Turnos",
    description: "Agenda de turnos en grilla o en lista, con su estado y su paciente.",
    say: "Arranquemos por los turnos. Ahí tenés tu agenda completa, y los pedidos que llegan los aceptás o los rechazás vos.",
  },
  {
    icon: FaCalendarAlt,
    title: "Horarios",
    description: "Agenda semanal y duración de los turnos de cada módulo.",
    say: "Lo que cargues en horarios es lo que se puede pedir. El día que no atendés, no aparece.",
  },
  {
    icon: FaUserInjured,
    title: "Pacientes",
    description: "Pacientes con cuenta y sin cuenta.",
    say: "Cada paciente tiene su ficha, con su historial y tus observaciones. A los que todavía no tienen cuenta los cargás vos.",
  },
  {
    icon: FaChartColumn,
    title: "Números",
    description: "Facturación, pacientes y carga de la agenda, mes a mes.",
    say: "Y acá ves cómo viene el mes, sin sacar una sola cuenta a mano.",
  },
  {
    icon: FaMoon,
    title: "Tema y temporada",
    description: "Arriba a la derecha, al lado del engranaje.",
    say: "Una cosita más: la pantalla se pone clara u oscura, y el jardín cambia con la temporada. Eso lo elegís vos, arriba a la derecha.",
  },
  {
    say: "Si me necesitás, abajo a la derecha podés preguntarme cualquier duda.",
  },
];

type Phase = "hello" | "leaving" | "tour";

/** Si quien mira pidió que no se mueva nada. */
function quieto(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * El texto apareciendo de a un caracter, como si lo estuviera escribiendo.
 *
 * Con "reducir movimiento" aparece entero: la gracia es que parezca alguien hablando, no
 * que haya que esperar.
 */
function useTyped(text: string, on: boolean): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!on) return;

    if (quieto()) {
      setShown(text);
      return;
    }

    setShown("");
    let cuantos = 0;
    const id = window.setInterval(() => {
      cuantos += 1;
      setShown(text.slice(0, cuantos));
      if (cuantos >= text.length) window.clearInterval(id);
    }, TYPING_MS);

    return () => window.clearInterval(id);
  }, [text, on]);

  return shown;
}

/**
 * La bienvenida sobre negro y la recorrida del asistente.
 *
 * Tapa la pantalla entera, la barra de arriba incluida: el negro es lo que hace que esto
 * se lea como una sala a oscuras y no como un cartel más de la página. Es también lo que
 * esconde el cambio de pantalla, que pasa detrás mientras el negro entra.
 *
 * Primero saluda y espera. Recién cuando la persona toca "Comenzar" aparece el asistente
 * —el mismo que después va a estar abajo a la derecha— y cuenta las cuatro cosas del
 * panel, una por vez. El último paso lleva al panel.
 */
export function WelcomeTour({ name, onFinish }: { name: string; onFinish: () => void }) {
  const [phase, setPhase] = useState<Phase>("hello");
  const [beat, setBeat] = useState(0);

  function comenzar() {
    setPhase("leaving");
    window.setTimeout(() => setPhase("tour"), quieto() ? 0 : LEAVING_MS);
  }

  // Las flechas pasan los pasos, como en la guía del panel.
  useEffect(() => {
    if (phase !== "tour") return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setBeat((value) => Math.min(value + 1, TOUR.length - 1));
      if (event.key === "ArrowLeft") setBeat((value) => Math.max(value - 1, 0));
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const current = TOUR[beat];
  const last = beat === TOUR.length - 1;
  // El hook va acá y no adentro del paso: adentro se llamaría solo a veces.
  const dicho = useTyped(current.say, phase === "tour");

  return (
    <div className="wl-dark">
      {phase !== "tour" ? (
        <div className={`wl-hello ${phase === "leaving" ? "is-leaving" : ""}`}>
          <img className="wl-hello-logo" src={logoClaro} alt="Consultorios del Jardín" />

          {/* role status: quien no ve la animación se entera igual de que ya está adentro. */}
          <h1 className="wl-hello-title" role="status">
            ¡Te damos la bienvenida{name ? `, ${name}` : ""}!
          </h1>

          <button type="button" className="adm-btn adm-btn-primary wl-hello-go" onClick={comenzar}>
            Comenzar
            <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="wl-tour">
          <div className="wl-say-row">
            <Asistente />

            <div className="wl-say">
              <p className="wl-say-who">Asistente</p>
              {/* El texto completo, invisible, le da el alto a la burbuja: si creciera
                  mientras se escribe, la tarjeta de abajo saltaría en cada letra. */}
              <p className="wl-say-text">
                <span className="wl-say-ghost" aria-hidden="true">
                  {current.say}
                </span>
                <span className="wl-say-real">{dicho}</span>
              </p>
            </div>
          </div>

          {current.icon && (
            <div className="wl-feature" key={current.title}>
              <span className="wl-feature-icon">
                <current.icon aria-hidden="true" />
              </span>
              <span className="wl-feature-title">{current.title}</span>
              <span className="wl-feature-desc">{current.description}</span>
            </div>
          )}

          <div className="wl-dots" role="tablist" aria-label="Pasos de la presentación">
            {TOUR.map((item, index) => (
              <button
                key={item.say}
                type="button"
                role="tab"
                className={`wl-dot ${index === beat ? "is-active" : ""}`}
                aria-selected={index === beat}
                aria-label={item.title ?? "Para terminar"}
                onClick={() => setBeat(index)}
              />
            ))}
          </div>

          <div className="wl-tour-actions">
            {beat > 0 && (
              <button type="button" className="wl-ghost-btn" onClick={() => setBeat(beat - 1)}>
                Anterior
              </button>
            )}
            <button
              type="button"
              className="adm-btn adm-btn-primary wl-go"
              onClick={() => (last ? onFinish() : setBeat(beat + 1))}
            >
              {last ? "Entrar a mi panel" : "Siguiente"}
              <FaArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * El asistente, el mismo que después vive abajo a la derecha.
 *
 * Está dibujado y no es el ícono del chat porque acá tiene que mirar, parpadear y flotar:
 * un ícono suelto no hace nada de eso, y la idea es que se presente él, no que haya un
 * dibujito al lado del texto.
 */
function Asistente() {
  return (
    <span className="wl-bot" aria-hidden="true">
      <svg viewBox="0 0 88 96">
        {/* La antena */}
        <line x1="44" y1="6" x2="44" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle className="wl-bot-spark" cx="44" cy="6" r="5" fill="currentColor" />

        {/* La cabeza */}
        <rect x="10" y="18" width="68" height="50" rx="16" fill="currentColor" />
        <rect className="wl-bot-face" x="18" y="26" width="52" height="34" rx="11" fill="#08110f" />
        <g className="wl-bot-eyes" fill="#eafff4">
          <circle cx="34" cy="43" r="4.5" />
          <circle cx="54" cy="43" r="4.5" />
        </g>
        {/* La sonrisa */}
        <path d="M36 52 q8 6 16 0" stroke="#eafff4" strokeWidth="2.4" strokeLinecap="round" fill="none" />

        {/* El cuerpo, con la luz del pecho */}
        <rect x="20" y="72" width="48" height="20" rx="9" fill="currentColor" opacity="0.85" />
        <circle className="wl-bot-chest" cx="44" cy="82" r="4" fill="#08110f" />
      </svg>
    </span>
  );
}
