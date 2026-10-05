import type { Words } from "./vocabulary.ts";

/**
 * Las preguntas frecuentes y los motivos de contacto, como los arma cada consultorio.
 *
 * Es el espejo de shared/faq y shared/contactReasons del servidor. Las de siempre traen su
 * texto acá en la web (las preguntas, en pages/faq/faqQuestions) y un texto vacío quiere
 * decir "el de siempre". Las propias las escribe el consultorio enteras.
 *
 * El servidor manda la lista ya arreglada, pero esta la vuelve a mirar al leerla: un
 * servidor anterior no la manda, y entonces valen las de siempre.
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
  id: string;
  question: string;
  answer: string;
  hidden: boolean;
}

export const FAQ_LIMITS = { items: 40, question: 160, answer: 1500 } as const;

export const BUILTIN_REASONS = ["turnos", "profesional", "sugerencia", "otro"] as const;

export type BuiltinReasonKey = (typeof BUILTIN_REASONS)[number];

/** El motivo de quien quiere sumarse al equipo: pide teléfono y acepta un CV. */
export const APPLICATION: BuiltinReasonKey = "profesional";

export interface ContactReasonEntry {
  id: string;
  label: string;
  hint: string;
  hidden: boolean;
}

export const REASON_LIMITS = { items: 12, label: 60, hint: 120 } as const;

export function isBuiltinFaq(id: string): id is BuiltinFaqKey {
  return (BUILTIN_FAQ as readonly string[]).includes(id);
}

export function isBuiltinReason(id: string): id is BuiltinReasonKey {
  return (BUILTIN_REASONS as readonly string[]).includes(id);
}

export function defaultFaq(): FaqEntry[] {
  return BUILTIN_FAQ.map((id) => ({ id, question: "", answer: "", hidden: false }));
}

export function defaultReasons(): ContactReasonEntry[] {
  return BUILTIN_REASONS.map((id) => ({ id, label: "", hint: "", hidden: false }));
}

const ID = /^[a-z0-9-]{1,24}$/;

function entriesOf(input: unknown): Record<string, unknown>[] {
  return Array.isArray(input) ? input.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

/** Las preguntas que llegaron, sin las rotas, con las de siempre que falten al final. */
export function faqFrom(input: unknown): FaqEntry[] {
  if (!Array.isArray(input)) return defaultFaq();
  const seen = new Set<string>();
  const list: FaqEntry[] = [];
  for (const entry of entriesOf(input)) {
    const id = typeof entry.id === "string" ? entry.id : "";
    const question = typeof entry.question === "string" ? entry.question : "";
    const answer = typeof entry.answer === "string" ? entry.answer : "";
    if (!ID.test(id) || seen.has(id) || (!isBuiltinFaq(id) && (!question || !answer))) continue;
    seen.add(id);
    list.push({ id, question, answer, hidden: entry.hidden === true });
  }
  for (const id of BUILTIN_FAQ) if (!seen.has(id)) list.push({ id, question: "", answer: "", hidden: false });
  return list;
}

/** Los motivos que llegaron, con el mismo criterio que las preguntas. */
export function reasonsFrom(input: unknown): ContactReasonEntry[] {
  if (!Array.isArray(input)) return defaultReasons();
  const seen = new Set<string>();
  const list: ContactReasonEntry[] = [];
  for (const entry of entriesOf(input)) {
    const id = typeof entry.id === "string" ? entry.id : "";
    const label = typeof entry.label === "string" ? entry.label : "";
    if (!ID.test(id) || seen.has(id) || (!isBuiltinReason(id) && !label)) continue;
    seen.add(id);
    list.push({ id, label, hint: typeof entry.hint === "string" ? entry.hint : "", hidden: entry.hidden === true });
  }
  for (const id of BUILTIN_REASONS) if (!seen.has(id)) list.push({ id, label: "", hint: "", hidden: false });
  return list;
}

/** Una clave nueva para una pregunta o un motivo propio, que no choque con las que hay. */
export function newContentId(prefix: "p" | "m", taken: ReadonlyArray<{ id: string }>): string {
  const used = new Set(taken.map((item) => item.id));
  let id = `${prefix}${Date.now().toString(36)}`;
  while (used.has(id)) id = `${prefix}${Math.random().toString(36).slice(2, 10)}`;
  return id;
}

/** El nombre y la aclaración de siempre de cada motivo de siempre, en las palabras del rubro. */
export function builtinReason(id: BuiltinReasonKey, w: Words): { label: string; hint: string } {
  switch (id) {
    case "turnos":
      return { label: w.Turnos, hint: "Solicitudes, cambios y cancelaciones." };
    case "profesional":
      return { label: "Quiero trabajar acá", hint: `${w.Profesionales} interesad${w.os("profesional")} en sumarse ${w.al("lugar")}.` };
    case "sugerencia":
      return { label: "Sugerencia", hint: "Propuestas de mejora." };
    default:
      return { label: "Otra consulta", hint: "Otros temas." };
  }
}

/** Los motivos a la vista, con su nombre y su aclaración ya resueltos. */
export function visibleReasons(list: ContactReasonEntry[], w: Words): { id: string; label: string; hint: string }[] {
  return list
    .filter((entry) => !entry.hidden)
    .map((entry) => {
      const base = isBuiltinReason(entry.id) ? builtinReason(entry.id, w) : { label: "", hint: "" };
      return { id: entry.id, label: entry.label || base.label, hint: entry.hint || base.hint };
    });
}

/**
 * Cómo se llama el motivo de quien quiere sumarse al equipo, o null si está oculto.
 *
 * Lo usan los links "Quiero trabajar acá" del menú, el pie y las preguntas: con el motivo
 * oculto, un link que lleva a un formulario sin esa opción no tiene que estar.
 */
export function applicationLabel(list: ContactReasonEntry[], w: Words): string | null {
  const entry = list.find((item) => item.id === APPLICATION);
  if (!entry || entry.hidden) return null;
  return entry.label || builtinReason(APPLICATION, w).label;
}

/**
 * Un link de WhatsApp para un número escrito como sea.
 *
 * wa.me pide el número entero con el código de país y sin nada más. Si se escribió con el
 * 0 o el 15 de antes, el link no anda, por eso el panel pide el código de país.
 */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

/** Un link para llamar, sin los espacios ni los paréntesis con que se escribió. */
export function phoneHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}
