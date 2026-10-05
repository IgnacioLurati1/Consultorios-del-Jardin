import { badRequest } from "./errors.js";

/**
 * Las especialidades de un consultorio, escritas siempre igual.
 *
 * La lista la carga cada consultorio, y la misma especialidad llegaba escrita de varias
 * formas: "psicologia", "Psicología ", "PSICOLOGÍA". Como el pedido de turno filtra a los
 * profesionales por esa palabra, dos formas de escribirla eran dos especialidades.
 *
 * Al guardar:
 * - se sacan los espacios de más y la puntuación del final;
 * - si es una de las conocidas, queda con sus tildes ("psicologia" → "Psicología");
 * - si no, con la primera letra en mayúscula y el resto como en una oración, dejando las
 *   siglas como vienen ("terapia OCUPACIONAL" → "Terapia ocupacional", "TCC" → "TCC");
 * - dos que se escriben igual sin contar tildes ni mayúsculas son la misma y queda una.
 */

/** Las más comunes, con sus tildes. La clave es el nombre sin tildes y en minúscula. */
const KNOWN = [
  "Psicología",
  "Psicopedagogía",
  "Psiquiatría",
  "Psicoanálisis",
  "Psicomotricidad",
  "Psicología infantil",
  "Neuropsicología",
  "Nutrición",
  "Fonoaudiología",
  "Kinesiología",
  "Fisioterapia",
  "Terapia ocupacional",
  "Acompañamiento terapéutico",
  "Musicoterapia",
  "Odontología",
  "Ortodoncia",
  "Pediatría",
  "Traumatología",
  "Cardiología",
  "Dermatología",
  "Ginecología",
  "Obstetricia",
  "Oftalmología",
  "Otorrinolaringología",
  "Neurología",
  "Endocrinología",
  "Gastroenterología",
  "Urología",
  "Reumatología",
  "Neumonología",
  "Clínica médica",
  "Medicina general",
  "Osteopatía",
  "Podología",
  "Estimulación temprana",
  "Psicología social",
  "Sexología",
  "Cosmetología",
  "Estética",
  "Masoterapia",
];

export const SPECIALITY_MAX = 60;
export const SPECIALITIES_MAX = 30;

/** Sin tildes, sin mayúsculas y sin espacios de más: la forma de comparar dos especialidades. */
export function specialityKey(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const BY_KEY = new Map(KNOWN.map((name) => [specialityKey(name), name]));

/** Una especialidad escrita como corresponde. Vacía si no queda nada. */
export function normalizeSpeciality(value: string): string {
  const clean = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "");
  if (!clean) return "";

  const known = BY_KEY.get(specialityKey(clean));
  if (known) return known;

  // Escrita entera en mayúscula no hay siglas que respetar: es el bloqueo de mayúsculas.
  const shouting = clean === clean.toLocaleUpperCase("es");

  return clean
    .split(" ")
    .map((word, index) => {
      // Una sigla corta va como viene: "TCC", "EMDR".
      if (!shouting && word.length <= 4 && word === word.toLocaleUpperCase("es") && /\p{L}/u.test(word)) return word;
      const lower = word.toLocaleLowerCase("es");
      return index === 0 ? lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1) : lower;
    })
    .join(" ");
}

/**
 * La lista entera, lista para guardar: cada una escrita como corresponde, sin vacías y sin
 * repetidas, en el orden en que llegó. Tira con un mensaje si algo no entra.
 */
export function normalizeSpecialityList(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const name = normalizeSpeciality(String(value ?? ""));
    if (!name) continue;
    if (name.length > SPECIALITY_MAX) throw badRequest(`"${name.slice(0, 30)}…" es demasiado largo`);
    const key = specialityKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  if (out.length > SPECIALITIES_MAX) throw badRequest(`Entran hasta ${SPECIALITIES_MAX}`);
  return out;
}

/** La forma de la lista que corresponde a una especialidad, o null si no está. */
export function canonicalSpeciality(value: string | null | undefined, list: string[]): string | null {
  if (!value) return null;
  const key = specialityKey(value);
  return list.find((name) => specialityKey(name) === key) ?? null;
}

/** Los íconos que sabe dibujar la web. Ver lib/specialityIcons en el front. */
export const SPECIALITY_ICON_KEYS = [
  "brain",
  "book",
  "stethoscope",
  "doctor",
  "apple",
  "ear",
  "heart",
  "care",
  "hands",
  "tooth",
  "bone",
  "eye",
  "baby",
  "child",
  "puzzle",
  "run",
  "gym",
  "spa",
  "leaf",
  "music",
  "group",
] as const;

export interface SpecialityStyle {
  icon: string | null;
  imageId: string | null;
}

/**
 * Los estilos guardados, validados y solo para las especialidades que están en la lista.
 *
 * Un ícono que la web no conoce o un id de foto con otra forma se descartan: lo peor que
 * pasa es que esa especialidad vuelve al ícono que sugiere su nombre.
 */
export function stylesFor(raw: unknown, list: string[]): Record<string, SpecialityStyle> {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: Record<string, SpecialityStyle> = {};
  for (const [name, style] of Object.entries(value as Record<string, unknown>)) {
    const canonical = canonicalSpeciality(name, list);
    if (!canonical || !style || typeof style !== "object") continue;
    const { icon, imageId } = style as Record<string, unknown>;
    const entry: SpecialityStyle = {
      icon: typeof icon === "string" && (SPECIALITY_ICON_KEYS as readonly string[]).includes(icon) ? icon : null,
      imageId: typeof imageId === "string" && /^[0-9a-f]{24}$/.test(imageId) ? imageId : null,
    };
    if (entry.icon || entry.imageId) out[canonical] = entry;
  }
  return out;
}
