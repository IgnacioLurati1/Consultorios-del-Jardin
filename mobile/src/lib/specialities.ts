/**
 * Las especialidades que se atienden. Es una lista fija: son cuatro y no cambian lo
 * suficiente como para justificar un ABM. El texto tiene que ser igual al que guarda la
 * web, porque es el mismo campo de la misma base.
 */
export const SPECIALITIES = ["Psicopedagogía", "Psicología", "Nutrición", "Fonoaudiología"] as const;

export function normalizeSpeciality(value: string | null | undefined): string {
  return (
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase() ?? ""
  );
}

export function sameSpeciality(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeSpeciality(a) === normalizeSpeciality(b);
}

/** Búsqueda de texto que no se pelea con los acentos ni con las mayúsculas. */
export function matches(haystack: string, needle: string): boolean {
  return normalizeSpeciality(haystack).includes(normalizeSpeciality(needle));
}

/** Datos del consultorio, los mismos que responde el asistente. */
export const OFFICE_INFO = {
  name: "Consultorios del Jardín",
  address: "9 de Julio 3672",
  hours: "Lunes a viernes, de 8 a 20",
  instagram: "consultorios_jardin",
} as const;

export const DOC_TYPES = ["DNI", "LC", "LE", "Pasaporte"] as const;

export const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;

/** El nombre del día como se escribe, no como lo guarda la base. */
export const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};
