import { readCookie } from "../../lib/cookies";

/** Si quien mira pidió ver el fondo. Es una preferencia del equipo, como el tema: va en una cookie. */
export const BACKDROP_COOKIE = "fondo-ingreso";

/** Si el fondo del ingreso está prendido. Se guarda al tocar el botón, así que siempre está al día. */
export function backdropOn(): boolean {
  return readCookie(BACKDROP_COOKIE) === "on";
}
