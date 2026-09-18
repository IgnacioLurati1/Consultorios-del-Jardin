import { EntityManager } from "@mikro-orm/core";
import { BouncedEmail } from "./bouncedEmail.entity.js";
import { Person } from "./people.entity.js";
import { NotificationService } from "../notifications/notifications.service.js";
import MailService from "../config/mailer.js";
import { escapeHtml, note, paragraph, title } from "../config/mailTemplate.js";

/**
 * Los mails que volvieron sin entregarse, traídos del proveedor de correo.
 *
 * Es la única comprobación que dice la verdad sobre una casilla. El dominio se puede mirar
 * de antemano (ver emailCheck), pero si existe adentro de ese dominio solo se sabe después
 * de escribirle: "algo8231jas@gmail.com" es un dominio perfecto y una casilla que no
 * existe.
 *
 * Lo que se lee es el motivo que escribió el servidor del otro lado, y no solamente que
 * rebotó. "No existe" y "no se pudo entregar" son cosas distintas: un Hotmail que rechaza
 * al remitente, una casilla llena o una cuenta dada de baja rebotan igual que una
 * dirección inventada, y tratarlos igual marcaba correos perfectos como inexistentes.
 *
 * El proveedor anota el rebote alrededor de un minuto después del envío y deja de
 * escribirle a esa dirección. Acá se trae esa lista cada tanto, se guarda (ver
 * BouncedEmail) y se le avisa al profesional que cargó a esa persona.
 */

const BREVO_EVENTS = "https://api.brevo.com/v3/smtp/statistics/events";

/** Cuánto para atrás se pregunta en cada vuelta. De sobra para una vuelta por hora. */
const LOOKBACK_DAYS = 30;

/**
 * Cuánto para atrás pregunta la primera vuelta, cuando todavía no hay nada guardado.
 *
 * Noventa días es el tope que acepta el proveedor: con un rango más grande contesta que no
 * puede.
 */
const FIRST_RUN_DAYS = 90;

/** Tope de eventos por vuelta. Un consultorio no rebota cien mails en un mes. */
const PAGE = 100;

/**
 * Cómo dice un servidor de correo que esa casilla no existe.
 *
 * Son las formas que contestan los proveedores de acá: Gmail y Outlook con el código
 * 5.1.1, y el resto con estas palabras. Todo lo que no entre acá se guarda como un rebote
 * cualquiera, que no afirma nada sobre la dirección.
 */
const MISSING_PATTERNS = [
  /\b5\.1\.1\b/,
  /does\s?n[o']?t\s+exist/i,
  /no\s+such\s+user/i,
  /user\s+unknown/i,
  /unknown\s+user/i,
  /recipient\s+(address\s+)?(not\s+found|rejected)/i,
  /invalid\s+recipient/i,
  /address\s+not\s+found/i,
  /destinatario?\s+no\s+existe/i,
];

export type BounceKind = "missing" | "blocked";

type Bounce = { email: string; bouncedAt: Date; reason: string | null; kind: BounceKind };

const day = (date: Date) => date.toISOString().slice(0, 10);

/** ¿El servidor del otro lado dijo que esa casilla no existe? */
export function classifyBounce(reason: string | null | undefined): BounceKind {
  const text = String(reason ?? "");
  return MISSING_PATTERNS.some((pattern) => pattern.test(text)) ? "missing" : "blocked";
}

/**
 * Le pide al proveedor los mails que volvieron sin entregarse, con el motivo de cada uno.
 *
 * Devuelve null si no se pudo preguntar, que no es lo mismo que "no rebotó ninguno": sin
 * clave, con el proveedor caído o con la red cortada, acá no se sabe nada y no se toca
 * nada.
 *
 * Una misma dirección puede venir varias veces, una por envío. Queda la última, que es la
 * que cuenta qué pasa hoy con esa casilla.
 */
export async function fetchBounced(now = new Date(), days = LOOKBACK_DAYS): Promise<Bounce[] | null> {
  const key = process.env.BREVO_KEY;
  if (!key) return null;

  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const url = `${BREVO_EVENTS}?limit=${PAGE}&offset=0&event=hardBounces&startDate=${day(from)}&endDate=${day(now)}`;

  try {
    const response = await fetch(url, { headers: { "api-key": key, accept: "application/json" } });
    if (!response.ok) {
      console.error(`No se pudo leer los rebotes (${response.status})`);
      return null;
    }

    const data = (await response.json()) as { events?: Array<{ email: string; date: string; reason?: string }> };

    const latest = new Map<string, Bounce>();

    for (const event of data.events ?? []) {
      const email = String(event.email).toLowerCase();
      const bouncedAt = new Date(event.date);
      const previous = latest.get(email);
      if (previous && previous.bouncedAt >= bouncedAt) continue;

      latest.set(email, { email, bouncedAt, reason: event.reason ?? null, kind: classifyBounce(event.reason) });
    }

    return [...latest.values()];
  } catch (error) {
    console.error("No se pudo leer los rebotes:", error);
    return null;
  }
}

/**
 * ¿Le llegó algo a esa dirección después del rebote?
 *
 * Es lo que borra la marca sola. Una casilla llena se vacía, una cuenta vuelve, un
 * proveedor deja de rechazar al remitente: el día que un mensaje entra, el problema se
 * terminó y nadie tiene que acordarse de sacar el cartelito a mano.
 *
 * Ante la duda contesta que no: sin poder preguntar, la marca se queda, que es lo que ya
 * se sabía.
 */
async function deliveredAfter(email: string, since: Date, now = new Date()): Promise<boolean> {
  const key = process.env.BREVO_KEY;
  if (!key) return false;

  // La ventana arranca en el rebote, y nunca más atrás del tope que acepta el proveedor.
  const oldest = new Date(now.getTime() - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000);
  const from = since > oldest ? since : oldest;

  const url =
    `${BREVO_EVENTS}?limit=1&offset=0&event=delivered&email=${encodeURIComponent(email)}` +
    `&startDate=${day(from)}&endDate=${day(now)}`;

  try {
    const response = await fetch(url, { headers: { "api-key": key, accept: "application/json" } });
    if (!response.ok) return false;

    const data = (await response.json()) as { events?: Array<{ date: string }> };
    return (data.events ?? []).some((event) => new Date(event.date) > since);
  } catch {
    return false;
  }
}

/**
 * ¿Esta dirección no existe?
 *
 * Solo las que el servidor del otro lado dio por inexistentes. Una casilla real que no
 * recibe mails sigue siendo una casilla real, y frenar un alta por eso sería frenarla por
 * un problema que no es de quien la carga.
 */
export async function hasBounced(em: EntityManager, email: string): Promise<boolean> {
  const entry = await em.findOne(BouncedEmail, { email: String(email).toLowerCase() });
  return entry?.kind === "missing";
}

/** Las direcciones con problemas, para que las pantallas marquen la fila. */
export async function bouncedEmails(em: EntityManager): Promise<Array<{ email: string; kind: BounceKind }>> {
  const rows = await em.find(BouncedEmail, {});
  return rows.map((row) => ({ email: row.email, kind: row.kind ?? "missing" }));
}

/**
 * El aviso a quien cargó a esa persona.
 *
 * Va al profesional que la dio de alta, que es el que tiene el dato bien o sabe a quién
 * preguntárselo. Si la persona se registró sola no lo cargó nadie, así que no hay a quién
 * avisarle: queda marcada en el listado de la administración y nada más.
 *
 * El texto cambia según qué pasó. Una dirección que no existe se corrige; una que existe y
 * no recibe no se arregla desde acá, y mandar a corregirla sería mandar a buscar un error
 * que no está.
 */
async function warn(em: EntityManager, entry: BouncedEmail): Promise<boolean> {
  const person = await em.findOne(Person, { email: entry.email });
  if (!person?.createdBy) return false;

  const loader = await em.findOne(Person, { email: person.createdBy });
  if (!loader || !loader.active) return false;

  const name = `${person.name ?? ""} ${person.surname ?? ""}`.trim() || entry.email;
  const missing = entry.kind === "missing";
  const subject = missing ? "Un correo cargado no existe" : "Un correo cargado no recibe los mails";

  await new NotificationService().notify(loader.email, {
    eventKey: `rebote:${entry.email}`,
    title: missing ? "Un correo no existe" : "Un correo no recibe los mails",
    body: missing
      ? `${name} no recibe nada. La dirección ${entry.email} no existe.`
      : `Los mails para ${name} vuelven sin entregarse, aunque la dirección existe.`,
    tone: "warn",
    target: "appointments",
  });

  const mail = new MailService();
  const html = [
    title(subject),
    paragraph(
      missing
        ? `<strong>${escapeHtml(name)}</strong> no recibe el turno ni el recordatorio. La dirección cargada, ` +
            `<strong>${escapeHtml(entry.email)}</strong>, no existe.`
        : `<strong>${escapeHtml(name)}</strong> no recibe el turno ni el recordatorio. La dirección ` +
            `<strong>${escapeHtml(entry.email)}</strong> existe, pero los mensajes vuelven sin entregarse.`
    ),
    note(missing ? "Se corrige desde su ficha, en la lista de pacientes." : "Conviene avisarle por teléfono y confirmar la dirección."),
  ].join("");

  await mail.sendMail(await mail.createMessage(loader.email, subject, html));
  return true;
}

/**
 * Trae los rebotes, los guarda y avisa.
 *
 * Idempotente: lo que ya estaba guardado no se vuelve a guardar y lo que ya se avisó no se
 * vuelve a avisar, así que correrlo de más no molesta a nadie. Lo que sí se vuelve a leer
 * cada vuelta es el motivo, que es lo que decide si esa dirección figura como inexistente.
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
        kind: contact.kind,
        notified: false,
      });
      added += 1;
    } else {
      // El motivo se relee cada vuelta. Sin esto, una dirección guardada con la regla
      // vieja se quedaba para siempre con la etiqueta equivocada.
      entry.kind = contact.kind;
      entry.reason = contact.reason;
    }

    // La primera vuelta entra callada. Trae noventa días, y avisar de golpe de cada correo
    // que rebotó alguna vez sería mandarle a cada profesional una pila de mails sobre
    // fichas viejas. Quedan marcadas en la lista, que es donde se ven, y los avisos
    // empiezan con el primer rebote de acá en adelante.
    //
    // La marca se pone haya avisado o no. Si no había a quién avisarle, no va a haberlo la
    // vuelta que viene tampoco, y lo que no se puede es volver a intentarlo cada hora.
    if (!entry.notified) {
      if (!primera && (await warn(em, entry))) warned += 1;
      entry.notified = true;
    }
  }

  // Y lo que volvió a andar deja de estar marcado. Sin esto, una casilla que se arregló
  // —se vació, se desbloqueó, volvió a existir— quedaba con el cartelito para siempre.
  for (const entry of await em.find(BouncedEmail, {})) {
    if (await deliveredAfter(entry.email, entry.bouncedAt, now)) em.remove(entry);
  }

  await em.flush();
  return { added, warned };
}
