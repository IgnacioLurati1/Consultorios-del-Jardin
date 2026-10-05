/**
 * Las palabras del rubro.
 *
 * Un consultorio dice "turno", "profesional" y "paciente"; un estudio de yoga dice "clase",
 * "instructora" y "alumno"; un centro de estética dice "sesión" y "cliente". El sistema es
 * el mismo, y lo que cambia son estas cinco palabras.
 *
 * Cambiar una palabra no alcanza en castellano: "el turno confirmado" pasa a ser "la cita
 * confirmada", así que cada una se guarda con su plural y su género, y los textos se arman
 * con los ayudantes de `words()`, que ponen el artículo y la terminación que corresponden.
 *
 * "Lugar" y "sala" arrancan diciendo lo mismo, "consultorio", y no son lo mismo: el lugar es
 * el negocio ("desde el consultorio te asignaron un turno") y la sala es donde se atiende
 * ("Consultorio naranja"). Con una sola palabra, un cliente que llama "sala" a sus salas
 * leería "desde la sala te asignaron un turno".
 *
 * El género es el de la palabra, no el de la persona. "La profesional" o "el profesional"
 * depende de quién atiende, y los textos que nombran a alguien en particular usan su
 * nombre; esto es para cuando se habla en general.
 */

export const TERM_KEYS = ["turno", "profesional", "paciente", "lugar", "sala", "especialidad", "sucursal"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export interface Term {
  /** Singular, en minúscula: "turno". */
  one: string;
  /** Plural, en minúscula: "turnos". */
  many: string;
  /** El género de la palabra: "m" para "el turno", "f" para "la cita". */
  gender: "m" | "f";
}

export type Vocabulary = Record<TermKey, Term>;

/** Las palabras de siempre. Con estas, todos los textos dicen exactamente lo que decían. */
export const DEFAULT_VOCABULARY: Vocabulary = {
  turno: { one: "turno", many: "turnos", gender: "m" },
  profesional: { one: "profesional", many: "profesionales", gender: "m" },
  paciente: { one: "paciente", many: "pacientes", gender: "m" },
  lugar: { one: "consultorio", many: "consultorios", gender: "m" },
  sala: { one: "consultorio", many: "consultorios", gender: "m" },
  especialidad: { one: "especialidad", many: "especialidades", gender: "f" },
  sucursal: { one: "sucursal", many: "sucursales", gender: "f" },
};

/** Largo máximo de una palabra. Va en asuntos de mail y en botones. */
export const TERM_MAX = 40;

/**
 * Un vocabulario que llega de afuera, validado y completo.
 *
 * Lo que falta toma el de siempre, palabra por palabra: una versión vieja de la pantalla
 * que no manda "especialidad" no la borra. Devuelve el problema en vez de tirar, para que
 * quien llama ponga su propio mensaje.
 */
export function parseVocabulary(input: unknown): { vocabulary: Vocabulary } | { problem: string } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, any>;
  const vocabulary = {} as Vocabulary;

  for (const key of TERM_KEYS) {
    const term = raw[key];
    if (term === undefined) {
      vocabulary[key] = DEFAULT_VOCABULARY[key];
      continue;
    }

    const one = String(term?.one ?? "").trim().toLowerCase();
    const many = String(term?.many ?? "").trim().toLowerCase();
    const gender = term?.gender;

    if (!one || !many) return { problem: `Falta el singular o el plural de "${DEFAULT_VOCABULARY[key].one}"` };
    if (one.length > TERM_MAX || many.length > TERM_MAX)
      return { problem: `Las palabras no pueden pasar de ${TERM_MAX} letras` };
    if (gender !== "m" && gender !== "f") return { problem: `Falta el género de "${one}"` };
    // Son palabras sueltas que van adentro de textos y de HTML: nada de signos que corten
    // una frase o una etiqueta.
    if (!/^[\p{L}\p{M} '-]+$/u.test(one) || !/^[\p{L}\p{M} '-]+$/u.test(many))
      return { problem: `"${one}" tiene signos que no van en una palabra` };

    vocabulary[key] = { one, many, gender };
  }

  return { vocabulary };
}

/** Lo que estaba guardado, leído sin fallar: si algo está roto, las de siempre. */
export function vocabularyOf(stored: string | null | undefined): Vocabulary {
  if (!stored) return DEFAULT_VOCABULARY;
  try {
    const parsed = parseVocabulary(JSON.parse(stored));
    return "vocabulary" in parsed ? parsed.vocabulary : DEFAULT_VOCABULARY;
  } catch {
    return DEFAULT_VOCABULARY;
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Las palabras, listas para escribir con ellas.
 *
 * `w.turno` y `w.turnos` son la palabra suelta; `w.Turno`, con mayúscula. Lo demás pone lo
 * que depende del género: `w.el("turno")` es "el turno" o "la cita", `w.o("turno")` es la
 * terminación de un adjetivo que concuerda ("confirmad" + "o" o "a").
 *
 * La terminación cubre los adjetivos que usan los textos —confirmado, cancelado, nuevo,
 * próximo, pedido—, que son todos de los que terminan en "o". Uno invariable, como
 * "especial", se escribe sin ella.
 */
export function words(vocabulary: Vocabulary = DEFAULT_VOCABULARY) {
  // Una palabra que falta (un vocabulario guardado antes de que existiera) toma la de siempre.
  const term = (key: TermKey) => vocabulary[key] ?? DEFAULT_VOCABULARY[key];
  const f = (key: TermKey) => term(key).gender === "f";
  const one = (key: TermKey) => term(key).one;
  const many = (key: TermKey) => term(key).many;

  return {
    turno: one("turno"),
    turnos: many("turno"),
    Turno: capital(one("turno")),
    Turnos: capital(many("turno")),
    profesional: one("profesional"),
    profesionales: many("profesional"),
    Profesional: capital(one("profesional")),
    Profesionales: capital(many("profesional")),
    paciente: one("paciente"),
    pacientes: many("paciente"),
    Paciente: capital(one("paciente")),
    Pacientes: capital(many("paciente")),
    lugar: one("lugar"),
    lugares: many("lugar"),
    Lugar: capital(one("lugar")),
    Lugares: capital(many("lugar")),
    sala: one("sala"),
    salas: many("sala"),
    Sala: capital(one("sala")),
    Salas: capital(many("sala")),
    especialidad: one("especialidad"),
    especialidades: many("especialidad"),
    Especialidad: capital(one("especialidad")),
    Especialidades: capital(many("especialidad")),
    sucursal: one("sucursal"),
    sucursales: many("sucursal"),
    Sucursal: capital(one("sucursal")),
    Sucursales: capital(many("sucursal")),

    /** "el turno" / "la cita" */
    el: (key: TermKey) => `${f(key) ? "la" : "el"} ${one(key)}`,
    /** "El turno" / "La cita" */
    El: (key: TermKey) => `${f(key) ? "La" : "El"} ${one(key)}`,
    /** "los turnos" / "las citas" */
    los: (key: TermKey) => `${f(key) ? "las" : "los"} ${many(key)}`,
    /** "Los turnos" / "Las citas" */
    Los: (key: TermKey) => `${f(key) ? "Las" : "Los"} ${many(key)}`,
    /** "primer turno" / "primera cita" */
    primer: (key: TermKey) => `${f(key) ? "primera" : "primer"} ${one(key)}`,
    /** "un turno" / "una cita" */
    un: (key: TermKey) => `${f(key) ? "una" : "un"} ${one(key)}`,
    /** "Un turno" / "Una cita" */
    Un: (key: TermKey) => `${f(key) ? "Una" : "Un"} ${one(key)}`,
    /** "del turno" / "de la cita" */
    del: (key: TermKey) => `${f(key) ? "de la" : "del"} ${one(key)}`,
    /** "al turno" / "a la cita" */
    al: (key: TermKey) => `${f(key) ? "a la" : "al"} ${one(key)}`,
    /** "ese turno" / "esa cita" */
    ese: (key: TermKey) => `${f(key) ? "esa" : "ese"} ${one(key)}`,
    /** "este turno" / "esta cita" */
    este: (key: TermKey) => `${f(key) ? "esta" : "este"} ${one(key)}`,
    /** "otro turno" / "otra cita" */
    otro: (key: TermKey) => `${f(key) ? "otra" : "otro"} ${one(key)}`,
    /** "lo" / "la", el pronombre que lo retoma: "falta que lo confirme". */
    lo: (key: TermKey) => (f(key) ? "la" : "lo"),
    /** La terminación de un adjetivo que concuerda: "confirmad" + w.o("turno"). */
    o: (key: TermKey) => (f(key) ? "a" : "o"),
    /** Lo mismo en plural: "confirmad" + w.os("turno"). */
    os: (key: TermKey) => (f(key) ? "as" : "os"),
  };
}

export type Words = ReturnType<typeof words>;
