/**
 * La estación del año, que es de dónde sale el color de la app.
 *
 * Es lo mismo que hace la web, con los mismos cuatro números por estación: si acá y allá
 * dieran colores distintos, la misma persona vería dos consultorios.
 */

export type Season = "otono" | "invierno" | "primavera" | "verano";

/** Una estación fija, o que la decida el calendario. */
export type SeasonChoice = Season | "auto";

/**
 * Las cuatro, en el orden del calendario de acá: el año arranca en verano.
 *
 * No dice de qué color es cada una porque al lado de cada nombre está la muestra, y
 * escribir "marrón" al lado de un cuadrado marrón no agrega nada.
 */
export const SEASONS: { key: Season; label: string }[] = [
  { key: "verano", label: "Verano" },
  { key: "otono", label: "Otoño" },
  { key: "invierno", label: "Invierno" },
  { key: "primavera", label: "Primavera" },
];

/**
 * De cada estación salen cuatro números y de ahí todo el resto.
 *
 * `h` es el tono del acento y `s` cuánto tira de ese tono. `h2` y `s2` son el otro
 * extremo del degradado del encabezado: no es el mismo color más oscuro sino otro, que es
 * lo que le da profundidad en vez de dejarlo plano.
 *
 * Otoño se va del verde a propósito: es la única del año en que afuera tampoco hay verde.
 */
export const SEASON_TINT: Record<Season, { h: number; s: number; h2: number; s2: number }> = {
  otono: { h: 26, s: 38, h2: 18, s2: 42 },
  invierno: { h: 165, s: 30, h2: 190, s2: 34 },
  primavera: { h: 116, s: 32, h2: 128, s2: 42 },
  verano: { h: 95, s: 40, h2: 130, s2: 40 },
};

/**
 * Argentina está en UTC-3 todo el año, sin horario de verano desde 2009.
 *
 * Se resta la diferencia a mano y se lee en UTC en vez de preguntarle la fecha al
 * teléfono. La estación es la del consultorio, no la de quien mira: alguien que abre la
 * app de viaje, o con el reloj del teléfono mal puesto, tiene que ver el mismo otoño que
 * se ve acá.
 */
const ARGENTINA = -3 * 60 * 60 * 1000;

/**
 * En qué estación cae una fecha, en el hemisferio sur.
 *
 * Los cortes son los astronómicos, redondeados al 21: el día exacto se mueve unas horas
 * de un año a otro y nadie va a notar que el color cambió un día después.
 */
export function seasonOf(now: Date): Season {
  const argentina = new Date(now.getTime() + ARGENTINA);

  // Mes y día en un solo número, para poder comparar rangos sin dos condiciones por
  // estación. El 21 de marzo es 321, el 21 de diciembre es 1221.
  const date = (argentina.getUTCMonth() + 1) * 100 + argentina.getUTCDate();

  if (date >= 321 && date < 621) return "otono";
  if (date >= 621 && date < 921) return "invierno";
  if (date >= 921 && date < 1221) return "primavera";
  return "verano";
}

/**
 * Un color en tono, saturación y luminosidad, devuelto como hexadecimal.
 *
 * La app se escribe en HSL y no en hexadecimal porque toda la paleta es el mismo juego de
 * luminosidades con el tono de la estación puesto encima. Escrita a mano serían ocho
 * paletas —cuatro estaciones por dos modos— que hay que mantener a la par; así hay una
 * sola, y lo que cambia son dos números.
 */
export function hsl(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const light = l / 100;

  // La conversión de siempre, con el atajo del gris para no dividir por cero.
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const sector = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = light - chroma / 2;

  const rgb: [number, number, number] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];

  return `#${rgb.map((value) => Math.round((value + base) * 255).toString(16).padStart(2, "0")).join("")}`;
}
