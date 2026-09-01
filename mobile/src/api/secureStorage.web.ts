/**
 * La versión para el navegador, que Metro elige sola cuando la app corre con
 * `npm run web`.
 *
 * En el navegador no hay llavero del sistema, así que esto guarda en localStorage: es
 * menos seguro y por eso el navegador no es un destino de la app. Está para poder mirar
 * las pantallas desde una computadora mientras se trabaja, sin tener el teléfono a mano.
 */
function available(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Modo incógnito con el almacenamiento bloqueado.
    return null;
  }
}

export const secureStorage = {
  get: async (key: string) => available()?.getItem(key) ?? null,
  set: async (key: string, value: string) => {
    available()?.setItem(key, value);
  },
  remove: async (key: string) => {
    available()?.removeItem(key);
  },
};
