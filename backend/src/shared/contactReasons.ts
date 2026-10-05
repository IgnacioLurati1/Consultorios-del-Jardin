import { badRequest } from "./errors.js";
import type { Words } from "./vocabulary.js";

/**
 * Los motivos del formulario de contacto, como los arma cada consultorio.
 *
 * Los de siempre (`BUILTIN_REASONS`) se pueden renombrar, ocultar y mover; un texto vacío es
 * el de siempre, con las palabras del rubro. El de quien quiere sumarse al equipo
 * (`APPLICATION`) pide teléfono y acepta un CV, y eso no cambia aunque se renombre. Los
 * propios los escribe el consultorio.
 *
 * La lista sigue siendo cerrada: el asunto del mail se arma con el nombre del motivo, y el
 * servidor solo acepta uno de los que la web muestra.
 *
 * Guardada como nula es la lista de siempre. Así Consultorios del Jardín no guarda nada.
 */

export const BUILTIN_REASONS = ["turnos", "profesional", "sugerencia", "otro"] as const;

export type BuiltinReasonKey = (typeof BUILTIN_REASONS)[number];

/** El motivo de quien quiere sumarse como profesional. Es el único que pide teléfono y acepta CV. */
export const APPLICATION: BuiltinReasonKey = "profesional";

export interface ContactReasonEntry {
  id: string;
  /** Vacío en uno de los de siempre: el nombre de siempre. */
  label: string;
  /** La aclaración de abajo. Vacía en uno de los de siempre: la de siempre. */
  hint: string;
  hidden: boolean;
}

export const REASON_LIMITS = { items: 12, label: 60, hint: 120 } as const;

const CUSTOM_ID = /^[a-z0-9-]{1,24}$/;

export function isBuiltinReason(id: string): id is BuiltinReasonKey {
  return (BUILTIN_REASONS as readonly string[]).includes(id);
}

export function defaultReasons(): ContactReasonEntry[] {
  return BUILTIN_REASONS.map((id) => ({ id, label: "", hint: "", hidden: false }));
}

/** Los motivos guardados, listos para usar. Leer nunca falla. Mismo criterio que `faqOf`. */
export function reasonsOf(stored: string | null | undefined): ContactReasonEntry[] {
  if (!stored) return defaultReasons();

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return defaultReasons();
  }
  if (!Array.isArray(raw)) return defaultReasons();

  const seen = new Set<string>();
  const list: ContactReasonEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!CUSTOM_ID.test(id) || seen.has(id)) continue;
    const label = typeof entry.label === "string" ? entry.label : "";
    if (!isBuiltinReason(id) && !label) continue;
    seen.add(id);
    list.push({ id, label, hint: typeof entry.hint === "string" ? entry.hint : "", hidden: entry.hidden === true });
  }

  for (const id of BUILTIN_REASONS) if (!seen.has(id)) list.push({ id, label: "", hint: "", hidden: false });
  return list;
}

/** Una lista que llega de la pantalla, validada. Nula si quedó igual a la de siempre. */
export function parseReasons(value: unknown): string | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw badRequest("Los motivos llegaron con un formato que no se entiende");
  if (value.length > REASON_LIMITS.items) throw badRequest(`Entran hasta ${REASON_LIMITS.items} motivos`);

  const seen = new Set<string>();
  const list: ContactReasonEntry[] = value.map((item) => {
    if (!item || typeof item !== "object") throw badRequest("Los motivos llegaron con un formato que no se entiende");
    const entry = item as Record<string, unknown>;
    const id = String(entry.id ?? "");
    if (!CUSTOM_ID.test(id) || seen.has(id)) throw badRequest("Los motivos llegaron con un formato que no se entiende");
    seen.add(id);

    const label = String(entry.label ?? "").trim();
    const hint = String(entry.hint ?? "").trim();
    if (label.length > REASON_LIMITS.label) throw badRequest(`Un motivo no puede pasar de ${REASON_LIMITS.label} caracteres`);
    if (hint.length > REASON_LIMITS.hint) throw badRequest(`Una aclaración no puede pasar de ${REASON_LIMITS.hint} caracteres`);
    if (!isBuiltinReason(id) && label.length < 2) throw badRequest("Falta el nombre de un motivo");

    return { id, label, hint, hidden: entry.hidden === true };
  });

  if (BUILTIN_REASONS.some((id) => !seen.has(id))) throw badRequest("Los motivos de siempre no se borran, se ocultan");
  if (!list.some((entry) => !entry.hidden)) throw badRequest("Tiene que quedar al menos un motivo a la vista");

  const same = JSON.stringify(list) === JSON.stringify(defaultReasons());
  return same ? null : JSON.stringify(list);
}

/** El nombre de siempre de cada motivo de siempre, en las palabras del rubro. */
function builtinLabel(id: BuiltinReasonKey, w: Words): string {
  switch (id) {
    case "turnos":
      return w.Turnos;
    case "profesional":
      return `Quiero trabajar en ${w.el("lugar")}`;
    case "sugerencia":
      return "Sugerencia";
    default:
      return "Otra consulta";
  }
}

/** Cómo se llama un motivo, para el asunto y el cuerpo del mail. */
export function reasonLabel(id: string, list: ContactReasonEntry[], w: Words): string {
  const entry = list.find((item) => item.id === id);
  if (entry?.label) return entry.label;
  return isBuiltinReason(id) ? builtinLabel(id, w) : "Otra consulta";
}
