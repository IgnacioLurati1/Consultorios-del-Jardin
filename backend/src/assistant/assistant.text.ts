/**
 * Lo que el modelo escribe, antes de mostrarlo.
 *
 * El asistente contesta en texto libre, y a veces ese texto trae cosas que no son para
 * nadie: los separadores internos con los que razona, o una llamada a herramienta que
 * escribió en el mensaje en vez de pedirla. Acá se limpia y, cuando se puede, se rescata
 * lo que quiso hacer.
 *
 * Está aparte del servicio porque es lo único del circuito que se puede probar sin un
 * modelo del otro lado: entra una cadena, sale una cadena.
 */

import { findPage, type Role } from "./assistant.catalog.js";

/** Un botón que el asistente le ofrece a la persona para ir a una pantalla. */
export interface AssistantLink {
  label: string;
  path: string;
}

/**
 * Saca del texto los restos de llamadas a herramientas.
 *
 * gpt-oss a veces, en vez de pedir la herramienta, escribe algo que se le parece en el
 * medio de la respuesta: un `<button open_page ...>`, o los separadores internos del
 * formato con el que razona. Eso no lo tiene que ver nadie. La herramienta no se ejecuta
 * igual, así que además de limpiarlo hay que asegurarse de que quede una frase en pie.
 */
export function cleanReply(text: string): string {
  return text
    .replace(/<\|[^|]*\|>/g, "")
    .replace(/<\/?(button|tool|function|call|open_page)[^>]*>/gi, "")
    // La otra forma en que se le escapa una herramienta: el renglón suelto
    // `open_page { "page": "contacto" }` en medio de la respuesta. Los dos puntos y el
    // igual están porque también la escribe como `open_page: {page: "usuarios"}`.
    .replace(/^\s*(get|open|book|cancel|accept|reject|confirm)_[a-z_]*\s*[:=]?\s*[({][^\n]*$/gim, "")
    .replace(/^\s*\[[^\]\n]{1,40}\]\s*$/gm, "")
    // La ventana del chat muestra texto pelado: el markdown se vería crudo.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rescata el botón de una pantalla que el modelo escribió en vez de pedir.
 *
 * Cuando se le escapa `open_page: {page: "usuarios"}` en medio del texto, la herramienta
 * no se ejecutó: no hay botón, y lo que llega es una frase que termina en jerga. Borrarlo
 * y listo dejaba a la persona con "abrí la pantalla de usuarios" y nada que tocar, que es
 * medio arreglo.
 *
 * Así que se lee qué quiso abrir y el botón se arma desde acá. La pantalla pasa igual por
 * findPage con el rol de quien pregunta: que el modelo la haya nombrado no la habilita, y
 * una que no le corresponde se cae acá como se caería si la hubiera pedido bien.
 *
 * Se borra desde `open_page` hasta el final del renglón. Lo que venía antes es la frase, y
 * esa se queda.
 */
export function rescueLeakedPages(text: string, role: Role, links: AssistantLink[]): string {
  return text.replace(/open_page[^\n]*/gi, (fragment) => {
    const key =
      fragment.match(/["']?page["']?\s*[:=]\s*["']?([a-z_-]+)/i)?.[1] ??
      fragment.match(/^open_page\s*[:=]\s*["']?([a-z_-]+)/i)?.[1];

    const page = key ? findPage(key, role) : null;
    if (page && !links.some((link) => link.path === page.path)) links.push({ label: page.label, path: page.path });

    return "";
  });
}

/**
 * Saca el renglón que solo repite el nombre de un botón.
 *
 * Al modelo le sale escribir "Escribirnos" abajo de todo, como si el botón lo tuviera
 * que dibujar él. El botón ya está ahí: repetirlo es una línea suelta que no dice nada.
 */
export function dropLinkEcho(text: string, links: AssistantLink[]): string {
  if (links.length === 0) return text;

  const labels = new Set(links.map((link) => link.label.toLowerCase()));
  const bare = (line: string) => line.trim().replace(/^[*_\-\s]+/, "").replace(/[*_:.\-\s]+$/, "").toLowerCase();

  return text
    .split("\n")
    .filter((line) => !labels.has(bare(line)))
    .join("\n")
    .trim();
}
