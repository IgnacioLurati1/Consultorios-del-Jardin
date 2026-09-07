/**
 * Lo mínimo que necesitan los atajos de teclado: cuál es la tecla modificadora en esta
 * máquina y cuándo hay que dejar el teclado en paz.
 *
 * Vive suelto de quien escucha las teclas porque el panel que los explica necesita las
 * mismas respuestas: si acá el modificador es ⌘, el cartel tiene que decir ⌘ y no Ctrl.
 */

const identidad = [
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "",
  navigator.platform || "",
  navigator.userAgent || "",
].join(" ");

/** Teclado de Apple: allá el modificador de los atajos es ⌘ y no Ctrl. */
export const esApple = /mac|iphone|ipad|ipod/i.test(identidad);

export const TECLA_MOD = esApple ? "⌘" : "Ctrl";
export const TECLA_ALT = esApple ? "⌥" : "Alt";

/**
 * Si el evento trae apretada la modificadora de esta máquina, y solo esa.
 *
 * Se exige que la otra no esté para no pisar combinaciones del navegador: Ctrl+⌘+algo en
 * Mac, o Ctrl+Shift+P, que es donde vive la consola.
 */
export function conModificador(event: KeyboardEvent): boolean {
  if (event.shiftKey) return false;
  return esApple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/**
 * Qué letra se apretó, mirando la tecla física antes que el carácter.
 *
 * Con Alt apretada en una Mac la tecla T no escribe una "t" sino un "†", así que
 * preguntarle a `key` qué letra es devuelve cualquier cosa. `code` dice qué tecla se
 * hundió, sin importar el idioma del teclado ni qué haya apretado la persona junto con
 * ella; `key` queda de respaldo para los teclados que no reportan `code`.
 */
export function esLetra(event: KeyboardEvent, letra: string): boolean {
  return event.code === `Key${letra.toUpperCase()}` || event.key.toLowerCase() === letra;
}

/**
 * Si el foco está adentro de algo donde se escribe.
 *
 * Es la condición para no hacer nada: Ctrl+Z adentro de las observaciones de un turno
 * tiene que deshacer lo que se tipeó, que es lo que el navegador ya hace bien, y no
 * revertir el último turno que se tocó.
 */
export function escribiendo(target: EventTarget | null): boolean {
  const elemento = target as HTMLElement | null;
  if (!elemento?.tagName) return false;

  const etiqueta = elemento.tagName.toLowerCase();
  return etiqueta === "input" || etiqueta === "textarea" || etiqueta === "select" || elemento.isContentEditable;
}
