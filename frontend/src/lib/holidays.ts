/**
 * Las fechas especiales que decoran la portada.
 *
 * No tocan los colores de la estación, que siguen mandando: son adornos que se cuelgan
 * encima y se van solos cuando pasa la fecha. Por eso esto devuelve "ninguna" la mayor
 * parte del año y la página se ve como siempre.
 *
 * Las tres son las que se festejan acá, con el rango que pidió el consultorio.
 */

/**
 * Argentina está en UTC-3 todo el año. Igual que con las estaciones, la fecha se mide
 * acá y no en el reloj de quien mira: alguien que abre la página de viaje tiene que ver
 * los mismos adornos que se ven en el consultorio.
 */
const ARGENTINA = -3 * 60 * 60 * 1000;

export type Holiday = "navidad" | "carnaval" | "pascua";

/**
 * Desde y hasta, los dos incluidos, en el mismo formato que las estaciones: mes y día en
 * un solo número, así un rango es una comparación y no cuatro.
 *
 * Pascua cruza de mes (329 a 405) y la cuenta sigue funcionando igual: entre el 331 y el
 * 401 no hay ningún día que exista.
 */
export const HOLIDAYS: { key: Holiday; label: string; from: number; to: number }[] = [
  { key: "navidad", label: "Navidad", from: 1201, to: 1225 },
  { key: "carnaval", label: "Carnaval", from: 201, to: 217 },
  { key: "pascua", label: "Pascua", from: 329, to: 405 },
];

/** Qué se festeja en esa fecha, o nada. */
export function holidayOf(now: Date): Holiday | null {
  const argentina = new Date(now.getTime() + ARGENTINA);
  const date = (argentina.getUTCMonth() + 1) * 100 + argentina.getUTCDate();

  return HOLIDAYS.find((holiday) => date >= holiday.from && date <= holiday.to)?.key ?? null;
}
