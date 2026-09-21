/**
 * Lo de la noche de terror que también usa la pantalla: las noches, los nombres de las
 * cámaras y lo que la escena le cuenta. Va aparte de nightGame a propósito: este archivo no
 * trae three.js, así que importarlo desde la pantalla no mete la librería 3D en el resto
 * del sitio.
 */

export interface NightState {
  /** `brief` es el cartel de cómo se juega, antes de arrancar. `ending`, lo que pasa después de la última noche en vez del cartel de las 6. */
  phase: "brief" | "intro" | "play" | "scare" | "dead" | "won" | "ending";
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
  /** La luz que se lleva encima, de 1 a 0. Se carga en el baño. */
  light: number;
  /** Se está cargando en ese momento. */
  filling: boolean;
  /** Se acabó la luz: oscuridad, la canción y el final. */
  lightsOut: boolean;
  /**
   * El final de la última noche: 1 mientras habla, 2 mientras se arrodillan y 3 cuando ya
   * es todo negro y toca volver al menú. Al terminar la tercera noche también pasa por 1,
   * con una sola frase. 0 en cualquier otro momento.
   */
  ending: number;
  /** Cuántas frases del final ya dijo, contando las de LAST_WORDS y después las de CLOSING_WORDS. */
  said: number;
}

/** Al terminar esta, habla por primera vez: una sola frase, en la oscuridad. */
export const WATCHING_NIGHT = 2;
export const WATCHING_WORDS = ["Te estoy observando..."];

/** Lo que dice al final de la última noche, una frase por vez. */
export const LAST_WORDS = ["Me abandonaste...", "Pero no importa.", "Yo no te abandonaré.", "Nunca..."];
/** Y lo que dice después, detrás de los cuatro ya arrodillados. */
export const CLOSING_WORDS = ["Algún día sabrás quiénes somos...", "Algún día..."];

/**
 * Las siete noches. Lo que cambia de una a otra:
 * - `appear`: cuánto más seguido que en la primera aparecen.
 * - `stage`: los segundos que pasan en cada estado una vez afuera.
 * - `cooldown`: lo que tardan en poder volver después de irse.
 * - `grace`: el rato sin nadie al arrancar.
 * - `doctor`, `woman`, `tree`: los segundos que dan una vez que salen, antes de atacar o
 *   de cortar la luz.
 * - `doll`: los segundos con los que arranca la muñeca, y `dollGain` lo que suma cada
 *   segundo de mirarla.
 * - `faults`: cuántos cortes de luz sueltos hay en la noche.
 *
 * Todas aflojaron un poco cuando entró la luz que se lleva encima: ahora hay que dejar el
 * escritorio cada tanto para cargarla en el baño, y eso ya es bastante castigo.
 * - `blood`: la cuarta y la quinta son otra cosa. El hall está lleno de sangre, todo tira
 *   a rojo y no dan respiro.
 * - `abandoned`: la sexta y la séptima pasan después de que el consultorio cerró. Todo está
 *   clausurado, sucio y gastado, y son apenas más difíciles que las de sangre.
 */
export const NIGHTS = [
  { name: "Tranquila", appear: 0.8, stage: 6, cooldown: 32, grace: 40, doctor: 7, woman: 13, tree: 13, doll: 36, dollGain: 2.4, faults: 1, blood: false },
  { name: "Inquieta", appear: 1.1, stage: 6, cooldown: 30, grace: 36, doctor: 6, woman: 12, tree: 12, doll: 32, dollGain: 2.4, faults: 1, blood: false },
  { name: "Pesada", appear: 1.45, stage: 5.5, cooldown: 27, grace: 34, doctor: 5.5, woman: 11, tree: 11, doll: 29, dollGain: 2.2, faults: 2, blood: false },
  { name: "Sangre", appear: 2.5, stage: 4.5, cooldown: 18, grace: 24, doctor: 4, woman: 8, tree: 8, doll: 23, dollGain: 2, faults: 3, blood: true },
  { name: "El cierre", appear: 3.4, stage: 4, cooldown: 13, grace: 18, doctor: 3.5, woman: 7, tree: 7, doll: 19, dollGain: 1.8, faults: 4, blood: true },
  { name: "Clausurado", appear: 2.8, stage: 4.3, cooldown: 16, grace: 22, doctor: 3.8, woman: 7.5, tree: 7.5, doll: 21, dollGain: 1.9, faults: 3, blood: false, abandoned: true },
  { name: "Nunca", appear: 3.7, stage: 3.7, cooldown: 12, grace: 16, doctor: 3.2, woman: 6.5, tree: 6.5, doll: 18, dollGain: 1.7, faults: 4, blood: false, abandoned: true },
];

/** Después de esta, el diario: el consultorio cerró. Las que siguen son en el lugar clausurado. */
export const CLOSING_NIGHT = 4;

export const CAMERA_NAMES = ["Consultorio naranja", "Consultorio turquesa", "Consultorio verde", "Jardín"];
