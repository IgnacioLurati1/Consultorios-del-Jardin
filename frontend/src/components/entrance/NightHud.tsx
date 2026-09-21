import { useEffect, useRef } from "react";
import { FaLightbulb, FaMusic } from "react-icons/fa6";
import { CAMERA_NAMES, CLOSING_NIGHT, CLOSING_WORDS, LAST_WORDS, NIGHTS, WATCHING_NIGHT, WATCHING_WORDS, type NightState } from "./nightLevels";

const HOURS = ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM"];

/** Lo que dura la pantalla negra del final antes de volver al menú, en milisegundos. */
const LAST_DARK_MS = 3500;

/**
 * Lo que se ve encima de la noche de terror: el cartel de cómo se juega, la hora, la mira,
 * las cámaras con su estática, el tiempo de la muñeca, la luz que queda, el golpe del susto,
 * los carteles del final, el diario después de la quinta noche y lo que dice él después de
 * la séptima. La escena manda el estado (ver nightGame) y esto solo lo dibuja; lo que se
 * aprieta acá vuelve a la escena por `onCommand`.
 */
export function NightHud({
  state,
  aim,
  onCommand,
  onRetry,
  onNext,
  onMenu,
}: {
  state: NightState | null;
  aim: string | null;
  onCommand: (name: "cam" | "close" | "start", value?: number) => void;
  onRetry: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const phase = state?.phase ?? "brief";
  const over = phase === "dead" || phase === "won" || phase === "ending";
  const doll = state?.doll ?? null;
  const dollShare = doll === null ? 0 : (doll / (state?.dollMax ?? 30)) * 100;
  const night = state?.night ?? 0;
  const last = night === NIGHTS.length - 1;
  const level = NIGHTS[night];
  // La cajita se está por acabar: una nota que late en la esquina, con o sin cámaras.
  const dollWarning = phase === "play" && doll !== null && doll <= 10;
  // La luz que se lleva encima, abajo a la izquierda. Con poca, la barra late en rojo.
  const light = Math.max(0, Math.min(1, state?.light ?? 1));
  const lightLow = light <= 0.25;
  const ending = state?.ending ?? 0;
  const newspaper = phase === "won" && night === CLOSING_NIGHT;

  // Después de la última noche, la pantalla negra y de vuelta al menú, sin botones. La
  // función va en un ref: llega nueva en cada dibujo y reiniciaría la espera.
  const menuRef = useRef(onMenu);
  menuRef.current = onMenu;
  useEffect(() => {
    if (ending !== 3) return;
    const timer = window.setTimeout(() => menuRef.current(), LAST_DARK_MS);
    return () => window.clearTimeout(timer);
  }, [ending]);

  return (
    <div
      className={`night-hud ${state?.cams ? "is-cams" : ""} ${level?.blood ? "is-blood" : ""} ${level?.abandoned ? "is-abandoned" : ""}`}
      style={{ "--night-hour": state?.hour ?? 0 } as React.CSSProperties}
    >
      {!over && !state?.lightsOut && <div className="night-gloom" aria-hidden="true" />}

      {!over && (
        <div className="night-clock" aria-live="polite">
          <strong>{HOURS[state?.hour ?? 0]}</strong>
          <span>Noche {night + 1}</span>
          {dollWarning && (
            <span className="night-doll-warning" aria-label="La muñeca">
              <FaMusic aria-hidden="true" />
            </span>
          )}
        </div>
      )}

      {phase === "play" && !state?.cams && !state?.itsMe && (
        <>
          <span className={`walk-aim ${aim !== null ? "is-on" : ""}`} aria-hidden="true" />
          {aim ? <span className="night-aim-label">{aim}</span> : null}
          <p className="walk-hint night-hint">
            <span>Clic para mirar</span>
            <span>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> para caminar
            </span>
            <span>
              <kbd>E</kbd> para usar
            </span>
          </p>
        </>
      )}

      {state?.cams && (
        <div className="night-cams">
          <div className="night-static" />
          {state.cam === 1 && doll !== null && (
            <div className="night-doll">
              <FaMusic aria-hidden="true" />
              <div className="night-doll-bar">
                <span style={{ width: `${dollShare}%` }} />
              </div>
            </div>
          )}
          <div className="night-cam-name">
            <span className="night-rec" aria-hidden="true" />
            Cámara {state.cam + 1} · {CAMERA_NAMES[state.cam]}
          </div>
          <div className="night-cam-pad">
            {CAMERA_NAMES.map((name, index) => (
              <button
                key={name}
                type="button"
                className={index === state.cam ? "is-current" : ""}
                onClick={() => onCommand("cam", index)}
                title={name}
              >
                {index + 1}
                {index === 1 && doll !== null && (
                  <span className="night-cam-doll" style={{ width: `${dollShare}%` }} />
                )}
              </button>
            ))}
            <button type="button" className="night-cam-close" onClick={() => onCommand("close")}>
              Bajar
            </button>
          </div>
          <p className="night-cam-keys">
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd>
            <kbd>4</kbd> para cambiar · <kbd>E</kbd> para bajar
          </p>
        </div>
      )}

      {phase === "brief" && <NightBrief night={night} onStart={() => onCommand("start")} />}

      {phase === "intro" && (
        <div className="night-intro">
          <strong>12 AM</strong>
          <span>Noche {night + 1}</span>
        </div>
      )}

      {!over && phase !== "brief" && (
        <div className={`night-light ${lightLow ? "is-low" : ""} ${state?.filling ? "is-filling" : ""}`}>
          <FaLightbulb aria-hidden="true" />
          <div className="night-light-bar">
            <span style={{ width: `${light * 100}%` }} />
          </div>
          <b>{Math.round(light * 100)}%</b>
          {lightLow && <i>Se carga en el baño</i>}
        </div>
      )}

      {state?.lightsOut && <div className="night-out" aria-hidden="true" />}

      {phase === "scare" && <div className="night-scare" aria-hidden="true" />}

      {state?.dread && <div className="night-dread" aria-hidden="true" />}

      {state?.itsMe && (
        <div className="night-itsme" aria-hidden="true">
          <span>IT'S ME</span>
          <span>IT'S ME</span>
          <span>IT'S ME</span>
        </div>
      )}

      {ending === 1 && (
        <div className="night-words" aria-live="polite">
          {(night === WATCHING_NIGHT ? WATCHING_WORDS : LAST_WORDS).slice(0, Math.min(LAST_WORDS.length, state?.said ?? 0)).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {ending === 2 && (state?.said ?? 0) > LAST_WORDS.length && (
        <div className="night-words is-behind" aria-live="polite">
          {CLOSING_WORDS.slice(0, (state?.said ?? 0) - LAST_WORDS.length).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {ending === 3 && <div className="night-final" aria-hidden="true" />}

      {newspaper && <NightNewspaper onNext={onNext} onMenu={onMenu} />}

      {(phase === "dead" || phase === "won") && !newspaper && (
        <div className={`night-end ${phase === "won" ? "is-won" : ""}`}>
          <strong>{phase === "won" ? "6 AM" : "Te atraparon"}</strong>
          <span>
            {phase === "won" ? (last ? "Sobreviviste las siete noches" : `Noche ${night + 1} superada`) : `Llegaste a las ${HOURS[state?.hour ?? 0]}`}
          </span>
          <div className="night-end-actions">
            {phase === "won" && !last ? (
              <button type="button" onClick={onNext}>
                Noche {night + 2}
              </button>
            ) : (
              <button type="button" onClick={onRetry}>
                {phase === "won" ? "Jugar de nuevo" : "Reintentar"}
              </button>
            )}
            <button type="button" className="is-quiet" onClick={onMenu}>
              Elegir noche
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Los cuatro de siempre, con qué hacer con cada uno. Del quinto no se dice nada. */
const FOES = [
  { name: "El Doctor", where: "Consultorio naranja", color: "#d9772f", how: "Cuando abre su puerta y se asoma, hay que cerrársela enseguida." },
  { name: "La Muñeca", where: "Consultorio turquesa", color: "#2aa3a8", how: "Mirarla por la cámara le da cuerda a su cajita. Sin cuerda, sale." },
  { name: "La Mujer", where: "Consultorio verde", color: "#a6b94a", how: "Cuando sale al boquete, hay que tocar las tres plantas del alféizar, sin acercarse." },
  { name: "El Hombre árbol", where: "Jardín", color: "#8a6a4c", how: "Cuando asoma por la corrediza, hay que empujarle la cabeza. Si entra, se corta la luz." },
];

/**
 * El cartel del principio de cada noche: lo básico y cómo se frena a cada uno. El reloj no
 * corre hasta que se lo cierra.
 */
function NightBrief({ night, onStart }: { night: number; onStart: () => void }) {
  return (
    <div className="night-brief">
      <div className="night-brief-card" role="dialog" aria-labelledby="night-brief-title">
        <span className="night-brief-eyebrow">Noche {night + 1}</span>
        <strong id="night-brief-title">Cómo llegar a las 6</strong>

        <ul className="night-brief-basics">
          <li>Las cámaras se miran desde el monitor de la recepción.</li>
          <li>La luz se gasta sola. Se carga al fondo del baño, en la entrada.</li>
          <li>Si se corta la luz, se sube la palanca del tablero.</li>
        </ul>

        <div className="night-brief-foes">
          {FOES.map((foe) => (
            <div key={foe.name} className="night-brief-foe" style={{ "--foe": foe.color } as React.CSSProperties}>
              <b>{foe.name}</b>
              <span>{foe.where}</span>
              <p>{foe.how}</p>
            </div>
          ))}
        </div>

        <button type="button" className="night-brief-start" onClick={onStart} autoFocus>
          Empezar
        </button>
        <p className="night-brief-keys">
          <kbd>Enter</kbd> para empezar
        </p>
      </div>
    </div>
  );
}

/**
 * El diario de la mañana después de la quinta noche: el consultorio cerró. Cae girando, como
 * los de las películas viejas, con una musiquita de fondo que pone la escena.
 */
function NightNewspaper({ onNext, onMenu }: { onNext: () => void; onMenu: () => void }) {
  return (
    <div className="night-paper-stage">
      <article className="night-paper" aria-labelledby="night-paper-title">
        <header className="night-paper-masthead">
          <span>Edición de la mañana</span>
          <b>El Vecino</b>
          <span>Diario del barrio</span>
        </header>
        <h2 id="night-paper-title">¡Consultorios del Jardín ha cerrado!</h2>
        <p className="night-paper-deck">Un profesional misterioso ha embrujado el lugar</p>
        <div className="night-paper-body">
          <figure className="night-paper-photo">
            <div className="night-paper-picture" aria-hidden="true">
              <span className="night-paper-door" />
              <span className="night-paper-tape" />
              <span className="night-paper-tape is-crossed" />
              <span className="night-paper-eyes" />
            </div>
            <figcaption>La entrada, clausurada desde anoche</figcaption>
          </figure>
          <div className="night-paper-columns">
            <p>
              Los vecinos hablan de ruidos a toda hora, de luces que se prenden solas y de una música de cajita que nadie
              sabe de dónde sale.
            </p>
            <p>
              Nadie pudo decir quién es el profesional que atendía de noche. Su nombre no figura en ningún registro, y
              quienes aseguran haberlo visto solo recuerdan sus ojos.
            </p>
            <p>El guardia del turno noche no volvió a presentarse. El lugar queda cerrado hasta nuevo aviso.</p>
          </div>
        </div>
      </article>
      <div className="night-end-actions night-paper-actions">
        <button type="button" onClick={onNext}>
          Noche {CLOSING_NIGHT + 2}
        </button>
        <button type="button" className="is-quiet" onClick={onMenu}>
          Elegir noche
        </button>
      </div>
    </div>
  );
}

/**
 * El menú de la noche de terror: las siete noches, de la más tranquila a la última. Todas
 * se pueden elegir desde el principio.
 */
export function NightMenu({ onPick }: { onPick: (night: number) => void }) {
  return (
    <div className="night-hud">
      <div className="night-menu">
        <span className="night-menu-eyebrow">Consultorios del Jardín</span>
        <strong>Elegí la noche</strong>
        <div className="night-menu-list">
          {NIGHTS.map((night, index) => (
            <button
              key={night.name}
              type="button"
              className={night.blood ? "is-blood" : night.abandoned ? "is-abandoned" : ""}
              onClick={() => onPick(index)}
            >
              <b>{index + 1}</b>
              <span>{night.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
