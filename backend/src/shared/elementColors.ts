import { badRequest } from "./errors.js";

/**
 * Los colores propios de algunos elementos: la barra de arriba, el pie (con las franjas
 * oscuras de la portada) y la cabecera de los mails.
 *
 * Sin color propio, cada uno sigue al color de la marca o, sin marca, al de la estación,
 * como siempre. Los tres llevan texto claro encima, así que un color demasiado claro se
 * oscurece lo justo para que el texto se lea (ver `readableBackground`): se guarda el que
 * eligió el consultorio y se ajusta al dibujarlo.
 *
 * Es el espejo de lib/elementColors en la web.
 */

export const ELEMENT_COLOR_KEYS = ["header", "footer", "mail"] as const;
export type ElementColorKey = (typeof ELEMENT_COLOR_KEYS)[number];
export type ElementColors = Partial<Record<ElementColorKey, string>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Lo guardado, sin lo que no tenga forma de color. Leer nunca falla. */
export function elementColorsOf(stored: string | null | undefined): ElementColors {
  if (!stored) return {};
  try {
    const raw = JSON.parse(stored);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: ElementColors = {};
    for (const key of ELEMENT_COLOR_KEYS) if (typeof raw[key] === "string" && HEX.test(raw[key])) out[key] = raw[key].toLowerCase();
    return out;
  } catch {
    return {};
  }
}

/** Lo que llega de la pantalla. Nulo o vacío en un elemento es volver a seguir a la marca. */
export function parseElementColors(value: unknown): string | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Los colores llegaron con un formato que no se entiende");
  const out: ElementColors = {};
  for (const [key, color] of Object.entries(value as Record<string, unknown>)) {
    if (!(ELEMENT_COLOR_KEYS as readonly string[]).includes(key)) throw badRequest(`No hay un elemento llamado "${key}"`);
    if (color === null || color === undefined || color === "") continue;
    if (typeof color !== "string" || !HEX.test(color)) throw badRequest("Un color tiene que ser como #3b7658");
    out[key as ElementColorKey] = color.toLowerCase();
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

/** El color en tono, saturación y luz, de 0 a 360 y de 0 a 100. */
function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function toHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * El color, oscurecido si hace falta para que un texto claro encima se lea.
 *
 * `maxLight` es la luz máxima, de 0 a 100. Un color que ya es oscuro vuelve igual.
 */
export function readableBackground(hex: string, maxLight: number): string {
  const [h, s, l] = toHsl(hex);
  return l <= maxLight ? hex.toLowerCase() : toHex(h, s, maxLight);
}

/** La luz máxima de cada elemento. El pie lleva texto chico y gris, así que pide más oscuro. */
export const MAX_LIGHT: Record<ElementColorKey, number> = { header: 40, footer: 24, mail: 40 };
