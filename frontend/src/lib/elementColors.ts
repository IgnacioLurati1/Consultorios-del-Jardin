/**
 * Los colores propios de algunos elementos: la barra de arriba, el pie (con las franjas
 * oscuras de la portada) y la cabecera de los mails.
 *
 * Sin color propio, cada uno sigue al color de la marca o, sin marca, al de la estación. Los
 * tres llevan texto claro encima, así que un color demasiado claro se oscurece lo justo
 * para que el texto se lea. Es el espejo de shared/elementColors en el servidor, que hace la
 * misma cuenta para los mails.
 */

export const ELEMENT_COLOR_KEYS = ["header", "footer", "mail"] as const;
export type ElementColorKey = (typeof ELEMENT_COLOR_KEYS)[number];
export type ElementColors = Partial<Record<ElementColorKey, string>>;

/** Cómo se llama cada uno en el panel, y qué pinta. */
export const ELEMENT_COLOR_INFO: ReadonlyArray<{ key: ElementColorKey; label: string; hint: string }> = [
  { key: "header", label: "Barra de arriba", hint: "La barra con el nombre y el menú, en todas las pantallas" },
  { key: "footer", label: "Pie y franjas oscuras", hint: "El pie de la portada y las franjas oscuras de sus secciones" },
  { key: "mail", label: "Cabecera de los mails", hint: "La franja con el nombre, arriba de cada mail" },
];

/** La luz máxima de cada uno, de 0 a 100. El pie lleva texto chico y gris, así que pide más oscuro. */
export const MAX_LIGHT: Record<ElementColorKey, number> = { header: 40, footer: 24, mail: 40 };

const HEX = /^#[0-9a-f]{6}$/i;

/** Los colores que llegaron, sin lo que no tenga forma de color. */
export function elementColorsFrom(input: unknown): ElementColors {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: ElementColors = {};
  for (const key of ELEMENT_COLOR_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && HEX.test(value)) out[key] = value.toLowerCase();
  }
  return out;
}

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

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.max(0, Math.round(l))}%)`;

/** El color, oscurecido si hace falta para que un texto claro encima se lea. */
export function readableBackground(hex: string, maxLight: number): string {
  const [h, s, l] = toHsl(hex);
  return hsl(h, s, Math.min(l, maxLight));
}

/**
 * Las variables de la hoja de estilos que pisa cada color elegido.
 *
 * La barra es un degradado, así que lleva dos: el color y uno un poco más oscuro abajo. El
 * pie es `--brand-ink`, que es de donde toma su fondo `--home-ink` en la portada.
 */
export function elementColorVars(colors: ElementColors): Record<string, string> {
  const vars: Record<string, string> = {};
  if (colors.header) {
    const [h, s, l] = toHsl(colors.header);
    const top = Math.min(l, MAX_LIGHT.header);
    vars["--adm-bar-top"] = hsl(h, s, top);
    vars["--adm-bar-bottom"] = hsl(h, s, top - 9);
  }
  if (colors.footer) vars["--brand-ink"] = readableBackground(colors.footer, MAX_LIGHT.footer);
  return vars;
}

const VAR_NAMES = ["--adm-bar-top", "--adm-bar-bottom", "--brand-ink"] as const;

/** Pone los colores elegidos sobre <html>, o los saca si no hay. */
export function applyElementColors(colors: ElementColors): Record<string, string> {
  const style = document.documentElement.style;
  const vars = elementColorVars(colors);
  for (const name of VAR_NAMES) {
    if (vars[name]) style.setProperty(name, vars[name]);
    else style.removeProperty(name);
  }
  return vars;
}
