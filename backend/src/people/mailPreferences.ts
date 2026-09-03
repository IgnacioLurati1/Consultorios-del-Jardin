import { Person } from "./people.entity.js";
import { badRequest } from "../shared/errors.js";

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
 * Es corta porque el consultorio le escribe poco a quien atiende: casi todos los mails
 * son para el paciente (que pidió turno, que se lo confirmaron, el recordatorio del día
 * anterior). Al profesional le llega esto, y aparte los mails de la cuenta —bienvenida,
 * recuperar la contraseña, el aviso de que la cuenta quedó cerrada por seguridad—, que
 * no se pueden apagar: no son novedades del día a día, son el único camino para volver a
 * entrar o para enterarse de que algo pasó con la cuenta.
 */
export const PROFESSIONAL_MAILS: MailKind[] = [
  {
    key: "slot-freed",
    label: "Se te liberó un horario",
    description: "Cuando un paciente cancela un turno que ya estaba confirmado.",
  },
];

const KNOWN = new Map(PROFESSIONAL_MAILS.map((mail) => [mail.key, mail]));

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
export function professionalMailSettings(person: Person) {
  return PROFESSIONAL_MAILS.map((mail) => ({ ...mail, enabled: wantsMail(person, mail.key) }));
}
