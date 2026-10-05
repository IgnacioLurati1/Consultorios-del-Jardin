import { Person } from "./people.entity.js";
import { badRequest } from "../shared/errors.js";
import { words, type Words } from "../shared/vocabulary.js";

/** Un aviso por mail que la persona puede apagar. */
export interface MailKind {
  key: string;
  label: string;
  /** Qué lo dispara, en una línea. Es lo que se lee al lado del switch. */
  description: string;
}

/**
 * Los avisos que un profesional puede apagar.
 *
 * Son los tres hechos que le pasan de afuera: un paciente que saca un turno, uno que
 * cancela uno confirmado y uno que da de baja un pedido sin contestar. El resto de lo que
 * ocurre en su agenda lo hace él, y contárselo sería contarle lo que acaba de hacer.
 *
 * Aparte de estos le llegan los mails de la cuenta —bienvenida,
 * recuperar la contraseña, el aviso de que la cuenta quedó cerrada por seguridad—, que
 * no se pueden apagar: no son novedades del día a día, son el único camino para volver a
 * entrar o para enterarse de que algo pasó con la cuenta.
 */
export function professionalMails(w: Words = words()): MailKind[] {
  return [
    {
      key: "new-booking",
      label: `Te sacaron ${w.un("turno")}`,
      description: `Cuando ${w.un("paciente")} saca ${w.un("turno")} con vos.`,
    },
    {
      key: "slot-freed",
      label: "Se te liberó un horario",
      description: `Cuando ${w.un("paciente")} cancela ${w.un("turno")} que ya estaba confirmad${w.o("turno")}.`,
    },
    {
      key: "request-withdrawn",
      label: "Se dio de baja un pedido",
      description: `Cuando ${w.un("paciente")} da de baja un pedido que todavía no habías contestado.`,
    },
  ];
}

const KNOWN = new Set(professionalMails().map((mail) => mail.key));

/**
 * Se guardan los apagados y no los prendidos.
 *
 * Con la lista vacía la persona recibe todo, que es como venía funcionando y es lo que
 * espera quien nunca abrió esta pantalla. Guardando los prendidos, en cambio, cada aviso
 * nuevo nacería apagado para todos los que ya existen, y nadie se enteraría de que hay
 * algo que podría estar recibiendo.
 */
export function mutedMails(person: Person): string[] {
  return (person.mailOptOut ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

/** Si hay que mandarle este aviso. Una clave que no conocemos se manda igual. */
export function wantsMail(person: Person, key: string): boolean {
  return !mutedMails(person).includes(key);
}

/**
 * Prende o apaga un aviso. No toca los demás: la pantalla manda un switch por vez y
 * pisar la lista entera haría que dos pestañas abiertas se borren los cambios.
 */
export function setMailPreference(person: Person, key: string, enabled: boolean): void {
  if (!KNOWN.has(key)) throw badRequest("Ese aviso por mail no existe");

  const muted = new Set(mutedMails(person));

  if (enabled) muted.delete(key);
  else muted.add(key);

  person.mailOptOut = muted.size > 0 ? Array.from(muted).join(",") : null;
}

/** El catálogo con el estado de cada aviso, para dibujar los switches. */
export function professionalMailSettings(person: Person, w: Words = words()) {
  return professionalMails(w).map((mail) => ({ ...mail, enabled: wantsMail(person, mail.key) }));
}
