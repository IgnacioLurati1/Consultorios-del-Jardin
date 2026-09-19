/**
 * Lo de la noche de terror que también usa la pantalla: las noches, los nombres de las
 * cámaras y lo que la escena le cuenta. Va aparte de nightGame a propósito: este archivo no
 * trae three.js, así que importarlo desde la pantalla no mete la librería 3D en el resto
 * del sitio.
 */

export interface NightState {
  phase: "intro" | "play" | "scare" | "dead" | "won";
  /** Qué noche es, desde 0. */
  night: number;
  /** 0 son las 12, 6 son las 6 de la mañana. */
  hour: number;
  cams: boolean;
  cam: number;
  blackout: boolean;
  /** Se subió la palanca y la luz está por volver. */
  restoring: boolean;
  seated: boolean;
  /** Los segundos que le quedan a la muñeca, o null si todavía no apareció. */
  doll: number | null;
  /** Los segundos con los que arranca la muñeca en esta noche. */
  dollMax: number;
  /** Se acaba de ir el Retorcido: la vista se cierra un rato. */
  dread: boolean;
  /** Está diciendo que es él. */
  itsMe: boolean;
}

/**
 * Las cinco noches. Lo que cambia de una a otra:
 * - `appear`: cuánto más seguido que en la primera aparecen.
 * - `stage`: los segundos que pasan en cada estado una vez afuera.
 * - `cooldown`: lo que tardan en poder volver después de irse.
 * - `grace`: el rato sin nadie al arrancar.
 * - `doctor`, `woman`, `tree`: los segundos que dan una vez que salen, antes de atacar o
 *   de cortar la luz.
 * - `doll`: los segundos con los que arranca la muñeca, y `dollGain` lo que suma cada
 *   segundo de mirarla.
 * - `faults`: cuántos cortes de luz sueltos hay en la noche.
 * - `blood`: las dos últimas son otra cosa. El hall está lleno de sangre, todo tira a rojo
 *   y no dan respiro.
 */
export const NIGHTS = [
  { name: "Tranquila", appear: 1, stage: 5, cooldown: 25, grace: 30, doctor: 5, woman: 10, tree: 10, doll: 30, dollGain: 2, faults: 1, blood: false },
  { name: "Inquieta", appear: 1.35, stage: 5, cooldown: 25, grace: 30, doctor: 4.5, woman: 9, tree: 9, doll: 27, dollGain: 2, faults: 2, blood: false },
  { name: "Pesada", appear: 1.75, stage: 5, cooldown: 22, grace: 30, doctor: 4, woman: 8, tree: 8, doll: 24, dollGain: 2, faults: 2, blood: false },
  { name: "Sangre", appear: 3.2, stage: 4, cooldown: 14, grace: 18, doctor: 3, woman: 6, tree: 6, doll: 18, dollGain: 1.8, faults: 4, blood: true },
  { name: "La última", appear: 4.3, stage: 3, cooldown: 9, grace: 12, doctor: 2.5, woman: 5, tree: 5, doll: 15, dollGain: 1.6, faults: 5, blood: true },
];

export const CAMERA_NAMES = ["Consultorio naranja", "Consultorio turquesa", "Consultorio verde", "Jardín"];
