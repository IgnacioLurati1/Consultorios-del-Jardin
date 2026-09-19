import { useRef, useState } from "react";
import { FaArrowLeft, FaDoorOpen, FaEyeSlash } from "react-icons/fa6";
import { writeCookie } from "../../lib/cookies";
import { EntranceCanvas } from "./EntranceCanvas";
import { BACKDROP_COOKIE, backdropOn } from "./backdropCookie";
import type { Entrance } from "./entranceScene";
import type { NightState } from "./nightLevels";
import { NightHud, NightMenu } from "./NightHud";
import { useDesktop } from "./useDesktop";
import "./entrance.css";

/**
 * El hall del consultorio de fondo, detrás de la tarjeta del ingreso y del registro. Va
 * adentro de un contenedor con la clase `entrance-host` (ver EntranceCanvas).
 *
 * Es solo para computadoras y arranca oculto: arriba a la izquierda hay un botón que invita
 * a verlo, y la elección queda guardada. Quien lo abre una vez lo encuentra abierto la
 * próxima; quien no, sigue con la página lisa y sin cargar nada de más.
 *
 * Dos modos escondidos, que prende el ingreso:
 * - `walk`: el fondo se vuelve un paseo, con la mira al medio y las teclas abajo.
 * - `night`: la noche de terror, otra escena con su propia pantalla encima (ver nightGame).
 *   Arranca en el menú de las noches; desde una noche, volver es volver al menú.
 * En los dos, en lugar del botón del fondo hay uno para volver al ingreso (`onLeave`).
 */
export function EntranceBackdrop({ mode, onLeave }: { mode?: "walk" | "night"; onLeave?: () => void }) {
  const [enabled, setEnabled] = useState(backdropOn);
  const [aim, setAim] = useState<string | null>(null);
  const [night, setNight] = useState<NightState | null>(null);
  // Qué noche se juega; null es el menú para elegirla.
  const [level, setLevel] = useState<number | null>(null);
  // Reintentar arma la noche de cero: un lienzo nuevo, con todo en su lugar.
  const [run, setRun] = useState(0);
  const commandRef = useRef<Entrance["nightCommand"] | null>(null);
  const desktop = useDesktop();

  if (!desktop) return null;

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    writeCookie(BACKDROP_COOKIE, next ? "on" : "off");
  }

  const walking = mode === "walk" && enabled;
  const horror = mode === "night" && enabled;

  function play(next: number | null) {
    setNight(null);
    setLevel(next);
    setRun((n) => n + 1);
  }

  if (horror && level === null) {
    return (
      <>
        <NightMenu onPick={play} />
        <button type="button" className="entrance-toggle walk-leave" onClick={onLeave}>
          <FaArrowLeft aria-hidden="true" />
          Volver
        </button>
      </>
    );
  }

  if (horror && level !== null) {
    return (
      <>
        <EntranceCanvas
          key={`night-${level}-${run}`}
          walk
          horror
          nightLevel={level}
          onAim={setAim}
          onNight={setNight}
          commandRef={commandRef}
        />
        <NightHud
          state={night}
          aim={aim}
          onCommand={(name, value) => commandRef.current?.(name, value)}
          onRetry={() => play(level)}
          onNext={() => play(level + 1)}
          onMenu={() => play(null)}
        />
        {night?.phase !== "dead" && night?.phase !== "won" && (
          <button type="button" className="entrance-toggle walk-leave" onClick={() => play(null)}>
            <FaArrowLeft aria-hidden="true" />
            Volver
          </button>
        )}
      </>
    );
  }

  return (
    <>
      {enabled ? <EntranceCanvas walk={walking} onAim={setAim} /> : null}

      {walking ? (
        <>
          <button type="button" className="entrance-toggle walk-leave" onClick={onLeave}>
            <FaArrowLeft aria-hidden="true" />
            Volver
          </button>
          <span className={`walk-aim ${aim !== null ? "is-on" : ""}`} aria-hidden="true" />
          <p className="walk-hint">
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
      ) : enabled ? (
        <button type="button" className="entrance-toggle" onClick={toggle}>
          <FaEyeSlash aria-hidden="true" />
          Ocultar fondo
        </button>
      ) : (
        <button type="button" className="entrance-toggle is-invite" onClick={toggle}>
          <FaDoorOpen aria-hidden="true" />
          ¿Querés ver nuestro espacio común?
        </button>
      )}
    </>
  );
}
