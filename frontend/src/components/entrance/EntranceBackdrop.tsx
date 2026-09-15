import { useState } from "react";
import { FaDoorOpen, FaEyeSlash } from "react-icons/fa6";
import { readCookie, writeCookie } from "../../lib/cookies";
import { EntranceCanvas } from "./EntranceCanvas";
import { useDesktop } from "./useDesktop";
import "./entrance.css";

/** Si quien mira pidió ver el fondo. Es una preferencia del equipo, como el tema: va en una cookie. */
const COOKIE = "fondo-ingreso";

/**
 * El hall del consultorio de fondo, detrás de la tarjeta del ingreso y del registro. Va
 * adentro de un contenedor con la clase `entrance-host` (ver EntranceCanvas).
 *
 * Es solo para computadoras y arranca oculto: arriba a la izquierda hay un botón que invita
 * a verlo, y la elección queda guardada. Quien lo abre una vez lo encuentra abierto la
 * próxima; quien no, sigue con la página lisa y sin cargar nada de más.
 */
export function EntranceBackdrop() {
  const [enabled, setEnabled] = useState(() => readCookie(COOKIE) === "on");
  const desktop = useDesktop();

  if (!desktop) return null;

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    writeCookie(COOKIE, next ? "on" : "off");
  }

  return (
    <>
      {enabled ? <EntranceCanvas /> : null}

      {enabled ? (
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
