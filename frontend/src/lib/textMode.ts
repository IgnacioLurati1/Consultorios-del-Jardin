import { createPreference } from "./preference";

/**
 * Si las pantallas se muestran con las explicaciones o sin ellas.
 *
 * Lo que apaga son las descripciones que repiten lo que el título ya dice. Lo que avisa
 * qué se toca y qué no, y lo que lleva un dato adentro, se queda siempre: eso no es
 * texto de más, es la diferencia entre entender y no entender qué va a pasar.
 *
 * Es hermana de la vista simplificada y hacen cosas distintas: esta acorta lo que se lee,
 * la otra saca funciones de la pantalla. Se recomiendan entre sí, pero se prenden aparte.
 */
export const useSimpleText = createPreference("menos-texto");
