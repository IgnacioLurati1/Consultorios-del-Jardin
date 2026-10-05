/**
 * Los nombres de las personas, con las mayúsculas en su lugar.
 *
 * Se cargaban como venían: "juan pérez" quedaba así en la agenda, en los mails y en la
 * ficha. Ahora se acomodan al guardar, venga de donde venga el dato (registro, alta de un
 * profesional, paciente cargado sin cuenta, edición del perfil).
 *
 * Qué se toca y qué no:
 * - Una palabra toda en minúscula o toda en mayúscula pasa a tener la inicial en mayúscula:
 *   "juan" y "JUAN" quedan "Juan".
 * - Una palabra que ya mezcla mayúsculas y minúsculas se deja como está: "McDonald" o
 *   "DiCaprio" están bien escritos así, y "corregirlos" los rompería.
 * - Las partículas del medio quedan en minúscula: "María de los Ángeles", "Juan del Valle".
 * - Los compuestos con guion o apóstrofo llevan mayúscula en cada parte: "Ana-Laura", "O'Brien".
 * - Los espacios de más se van.
 */

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "di", "van", "von", "der"]);

function capitalize(word: string): string {
  return word
    .toLocaleLowerCase("es")
    .replace(/(^|[-'’])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase("es"));
}

export function properName(value: string | null | undefined): string {
  const words = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es");
      const upper = word.toLocaleUpperCase("es");
      const mixed = word !== lower && word !== upper;
      if (mixed) return word;
      if (index > 0 && index < words.length - 1 && PARTICLES.has(lower)) return lower;
      return capitalize(word);
    })
    .join(" ");
}
