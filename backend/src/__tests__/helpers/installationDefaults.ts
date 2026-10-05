import { DEFAULT_POLICIES } from "../../shared/policies.js";

/**
 * La configuración de la instalación tal como arranca, para las pruebas que no prueban la
 * configuración.
 *
 * Esas pruebas usan una base de mentira genérica que contesta lo mismo a todo, y la
 * configuración se lee de la base. Sin esto, cualquier cosa que pregunte por el horizonte o
 * por la baja tardía recibe lo que el doble tenga a mano y la prueba falla por otra cosa.
 *
 * Son los valores por omisión de `installation.entity`, que a su vez son los que el código
 * tenía escritos. `installation.test.ts` comprueba que la entidad los tenga; si alguien
 * cambia uno allá, también hay que cambiarlo acá.
 */
export const DEFAULT_CONFIG = {
  name: "Consultorios del Jardín",
  tagline: "Consultorios en Rosario, con turnos online y elección de profesional y horario.",
  address: "9 de Julio 3672",
  city: "Rosario",
  publicHours: "Lunes a viernes, de 9 a 20",
  instagram: "consultorios_jardin",
  email: "consultoriosjardinok@gmail.com",
  mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.1345729661225!2d-60.677700222686624!3d-32.947456271932246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b7aca0aae14deb%3A0x8faaf2cd4420949f!2s9%20de%20Julio%203672%2C%20S2000%20Rosario%2C%20Santa%20Fe!5e0!3m2!1ses!2sar!4v1789172471192!5m2!1ses!2sar",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=9+de+Julio+3672,+Rosario,+Santa+Fe",
  spaceTour: true,
  visitAdvice: "Se recomienda llegar cinco minutos antes",
  services: ["Psicología", "Psicopedagogía", "Psiquiatría", "Nutrición", "Fonoaudiología"],
  brandHue: null,
  brandSaturation: null,
  heroStyle: "collage",
  homeTemplate: "jardin",
  panelSkin: "jardin",
  homeBlocksGuest: ["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"],
  homeBlocksMember: ["garland", "hero", "yourSpace", "gallery", "services", "location", "footer"],
  assistantTone: "voseo",
  assistantNotes: "",
  vocabulary: {
    turno: { one: "turno", many: "turnos", gender: "m" },
    profesional: { one: "profesional", many: "profesionales", gender: "m" },
    paciente: { one: "paciente", many: "pacientes", gender: "m" },
    lugar: { one: "consultorio", many: "consultorios", gender: "m" },
    sala: { one: "consultorio", many: "consultorios", gender: "m" },
    especialidad: { one: "especialidad", many: "especialidades", gender: "f" },
  },
  bookingWeeksAhead: 1,
  slotStepMinutes: null,
  bufferMinutes: 0,
  realignToOpening: false,
  minNoticeMinutes: 0,
  shortNoticeHours: 24,
  opensSunday: false,
  reminderHoursBefore: null,
  chargesMissed: false,
  maxActiveAppointments: 0,
  waitlistEnabled: true,
  policies: DEFAULT_POLICIES,
  locked: [] as string[],
  updatedAt: new Date(0),
};

import { words } from "../../shared/vocabulary.js";

/** Lo que devuelve el mock del servicio. */
export function installationServiceMock() {
  return {
    config: async () => DEFAULT_CONFIG,
    publicConfig: async () => DEFAULT_CONFIG,
    updateConfig: async () => DEFAULT_CONFIG,
    forget: () => {},
    officeWords: async () => words(),
    cachedWords: () => words(),
    policies: async () => DEFAULT_CONFIG.policies,
    rulesView: async () => ({ groups: [], rules: [], values: {}, locked: [] }),
  };
}
