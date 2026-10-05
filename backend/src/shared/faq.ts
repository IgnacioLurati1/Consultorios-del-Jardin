import { badRequest } from "./errors.js";

/**
 * Las preguntas frecuentes de la web, como las arma cada consultorio.
 *
 * Hay dos clases de pregunta. Las de siempre (las de `BUILTIN_FAQ`) traen su texto en la web
 * y lo arman con los datos del consultorio: la dirección, las especialidades, las reglas de
 * turnos. Se pueden ocultar, mover o reescribir; un texto vacío quiere decir "el de siempre",
 * así siguen el día que cambie la dirección o una regla. Las propias las escribe el
 * consultorio enteras y son texto fijo.
 *
 * Guardada como nula es la lista de siempre, en el orden de siempre. Así Consultorios del
 * Jardín no guarda nada y una pregunta de siempre que se sume más adelante le aparece sola.
 */

export const BUILTIN_FAQ = [
  "donde",
  "especialidades",
  "responsable",
  "costo",
  "solicitar",
  "cancelar",
  "elegir",
  "indicaciones",
  "datos",
  "sumarse",
] as const;

export type BuiltinFaqKey = (typeof BUILTIN_FAQ)[number];

export interface FaqEntry {
  /** Una de las de siempre, o la clave de una propia. */
  id: string;
  /** Vacía en una de las de siempre: la pregunta de siempre. */
  question: string;
  /** Vacía en una de las de siempre: la respuesta de siempre, armada con los datos. */
  answer: string;
  hidden: boolean;
}

export const FAQ_LIMITS = { items: 40, question: 160, answer: 1500 } as const;

const CUSTOM_ID = /^[a-z0-9-]{1,24}$/;

export function isBuiltinFaq(id: string): id is BuiltinFaqKey {
  return (BUILTIN_FAQ as readonly string[]).includes(id);
}

export function defaultFaq(): FaqEntry[] {
  return BUILTIN_FAQ.map((id) => ({ id, question: "", answer: "", hidden: false }));
}

/**
 * Las preguntas guardadas, listas para usar. Leer nunca falla.
 *
 * Una entrada rota se saltea, y una de las de siempre que no esté guardada (porque se sumó
 * después de que el consultorio armó su lista) va al final, visible.
 */
export function faqOf(stored: string | null | undefined): FaqEntry[] {
  if (!stored) return defaultFaq();

  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return defaultFaq();
  }
  if (!Array.isArray(raw)) return defaultFaq();

  const seen = new Set<string>();
  const list: FaqEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!CUSTOM_ID.test(id) || seen.has(id)) continue;
    const question = typeof entry.question === "string" ? entry.question : "";
    const answer = typeof entry.answer === "string" ? entry.answer : "";
    if (!isBuiltinFaq(id) && (!question || !answer)) continue;
    seen.add(id);
    list.push({ id, question, answer, hidden: entry.hidden === true });
  }

  for (const id of BUILTIN_FAQ) if (!seen.has(id)) list.push({ id, question: "", answer: "", hidden: false });
  return list;
}

/**
 * Una lista que llega de la pantalla, validada. Devuelve lo que se guarda: nulo si quedó
 * igual a la de siempre.
 *
 * Una de las de siempre no se puede borrar, solo ocultar: si se borrara, `faqOf` la volvería
 * a poner al final, y el consultorio la vería aparecer sin entender por qué.
 */
export function parseFaq(value: unknown): string | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw badRequest("Las preguntas llegaron con un formato que no se entiende");
  if (value.length > FAQ_LIMITS.items) throw badRequest(`Entran hasta ${FAQ_LIMITS.items} preguntas`);

  const seen = new Set<string>();
  const list: FaqEntry[] = value.map((item) => {
    if (!item || typeof item !== "object") throw badRequest("Las preguntas llegaron con un formato que no se entiende");
    const entry = item as Record<string, unknown>;
    const id = String(entry.id ?? "");
    if (!CUSTOM_ID.test(id) || seen.has(id)) throw badRequest("Las preguntas llegaron con un formato que no se entiende");
    seen.add(id);

    const question = String(entry.question ?? "").trim();
    const answer = String(entry.answer ?? "").trim();
    if (question.length > FAQ_LIMITS.question) throw badRequest(`Una pregunta no puede pasar de ${FAQ_LIMITS.question} caracteres`);
    if (answer.length > FAQ_LIMITS.answer) throw badRequest(`Una respuesta no puede pasar de ${FAQ_LIMITS.answer} caracteres`);
    if (!isBuiltinFaq(id) && question.length < 3) throw badRequest("Falta escribir una pregunta");
    if (!isBuiltinFaq(id) && answer.length < 3) throw badRequest(`Falta la respuesta de "${question}"`);

    return { id, question, answer, hidden: entry.hidden === true };
  });

  const missing = BUILTIN_FAQ.find((id) => !seen.has(id));
  if (missing) throw badRequest("Las preguntas de siempre no se borran, se ocultan");

  const same = JSON.stringify(list) === JSON.stringify(defaultFaq());
  return same ? null : JSON.stringify(list);
}
