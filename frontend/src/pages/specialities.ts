/**
 * Especialidades que se atienden en el consultorio. Por ahora es una lista fija: no
 * cambian lo suficiente como para justificar un ABM. Se usa tanto para buscar turnos como
 * para cargar profesionales, así que el texto guardado coincide con el que se filtra.
 *
 * La app del celular tiene la misma lista en mobile/src/lib/specialities.ts, y el
 * asistente en backend/src/assistant/assistant.catalog.ts: sumar una es sumarla en los tres.
 */
export const SPECIALITIES = ["Psicopedagogía", "Psicología", "Psiquiatría", "Nutrición", "Fonoaudiología"];

/** Compara especialidades sin que molesten los acentos ni las mayúsculas. */
export function normalizeSpeciality(value: string): string {
  return (
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase() ?? ""
  );
}

export function sameSpeciality(a: string, b: string): boolean {
  return normalizeSpeciality(a) === normalizeSpeciality(b);
}
