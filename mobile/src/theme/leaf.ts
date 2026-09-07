/**
 * La hoja de la marca, dibujada en vez de fotografiada.
 *
 * Es un vector para que se vea igual de nítida al tamaño de un ícono que ocupando media
 * pantalla, y para que el color se pueda animar: una imagen no se puede llenar de a poco.
 *
 * Las medidas están en un lienzo de 100 × 124 con la hoja parada, la punta arriba y el
 * cabito abajo. Nace parada a propósito: así el ángulo lo pone la animación, que es la
 * que sabe si la hoja está por caer o dando una vuelta.
 */
export const LEAF_BOX = { width: 100, height: 124 };

/** El contorno. Ancha en el medio y en punta arriba, que es lo que la hace leerse chica. */
export const LEAF_BLADE = "M50 4 C18 30 10 72 50 102 C90 72 82 30 50 4 Z";

/** El nervio del medio, apenas curvado: una recta la volvería un dibujo de geometría. */
export const LEAF_MIDRIB = "M50 100 C47 70 47 36 50 8";

/** Las nervaduras. Son lo que a tamaño de ícono todavía dice "hoja" y no "gota". */
export const LEAF_VEINS = [
  "M49 64 C41 58 35 51 31 43",
  "M51 64 C59 58 65 51 69 43",
  "M49 82 C43 77 38 71 35 65",
  "M51 82 C57 77 62 71 65 65",
];

/** El cabito. Da el punto por donde la hoja se soltó, que es de lo que trata la caída. */
export const LEAF_STEM = "M50 102 C52 108 50 114 47 120";

/**
 * Cuánto está inclinada la hoja cuando está quieta, en grados.
 *
 * Bien inclinada y no casi derecha: derecha parece pegada a la pantalla, y así parece
 * colgando de algo que ya no se ve. Es además de donde arranca el giro de la caída, que
 * por eso no empieza de cero.
 *
 * Está acá y no en la pantalla de arranque porque no lo usa solo ella: los íconos de la
 * app se generan con este mismo ángulo (ver scripts/iconos.mjs), así que la hoja del
 * escritorio y la que aparece al abrir son la misma hoja en la misma posición. Cambiarlo
 * acá y volver a correr el script alcanza para que las dos sigan coincidiendo.
 */
export const LEAF_TILT = -33;

export type Season = "primavera" | "verano" | "otono" | "invierno";

export interface LeafColors {
  blade: string;
  veins: string;
}

/**
 * El color con el que arranca: apagado, como una hoja todavía sin llenar.
 *
 * Es el mismo en los dos modos. Contra el papel claro y contra el verde oscuro se lee
 * igual de "apagada", que es lo único que tiene que decir.
 */
export const LEAF_EMPTY: LeafColors = { blade: "#9aa3ab", veins: "#7c858d" };

/**
 * De qué color termina, según la estación del hemisferio sur.
 *
 * El invierno no es una hoja muerta: es una perenne, con el verde tirando a frío. Es la
 * hoja que se queda cuando las otras ya no están, que dice bastante más de un consultorio
 * abierto todo el año que una hoja seca.
 *
 * Los cuatro tienen color de verdad y no un tono lavado. El punto de la animación es que
 * se vea pasar de apagada a viva; con un color desvaído, el final se confunde con el gris
 * del principio y parece que nunca hubiera cambiado nada.
 */
export const SEASON_COLORS: Record<Season, LeafColors> = {
  primavera: { blade: "#57bd6b", veins: "#2f7e42" },
  verano: { blade: "#2e9a5c", veins: "#1d6b3d" },
  otono: { blade: "#d07c2e", veins: "#9c5312" },
  invierno: { blade: "#2c9079", veins: "#1a6355" },
};

/**
 * En qué estación cae una fecha, en Argentina.
 *
 * Los cortes son los solsticios y equinoccios del hemisferio sur, redondeados al día 21
 * que es como se cuentan acá. El mes va de 1 a 12 para que se lea sin traducir.
 */
export function seasonOf(date: Date): Season {
  const key = (date.getMonth() + 1) * 100 + date.getDate();

  if (key >= 921 && key <= 1220) return "primavera";
  if (key >= 1221 || key <= 320) return "verano";
  if (key >= 321 && key <= 620) return "otono";
  return "invierno";
}

export function leafColorsFor(date: Date): LeafColors {
  return SEASON_COLORS[seasonOf(date)];
}
