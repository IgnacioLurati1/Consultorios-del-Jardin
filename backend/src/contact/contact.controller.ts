import { Request, Response } from "express";
import MailService from "../config/mailer.js";
import { escapeHtml, factsCard, note, paragraph, quote, title } from "../config/mailTemplate.js";
import { AppError, badRequest, sendError } from "../shared/errors.js";

const mailService = new MailService();

/** A dónde llegan las consultas. Es la misma casilla verificada que firma los mails. */
const INBOX = process.env.CONTACT_MAIL || (process.env.MAIL as string);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Motivos posibles. Es una lista cerrada para que el asunto del mail sea siempre
 * clasificable y no lo escriba quien manda el formulario.
 */
const REASONS: Record<string, string> = {
  turnos: "Turnos",
  profesional: "Quiero atender en el consultorio",
  sugerencia: "Sugerencia o reclamo",
  otro: "Otra consulta",
};

const LIMITS = { name: 80, email: 120, phone: 30, message: 2000 };

interface ContactData {
  name: string;
  email: string;
  phone: string;
  reason: string;
  message: string;
}

function validate(body: any): ContactData {
  // Campo trampa: es invisible en el formulario, así que si viene con algo escrito
  // lo llenó un bot. Se corta acá y no se manda ningún mail.
  if (typeof body?.website === "string" && body.website.trim()) throw badRequest("No pudimos enviar el mensaje");

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const message = String(body?.message ?? "").trim();

  if (name.length < 2) throw badRequest("Escribí tu nombre");
  if (name.length > LIMITS.name) throw badRequest("El nombre es demasiado largo");

  if (!EMAIL_REGEX.test(email)) throw badRequest("Ese email no parece válido. Revisá que tenga @ y un punto");
  if (email.length > LIMITS.email) throw badRequest("El email es demasiado largo");

  if (phone && !/^[\d\s()+-]{6,30}$/.test(phone)) throw badRequest("Ese teléfono no parece válido");

  if (!REASONS[reason]) throw badRequest("Elegí un motivo para la consulta");

  if (message.length < 10) throw badRequest("Contanos un poco más: el mensaje es muy corto");
  if (message.length > LIMITS.message) throw badRequest("El mensaje es demasiado largo. Probá resumirlo");

  return { name, email, phone, reason, message };
}

/** La copia que llega a la casilla del consultorio: primero quién escribió, después qué dijo. */
function inboxHtml(data: ContactData): string {
  return [
    title("Consulta desde la página"),
    factsCard(REASONS[data.reason], [
      { label: "Nombre", value: data.name },
      { label: "Email", value: data.email },
      { label: "Teléfono", value: data.phone },
    ]),
    quote(data.message),
    note(`Si respondés este mail le llega directo a ${escapeHtml(data.email)}.`),
  ].join("");
}

/** El acuse para quien escribió: que sepa que llegó y con qué texto. */
function receiptHtml(data: ContactData): string {
  return [
    title("Recibimos tu mensaje"),
    paragraph(
      `Hola ${escapeHtml(data.name)}, gracias por escribirnos. Te respondemos a este mismo mail dentro del horario de atención.`
    ),
    paragraph(`Esto fue lo que nos contaste sobre <strong>${escapeHtml(REASONS[data.reason].toLowerCase())}</strong>:`),
    quote(data.message),
    note("Si no fuiste vos quien escribió, ignorá este mensaje."),
  ].join("");
}

/**
 * Consulta del formulario de contacto.
 *
 * El mail sale desde la casilla del consultorio (es la única verificada en Brevo) y
 * lleva el `replyTo` de quien escribió: así responder desde el correo le llega a la
 * persona y no a nosotros mismos.
 */
export async function sendContactMessage(req: Request, res: Response) {
  try {
    const data = validate(req.body);

    const toInbox = await mailService.createMessage(
      INBOX,
      `Contacto web · ${REASONS[data.reason]} · ${data.name}`,
      inboxHtml(data),
      { replyTo: data.email }
    );
    const delivered = await mailService.sendMail(toInbox);
    // Si el envío falla, decir "listo" es lo peor que se puede hacer: la persona se
    // queda esperando respuesta a un mensaje que nunca llegó.
    if (!delivered) throw new AppError("No pudimos enviar el mensaje. Probá de nuevo en un rato", 502);

    // El acuse es una cortesía: si falla, la consulta ya llegó igual y no tiene sentido
    // decirle a la persona que no se envió.
    const receipt = await mailService.createMessage(data.email, "Recibimos tu consulta", receiptHtml(data));
    mailService.sendMail(receipt).catch(() => undefined);

    return res.status(200).json({ message: "Mensaje enviado" });
  } catch (error) {
    return sendError(res, error, { fallback: "No pudimos enviar el mensaje. Probá de nuevo en un rato" });
  }
}
