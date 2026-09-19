import { FaMusic } from "react-icons/fa6";
import { CAMERA_NAMES, NIGHTS, type NightState } from "./nightLevels";

const HOURS = ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM"];

/**
 * Lo que se ve encima de la noche de terror: la hora, la mira, las cámaras con su estática,
 * el tiempo de la muñeca, el golpe del susto y los carteles del final. La escena manda el
 * estado (ver nightGame) y esto solo lo dibuja; lo que se aprieta acá vuelve a la escena
 * por `onCommand`.
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
  onCommand: (name: "cam" | "close", value?: number) => void;
  onRetry: () => void;
  onNext: () => void;
  onMenu: () => void;
}) {
  const phase = state?.phase ?? "intro";
  const over = phase === "dead" || phase === "won";
  const doll = state?.doll ?? null;
  const dollShare = doll === null ? 0 : (doll / (state?.dollMax ?? 30)) * 100;
  const night = state?.night ?? 0;
  const last = night === NIGHTS.length - 1;
  // La cajita se está por acabar: una nota que late en la esquina, con o sin cámaras.
  const dollWarning = phase === "play" && doll !== null && doll <= 10;

  return (
    <div className={`night-hud ${state?.cams ? "is-cams" : ""} ${NIGHTS[night]?.blood ? "is-blood" : ""}`}>
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

      {phase === "play" && !state?.cams && (
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

      {phase === "intro" && (
        <div className="night-intro">
          <strong>12 AM</strong>
          <span>Noche {night + 1}</span>
        </div>
      )}

      {phase === "scare" && <div className="night-scare" aria-hidden="true" />}

      {over && (
        <div className={`night-end ${phase === "won" ? "is-won" : ""}`}>
          <strong>{phase === "won" ? "6 AM" : "Te atraparon"}</strong>
          <span>
            {phase === "won" ? (last ? "Sobreviviste las cinco noches" : `Noche ${night + 1} superada`) : `Llegaste a las ${HOURS[state?.hour ?? 0]}`}
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

/**
 * El menú de la noche de terror: las cinco noches, de la más tranquila a la última. Todas
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
            <button key={night.name} type="button" className={night.blood ? "is-blood" : ""} onClick={() => onPick(index)}>
              <b>{index + 1}</b>
              <span>{night.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
