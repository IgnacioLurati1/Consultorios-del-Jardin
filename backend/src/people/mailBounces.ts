import { EntityManager } from "@mikro-orm/core";
import { BouncedEmail } from "./bouncedEmail.entity.js";
import { Person } from "./people.entity.js";
import { NotificationService } from "../notifications/notifications.service.js";
import MailService from "../config/mailer.js";
import { escapeHtml, note, paragraph, title } from "../config/mailTemplate.js";

/**
 * Las direcciones que rebotaron, traídas del proveedor de correo.
 *
 * Es la única comprobación que dice la verdad sobre una casilla. El dominio se puede mirar
 * de antemano (ver emailCheck), pero si existe adentro de ese dominio solo se sabe después
 * de escribirle: "algo8231jas@gmail.com" es un dominio perfecto y una casilla que no
 * existe.
 *
 * El proveedor anota el rebote alrededor de un minuto después del envío y deja de
 * escribirle a esa dirección para siempre. Acá se trae esa lista cada tanto, se guarda
 * (ver BouncedEmail) y se le avisa al profesional que cargó a esa persona, que es el único
 * que puede arreglarlo.
 */

const BREVO_BLOCKED = "https://api.brevo.com/v3/smtp/blockedContacts";

/**
 * Cuánto para atrás se pregunta en cada vuelta.
 *
 * Un mes y no unos días, aunque la vuelta sea por hora. Lo que se pregunta es una lista
 * corta y cuesta lo mismo pedirla entera, y así un servidor apagado una semana, o el
 * proveedor caído un rato largo, no se lleva puesto ningún rebote: cuando vuelve, la
 * misma consulta los trae a todos.
 */
const LOOKBACK_DAYS = 30;

/** Cuánto para atrás pregunta la primera vuelta, cuando todavía no hay nada guardado. */
const FIRST_RUN_DAYS = 365;

/** Tope de direcciones por vuelta. Un consultorio no rebota cien mails en una semana. */
const PAGE = 100;

type Blocked = { email: string; bouncedAt: Date; reason: string | null };

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Le pide al proveedor las direcciones que dejó de usar por rebote duro.
 *
 * Devuelve null si no se pudo preguntar, que no es lo mismo que "no rebotó ninguna": sin
 * clave, con el proveedor caído o con la red cortada, acá no se sabe nada y no se toca
 * nada.
 */
export async function fetchBounced(now = new Date(), days = LOOKBACK_DAYS): Promise<Blocked[] | null> {
  const key = process.env.BREVO_KEY;
  if (!key) return null;

  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const url = `${BREVO_BLOCKED}?limit=${PAGE}&offset=0&startDate=${day(from)}&endDate=${day(now)}`;

  try {
    const response = await fetch(url, { headers: { "api-key": key, accept: "application/json" } });
    if (!response.ok) {
      console.error(`No se pudo leer los rebotes (${response.status})`);
      return null;
    }

    const data = (await response.json()) as { contacts?: Array<{ email: string; blockedAt: string; reason?: { code?: string; message?: string } }> };

    return (data.contacts ?? [])
      // Solo el rebote duro. Quien se dio de baja de los mails es otra cosa: su casilla
      // existe, y su paciente no tiene nada mal cargado.
      .filter((contact) => contact.reason?.code === "hardBounce")
      .map((contact) => ({
        email: String(contact.email).toLowerCase(),
        bouncedAt: new Date(contact.blockedAt),
        reason: contact.reason?.message ?? null,
      }));
  } catch (error) {
    console.error("No se pudo leer los rebotes:", error);
    return null;
  }
}

/** ¿Esta dirección ya rebotó alguna vez? */
export async function hasBounced(em: EntityManager, email: string): Promise<boolean> {
  return !!(await em.findOne(BouncedEmail, { email: String(email).toLowerCase() }));
}

/** Las direcciones rebotadas, para que las pantallas marquen la fila. */
export async function bouncedEmails(em: EntityManager): Promise<string[]> {
  const rows = await em.find(BouncedEmail, {});
  return rows.map((row) => row.email);
}

/**
 * El aviso a quien cargó a esa persona.
 *
 * Va al profesional que la dio de alta, que es el que tiene el dato bien o sabe a quién
 * preguntárselo. Si la persona se registró sola no lo cargó nadie, así que no hay a quién
 * avisarle: queda marcada en el listado de la administración y nada más.
 */
async function warn(em: EntityManager, entry: BouncedEmail): Promise<boolean> {
  const person = await em.findOne(Person, { email: entry.email });
  if (!person?.createdBy) return false;

  const loader = await em.findOne(Person, { email: person.createdBy });
  if (!loader || !loader.active) return false;

  const name = `${person.name ?? ""} ${person.surname ?? ""}`.trim() || entry.email;

  await new NotificationService().notify(loader.email, {
    eventKey: `rebote:${entry.email}`,
    title: "Un correo no existe",
    body: `${name} no recibe nada. La dirección ${entry.email} no existe.`,
    tone: "warn",
    target: "appointments",
  });

  const mail = new MailService();
  const html = [
    title("Un correo cargado no existe"),
    paragraph(
      `<strong>${escapeHtml(name)}</strong> no recibe el turno ni el recordatorio. La dirección cargada, ` +
        `<strong>${escapeHtml(entry.email)}</strong>, no existe.`
    ),
    note("Se corrige desde su ficha, en la lista de pacientes."),
  ].join("");

  await mail.sendMail(await mail.createMessage(loader.email, "Un correo cargado no existe", html));
  return true;
}

/**
 * Trae los rebotes nuevos, los guarda y avisa.
 *
 * Idempotente: lo que ya estaba guardado no se vuelve a guardar y lo que ya se avisó no se
 * vuelve a avisar, así que correrlo de más no molesta a nadie.
 *
 * La primera vuelta no avisa nada, solo marca. Ver abajo.
 */
export async function syncBounces(em: EntityManager, now = new Date()): Promise<{ added: number; warned: number }> {
  // La primera vuelta pregunta por todo lo que el proveedor tenga guardado, no por el
  // último mes: los correos mal cargados que ya rebotaron son justamente los que hay que
  // encontrar el día que esto se publica. De ahí en más, un mes sobra.
  const primera = (await em.count(BouncedEmail, {})) === 0;
  const bounced = await fetchBounced(now, primera ? FIRST_RUN_DAYS : LOOKBACK_DAYS);
  if (!bounced) return { added: 0, warned: 0 };

  let added = 0;
  let warned = 0;

  for (const contact of bounced) {
    let entry = await em.findOne(BouncedEmail, { email: contact.email });

    if (!entry) {
      entry = em.create(BouncedEmail, {
        email: contact.email,
        bouncedAt: contact.bouncedAt,
        reason: contact.reason,
        notified: false,
      });
      added += 1;
    }

    // La primera vuelta entra callada. Trae el año entero, y avisar de golpe de cada
    // correo que rebotó alguna vez sería mandarle a cada profesional una pila de mails
    // sobre fichas viejas. Quedan marcadas en rojo en la lista, que es donde se ven, y
    // los avisos empiezan con el primer rebote de acá en adelante.
    //
    // La marca se pone haya avisado o no. Si no había a quién avisarle, no va a haberlo
    // la vuelta que viene tampoco, y lo que no se puede es volver a intentarlo cada hora.
    if (!entry.notified) {
      if (!primera && (await warn(em, entry))) warned += 1;
      entry.notified = true;
    }
  }

  await em.flush();
  return { added, warned };
}
