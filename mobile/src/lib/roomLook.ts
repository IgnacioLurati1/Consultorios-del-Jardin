/**
 * Cómo se ve un consultorio, deducido de su nombre.
 *
 * Es el mismo criterio y el mismo listado que la web (frontend/src/lib/roomLook.ts).
 * Están escritos dos veces porque son dos proyectos separados, pero tienen que decir lo
 * mismo: la misma sala no puede salir turquesa en la computadora y gris en el teléfono.
 *
 * En el consultorio las salas se nombran por su color —"Naranja", "Turquesa", "Verde"— o
 * por dónde están —"Jardín", "Calle", "Planta Alta"—, y así es como las distingue el que
 * trabaja ahí. La pantalla lo puede aprovechar sin que nadie cargue nada: si el nombre es
 * un color, el iconito va de ese color; si es un lugar conocido, en vez de la inicial va
 * un dibujo. Buscar la sala pasa a ser mirar en vez de leer.
 *
 * Un nombre que no es ninguna de las dos cosas no se toca: se queda con su inicial y su
 * gris. No es una función que haya que configurar, y no coincidir es lo normal.
 */

/**
 * Los colores que se reconocen, con el tono con el que se pintan.
 *
 * No son los colores literales sino versiones de saturación media, elegidas para que el
 * círculo se lea igual en el tema claro y en el oscuro: un amarillo puro sobre fondo
 * blanco desaparece, y un azul marino sobre fondo negro también.
 */
const COLORS: Record<string, string> = {
  rojo: "#c0392b",
  colorado: "#c0392b",
  bordo: "#7d2231",
  vino: "#7d2231",
  naranja: "#d9730d",
  amarillo: "#dcae1d",
  mostaza: "#c9a227",
  dorado: "#c9a227",
  oro: "#c9a227",
  ocre: "#b08228",
  verde: "#3f8c5c",
  lima: "#7cb342",
  aguamarina: "#35a08a",
  turquesa: "#14a1a1",
  cian: "#0fa3b1",
  celeste: "#4aa3df",
  azul: "#2f6fb0",
  marino: "#28477a",
  violeta: "#7a4bbd",
  lila: "#9b7fd4",
  morado: "#6b3fa0",
  purpura: "#6b3fa0",
  rosa: "#e07aa3",
  rosado: "#e07aa3",
  fucsia: "#c2379a",
  magenta: "#c2379a",
  coral: "#e2725b",
  salmon: "#e08a70",
  marron: "#7b5230",
  cafe: "#7b5230",
  chocolate: "#5d4037",
  beige: "#d8c9a3",
  crema: "#e3d9bd",
  gris: "#8a94a6",
  plata: "#a8b0bd",
  plateado: "#a8b0bd",
  negro: "#2b2f33",
  blanco: "#e8ecef",
};

/** Los dibujos que puede tener una sala. Quien los pinta es cada pantalla. */
export type RoomPictogram = "leaf" | "road" | "stairs";

/**
 * Nombres que describen un lugar y no un color.
 *
 * La lista es corta a propósito: son los tres lugares que este consultorio usa. Adivinar
 * de más —que "Fondo" es un jardín, que "Frente" es la calle— acierta la mitad de las
 * veces, y una inicial correcta es mejor que un dibujo equivocado.
 */
const PICTOGRAMS: Record<string, RoomPictogram> = {
  jardin: "leaf",
  calle: "road",
  "planta alta": "stairs",
  escalera: "stairs",
  escaleras: "stairs",
};

/** Cómo se ve una sala. Las dos partes son opcionales y pueden venir juntas. */
export interface RoomLook {
  /** Fondo del iconito, cuando el nombre es un color. */
  background?: string;
  /** Lo que va encima del fondo: la inicial o el dibujo. */
  text?: string;
  /** Dibujo que reemplaza a la inicial, cuando el nombre es un lugar conocido. */
  icon?: RoomPictogram;
}

/** Sin acentos, sin mayúsculas y sin espacios de más: "Turquesa " y "turquesa" son lo mismo. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Qué tan claro es un color, de 0 a 1.
 *
 * Decide si lo de encima va en blanco o en negro. Sin esto, "Amarillo" y "Beige" quedan
 * con letras blancas sobre fondo claro y no se leen.
 */
function lightness(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  // Los coeficientes son los del ojo humano: el verde pesa mucho más que el azul.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Qué se le reconoce al nombre de una sala. Null si no se le reconoce nada.
 *
 * Mira el nombre entero primero y después palabra por palabra, así "Sala Azul" también
 * cuenta. Que un consultorio llamado "Rosa" por una persona salga rosa es un riesgo
 * asumido: no rompe nada y la mayoría de las veces acierta.
 */
export function roomLook(name?: string | null): RoomLook | null {
  if (!name) return null;

  const clean = normalize(name);
  const words = clean.split(" ");

  const icon = PICTOGRAMS[clean] ?? words.map((word) => PICTOGRAMS[word]).find(Boolean);
  const color = COLORS[clean] ?? words.map((word) => COLORS[word]).find(Boolean);

  if (!icon && !color) return null;

  return {
    ...(color ? { background: color, text: lightness(color) > 0.6 ? "#1f2a33" : "#ffffff" } : {}),
    ...(icon ? { icon } : {}),
  };
}
