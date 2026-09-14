import { Request, Response } from "express";
import MailService from "../config/mailer.js";
import { escapeHtml, factsCard, note, paragraph, quote, title } from "../config/mailTemplate.js";
import { AppError, badRequest, sendError } from "../shared/errors.js";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { NotificationService } from "../notifications/notifications.service.js";

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
  profesional: "Quiero trabajar en el consultorio",
  sugerencia: "Sugerencia",
  otro: "Otra consulta",
};

/** El motivo de quien quiere sumarse como profesional. Es el único que pide teléfono y acepta CV. */
const APPLICATION = "profesional";

const LIMITS = { name: 80, email: 120, phone: 30, message: 2000 };

interface Cv {
  name: string;
  content: Buffer;
}

interface ContactData {
  name: string;
  email: string;
  phone: string;
  reason: string;
  message: string;
  cv: Cv | null;
}

/**
 * Que el archivo sea lo que dice su nombre.
 *
 * Multer ya dejó pasar solo nombres terminados en .pdf, .doc, .docx u .odt, pero el nombre
 * lo elige quien sube el archivo. Los primeros bytes no: un PDF empieza con "%PDF", un
 * .docx o un .odt son un zip ("PK") y un .doc viejo es un documento OLE. Cualquier otra
 * cosa con ese nombre no se reenvía a la casilla de los administradores.
 */
function looksLikeDocument(file: Buffer): boolean {
  const head = file.subarray(0, 8);
  const pdf = head.subarray(0, 4).toString("latin1") === "%PDF";
  const zip = head[0] === 0x50 && head[1] === 0x4b;
  const ole = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  return pdf || zip || ole;
}

/** El nombre del archivo, sin rutas ni caracteres raros, y corto. Es lo que se ve en el mail. */
function cleanFileName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? "cv";
  const extension = (base.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const stem = base
    .slice(0, base.length - extension.length)
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .trim()
    .slice(0, 60);
  return `${stem || "cv"}${extension}`;
}

function validate(body: any, file?: Express.Multer.File): ContactData {
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

  // Para sumarse al equipo el teléfono es obligatorio: a un profesional se lo llama para
  // la entrevista, no se le contesta un mail.
  if (reason === APPLICATION && !phone) throw badRequest("Falta el teléfono");
  if (phone && !/^[\d\s()+-]{6,30}$/.test(phone)) throw badRequest("Ese teléfono no parece válido");

  if (!REASONS[reason]) throw badRequest("Elegí un motivo para la consulta");

  if (message.length < 10) throw badRequest("Contanos un poco más. El mensaje es muy corto");
  if (message.length > LIMITS.message) throw badRequest("El mensaje es demasiado largo. Probá resumirlo");

  // El CV solo tiene sentido en una postulación. En cualquier otro motivo se ignora.
  let cv: Cv | null = null;
  if (file && reason === APPLICATION) {
    if (!looksLikeDocument(file.buffer)) throw badRequest("El CV tiene que ser PDF o Word");
    cv = { name: cleanFileName(file.originalname), content: file.buffer };
  }

  return { name, email, phone, reason, message, cv };
}

/** La copia que llega a la casilla del consultorio: primero quién escribió, después qué dijo. */
function inboxHtml(data: ContactData): string {
  return [
    title(data.reason === APPLICATION ? "Un profesional quiere sumarse" : "Consulta desde la página"),
    factsCard(REASONS[data.reason], [
      { label: "Nombre", value: data.name },
      { label: "Email", value: data.email },
      { label: "Teléfono", value: data.phone },
      { label: "CV", value: data.cv ? data.cv.name : data.reason === APPLICATION ? "Sin CV" : "" },
    ]),
    quote(data.message),
    data.cv ? note("El CV va adjunto a este mail. El consultorio no guarda una copia.") : "",
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
    paragraph(`Esto fue lo que nos contaste sobre <strong>${escapeHtml(REASONS[data.reason].toLowerCase())}</strong>.`),
    quote(data.message),
    data.cv ? paragraph(`También recibimos tu CV (<strong>${escapeHtml(data.cv.name)}</strong>).`) : "",
    note("Si no fuiste vos quien escribió, ignorá este mensaje."),
  ].join("");
}

/**
 * La postulación también va a cada administrador, por mail y a la campanita.
 *
 * Uno por uno y sin cortar, igual que los avisos de seguridad: que a uno no le llegue no
 * puede dejar sin avisar a los demás. Y nada de esto puede tumbar el envío, que ya salió
 * bien a la casilla del consultorio.
 */
async function tellAdmins(data: ContactData, subject: string, html: string): Promise<void> {
  try {
    const admins = await orm.em.fork().find(Person, { type: "admin", active: true });
    if (admins.length === 0) return;

    const attachments = data.cv ? [{ name: data.cv.name, content: data.cv.content.toString("base64") }] : undefined;
    const message = await mailService.createMessage(INBOX, subject, html, { replyTo: data.email, attachments });

    // La casilla del consultorio ya recibió su copia: si es también la de un
    // administrador, no se le manda dos veces.
    const inbox = String(INBOX ?? "").toLowerCase();
    for (const admin of admins) {
      if (admin.email.toLowerCase() === inbox) continue;
      await mailService.sendMail({ ...message, to: admin.email }).catch(() => undefined);
    }

    await new NotificationService().notifyMany(
      admins.map((admin) => admin.email),
      {
        eventKey: `postulacion:${data.email.toLowerCase()}:${Date.now()}`,
        title: "Nueva postulación de un profesional",
        body: [data.name, data.phone, data.cv ? "CV adjunto en el mail" : "Sin CV"].join(" · "),
        tone: "info",
        target: null,
      }
    );
  } catch (error) {
    console.error("No se pudo avisarle a la administración de una postulación:", error);
  }
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
    const data = validate(req.body, req.file);
    const subject = `Contacto web · ${REASONS[data.reason]} · ${data.name}`;
    const html = inboxHtml(data);
    const attachments = data.cv ? [{ name: data.cv.name, content: data.cv.content.toString("base64") }] : undefined;

    const toInbox = await mailService.createMessage(INBOX, subject, html, { replyTo: data.email, attachments });
    const delivered = await mailService.sendMail(toInbox);
    // Si el envío falla, decir "listo" es lo peor que se puede hacer: la persona se
    // queda esperando respuesta a un mensaje que nunca llegó.
    if (!delivered) throw new AppError("No pudimos enviar el mensaje. Probá de nuevo en un rato", 502);

    if (data.reason === APPLICATION) await tellAdmins(data, subject, html);

    // El acuse es una cortesía: si falla, la consulta ya llegó igual y no tiene sentido
    // decirle a la persona que no se envió.
    const receipt = await mailService.createMessage(data.email, "Recibimos tu consulta", receiptHtml(data));
    mailService.sendMail(receipt).catch(() => undefined);

    return res.status(200).json({ message: "Mensaje enviado" });
  } catch (error) {
    return sendError(res, error, { fallback: "No pudimos enviar el mensaje. Probá de nuevo en un rato" });
  }
}
