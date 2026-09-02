/**
 * Qué endpoints se vigilan y cuánto pesa tocar cada uno.
 *
 * La lista es cortísima a propósito, y se ganó a fuerza de sacar cosas. La regla para
 * entrar es exigente: tiene que ser algo que destruya, que cambie quién puede entrar, o
 * que exponga los datos de una persona concreta. Todo lo demás quedó afuera aunque sea
 * administrativo —los catálogos, las analíticas, los avisos, la configuración, la agenda
 * del día— porque son justamente las pantallas que un administrador abre veinte veces
 * por tarde, y vigilarlas obliga a subir tanto el umbral que ya no detecta nada.
 *
 * Se clasifica por método y ruta, antes de que corra el controlador. Eso significa que
 * un paciente que prueba rutas de admin queda anotado aunque le contesten 403: el 403 es
 * la prueba de que lo intentó, no el motivo para ignorarlo.
 *
 * Dos decisiones que evitan falsos positivos y conviene tener presentes al agregar algo:
 *
 * 1. Lo que apunta a la propia persona que lo pide no cuenta (`skipSelf`). Media
 *    aplicación pide la ficha del que está logueado en cada pantalla.
 * 2. Repetir la misma operación cuenta una sola vez (lo resuelve quien lleva la cuenta,
 *    ver security.service.ts). Volver tres veces a la misma pantalla es navegar.
 */

/** Cuánto pesa borrar, deshabilitar o crear cuentas: lo que no se arregla solo. */
export const CRITICAL = 3;

/** Cuánto pesa leer los datos de una persona. Lo grave no es una, es la enumeración. */
export const SENSITIVE = 1;

interface Watched {
  method: RegExp;
  /** Contra la ruta completa, ya sin el query string. */
  path: RegExp;
  label: string;
  weight: number;
  /**
   * No cuenta si la ruta apunta a la propia persona que la pide.
   *
   * Hay rutas que sirven para dos cosas muy distintas según a quién nombren: pedir la
   * ficha de otro es mirar datos ajenos, y pedir la propia es lo que hace el encabezado
   * de la página en cada pantalla que se abre. Sin esta distinción, usar la aplicación
   * un rato alcanza para caerse solo.
   */
  skipSelf?: boolean;
}

/**
 * Un email siempre lleva arroba, así que el patrón la exige.
 *
 * No es un detalle: sin eso, `/api/people/NoAdmin` y `/api/people/changePassword` entran
 * como si el segmento fuera una persona y se cuentan con el peso equivocado.
 */
const EMAIL = "[^/]*(?:@|%40)[^/]*";

const WATCHED: Watched[] = [
  // ---------- lo que destruye o cambia quién entra ----------
  { method: /^DELETE$/, path: new RegExp(`^/api/people/${EMAIL}$`), label: "Borrar una cuenta", weight: CRITICAL },
  {
    method: /^PATCH$/,
    path: new RegExp(`^/api/people/${EMAIL}/toggleState$`),
    label: "Habilitar o deshabilitar una cuenta",
    weight: CRITICAL,
  },
  { method: /^POST$/, path: /^\/api\/people\/professional$/, label: "Dar de alta un profesional", weight: CRITICAL },
  {
    method: /^(PUT|PATCH)$/,
    path: new RegExp(`^/api/people/${EMAIL}$`),
    label: "Editar los datos de otra persona",
    weight: CRITICAL,
    skipSelf: true,
  },
  { method: /^DELETE$/, path: /^\/api\/appointments\/\d+$/, label: "Borrar un turno", weight: CRITICAL },
  {
    method: /^DELETE$/,
    path: new RegExp(`^/api/settings/patients/${EMAIL}/appointments$`),
    label: "Borrar todos los turnos de un paciente",
    weight: CRITICAL,
  },

  // ---------- lo que expone a las personas ----------
  { method: /^GET$/, path: /^\/api\/people\/?$/, label: "Bajar el padrón completo", weight: SENSITIVE },
  { method: /^GET$/, path: /^\/api\/people\/NoAdmin$/, label: "Bajar el padrón completo", weight: SENSITIVE },
  { method: /^GET$/, path: /^\/api\/people\/type\/[^/]+$/, label: "Bajar el padrón de un tipo de usuario", weight: SENSITIVE },
  {
    method: /^GET$/,
    path: /^\/api\/appointments\/medical-history\/[^/]+$/,
    label: "Ver la historia clínica de un paciente",
    weight: SENSITIVE,
  },
  {
    method: /^GET$/,
    path: new RegExp(`^/api/people/${EMAIL}$`),
    label: "Ver la ficha de otra persona",
    weight: SENSITIVE,
    skipSelf: true,
  },
];

export interface WatchedAction {
  label: string;
  weight: number;
}

/** El email al que apunta la ruta, si hay alguno. Viene percent-encoded desde el front. */
function targetOf(path: string): string | null {
  for (const raw of path.split("/")) {
    if (!raw) continue;

    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // Un percent-encoding roto no es un email; se mira el segmento como vino.
    }

    if (decoded.includes("@")) return decoded.toLowerCase();
  }

  return null;
}

/**
 * Si la request toca algo vigilado, cuánto pesa y cómo se llama. Si no, `null`.
 *
 * Gana la primera regla que coincide, así que el orden de la lista importa: las más
 * específicas van antes. `/people/:email/toggleState` tiene que resolverse antes que
 * `/people/:email`, que si no se lleva todo por delante con el peso equivocado.
 */
export function classify(method: string, path: string, actorEmail?: string): WatchedAction | null {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";

  for (const rule of WATCHED) {
    if (!rule.method.test(method) || !rule.path.test(clean)) continue;

    if (rule.skipSelf && actorEmail && targetOf(clean) === actorEmail.toLowerCase()) return null;

    return { label: rule.label, weight: rule.weight };
  }

  return null;
}
