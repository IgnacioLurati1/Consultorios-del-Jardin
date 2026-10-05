import { forbidden } from "../shared/errors.js";
import type { Policies } from "../shared/policies.js";
import type { Words } from "../shared/vocabulary.js";
import { officeWords, policies } from "./installation.service.js";

/**
 * Las reglas de funcionamiento, donde se aplican.
 *
 * Cada servicio que hace algo que una regla puede prohibir pregunta acá antes de hacerlo.
 * La pantalla también esconde el botón, pero el control de verdad es este: la app instalada
 * puede ser vieja, y un pedido puede no venir de ninguna pantalla.
 *
 * Los mensajes salen con las palabras del rubro y dicen qué pasa en este consultorio, no
 * quién lo decidió ni cómo se cambia: la persona que los lee no puede cambiarlo.
 */

export async function rulesNow(): Promise<{ p: Policies; w: Words }> {
  const [p, w] = await Promise.all([policies(), officeWords()]);
  return { p, w };
}

type Check = (p: Policies) => boolean;

/**
 * Tira con el mensaje si la regla no lo permite.
 *
 * El mensaje se arma con las palabras del rubro, por eso es una función.
 */
export async function requireRule(allowed: Check, message: (w: Words) => string): Promise<void> {
  const { p, w } = await rulesNow();
  if (!allowed(p)) throw forbidden(message(w), "RULE_OFF");
}

/* ---------- los mensajes de cada regla, en un solo lugar ---------- */

export const RULE_MESSAGES = {
  patientBooking: (w: Words) => `${w.Los("turno")} se piden directamente ${w.al("lugar")}`,
  patientCancel: (w: Words) => `Para cancelar ${w.un("turno")} hay que avisarle ${w.al("lugar")}`,
  cancelNotice: (w: Words, hours: number) =>
    `${w.Los("turno")} se cancelan con ${hours} ${hours === 1 ? "hora" : "horas"} de anticipación como mínimo. ` +
    `Para cancelar ${w.este("turno")} hay que avisarle ${w.al("lugar")}`,
  openSignup: (w: Words) => `Para tener una cuenta hay que pedírsela ${w.al("lugar")}`,
  proCreate: (w: Words) => `En este ${w.lugar} ${w.los("turno")} no se cargan a mano`,
  proOverbook: (w: Words) => `En este ${w.lugar} no se dan ${w.turnos} fuera del horario de atención`,
  proEdit: (w: Words) => `En este ${w.lugar} ${w.los("turno")} no se modifican una vez dad${w.os("turno")}`,
  proCancel: (w: Words) => `En este ${w.lugar} ${w.los("turno")} confirmad${w.os("turno")} no se cancelan desde el panel`,
  proPatients: (w: Words) => `En este ${w.lugar} no se cargan ${w.pacientes} sin cuenta`,
  proRecurring: (w: Words) => `En este ${w.lugar} no se arman ${w.turnos} que se repiten`,
  proCalendar: (w: Words) => `En este ${w.lugar} la agenda no se importa ni se exporta`,
  proDeleteHistory: (w: Words) => `En este ${w.lugar} no se borran ${w.los("turno")} de ${w.un("paciente")}`,
  forcedSetting: (w: Words) => `Eso lo define ${w.el("lugar")} para todos`,
  adminBooking: (w: Words) => `En este ${w.lugar} la administración no da ${w.turnos}`,
  proVacations: (w: Words) => `En este ${w.lugar} las vacaciones las carga la administración`,
  adminVacations: (w: Words) => `En este ${w.lugar} las vacaciones las carga cada ${w.profesional}`,
  rentOff: () => "Esa sección no está disponible",
  assistantOff: () => "El asistente no está disponible",
};
