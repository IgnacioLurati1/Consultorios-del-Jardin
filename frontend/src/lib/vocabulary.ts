/**
 * Las palabras del rubro, del lado de la pantalla.
 *
 * Es el espejo de `backend/src/shared/vocabulary.ts`: las mismas seis palabras, con su
 * plural y su género, y los mismos ayudantes para escribir con ellas. Están las dos copias
 * porque una arma los mails en el servidor y la otra los textos en el navegador; las
 * pruebas de los dos lados fijan los mismos casos.
 *
 * "Lugar" y "sala" arrancan diciendo lo mismo, "consultorio", y no son lo mismo: el lugar
 * es el negocio y la sala es donde se atiende.
 */

export const TERM_KEYS = ["turno", "profesional", "paciente", "lugar", "sala", "especialidad", "sucursal"] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export interface Term {
  one: string;
  many: string;
  gender: "m" | "f";
}

export type Vocabulary = Record<TermKey, Term>;

export const DEFAULT_VOCABULARY: Vocabulary = {
  turno: { one: "turno", many: "turnos", gender: "m" },
  profesional: { one: "profesional", many: "profesionales", gender: "m" },
  paciente: { one: "paciente", many: "pacientes", gender: "m" },
  lugar: { one: "consultorio", many: "consultorios", gender: "m" },
  sala: { one: "consultorio", many: "consultorios", gender: "m" },
  especialidad: { one: "especialidad", many: "especialidades", gender: "f" },
  sucursal: { one: "sucursal", many: "sucursales", gender: "f" },
};

/** Lo que llegó del servidor, completo: lo que falta o viene roto toma lo de siempre. */
export function vocabularyFrom(input: unknown): Vocabulary {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = {} as Vocabulary;

  for (const key of TERM_KEYS) {
    const term = raw[key] as Partial<Term> | undefined;
    const ok =
      term &&
      typeof term.one === "string" &&
      term.one.trim() &&
      typeof term.many === "string" &&
      term.many.trim() &&
      (term.gender === "m" || term.gender === "f");
    out[key] = ok ? { one: term.one!, many: term.many!, gender: term.gender! } : DEFAULT_VOCABULARY[key];
  }

  return out;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Las palabras, listas para escribir con ellas. Ver el servidor para el detalle: `w.turno`
 * es la palabra, `w.Turno` con mayúscula, `w.el("turno")` lleva el artículo y `w.o("turno")`
 * es la terminación de un adjetivo que concuerda.
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

    el: (key: TermKey) => `${f(key) ? "la" : "el"} ${one(key)}`,
    El: (key: TermKey) => `${f(key) ? "La" : "El"} ${one(key)}`,
    los: (key: TermKey) => `${f(key) ? "las" : "los"} ${many(key)}`,
    Los: (key: TermKey) => `${f(key) ? "Las" : "Los"} ${many(key)}`,
    un: (key: TermKey) => `${f(key) ? "una" : "un"} ${one(key)}`,
    Un: (key: TermKey) => `${f(key) ? "Una" : "Un"} ${one(key)}`,
    del: (key: TermKey) => `${f(key) ? "de la" : "del"} ${one(key)}`,
    al: (key: TermKey) => `${f(key) ? "a la" : "al"} ${one(key)}`,
    ese: (key: TermKey) => `${f(key) ? "esa" : "ese"} ${one(key)}`,
    este: (key: TermKey) => `${f(key) ? "esta" : "este"} ${one(key)}`,
    otro: (key: TermKey) => `${f(key) ? "otra" : "otro"} ${one(key)}`,
    primer: (key: TermKey) => `${f(key) ? "primera" : "primer"} ${one(key)}`,
    lo: (key: TermKey) => (f(key) ? "la" : "lo"),
    o: (key: TermKey) => (f(key) ? "a" : "o"),
    os: (key: TermKey) => (f(key) ? "as" : "os"),
  };
}

export type Words = ReturnType<typeof words>;
