import { useCallback, useState } from "react";
import { readCookie, writeCookie } from "../../../lib/cookies.ts";

/** Dice que la guía ya se vio en este navegador. */
export const GUIDE_COOKIE = "cdj-guia-profesional";

/**
 * Si la guía está abierta, y cómo abrirla y cerrarla.
 *
 * Arranca abierta la primera vez que se entra al panel desde este navegador. Cerrarla de
 * cualquier forma —"Listo", "Ahora no", Escape o un click afuera— la da por vista: quien
 * la cierra en el primer paso ya decidió que no la quiere, y volver a mostrársela en cada
 * entrada sería insistir. Queda el botón de ayuda para cuando haga falta.
 */
export function useProfessionalGuide() {
  const [open, setOpen] = useState(() => readCookie(GUIDE_COOKIE) !== "1");

  const openGuide = useCallback(() => setOpen(true), []);

  const closeGuide = useCallback(() => {
    setOpen(false);
    writeCookie(GUIDE_COOKIE, "1");
  }, []);

  return { open, openGuide, closeGuide };
}
