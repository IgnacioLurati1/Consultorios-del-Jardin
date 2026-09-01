import dotenv from "dotenv";
import { shell, toPlainText } from "./mailTemplate.js";

dotenv.config();

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/** Cómo firma el consultorio sus mails en la bandeja de entrada. */
const SENDER_NAME = "Consultorios del Jardín";

/** Un mail listo para mandar. Es nuestro, no de la librería del proveedor. */
export interface MailMessage {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Envío de mails, contra la API de Brevo.
 *
 * Se habla por HTTP y no con el SDK del proveedor: es un solo POST, y así cambiar de
 * servicio otra vez es reescribir este archivo y nada más. El resto de la aplicación
 * arma mensajes con `createMessage` y los manda con `sendMail`, sin saber quién los
 * entrega.
 */
export default class MailService {
  /**
   * Manda el mail. Devuelve si salió: los envíos masivos (recordatorios) ignoran el
   * resultado y siguen, pero el formulario de contacto necesita saberlo para no
   * decirle "listo" a alguien cuyo mensaje nunca llegó.
   */
  async sendMail(msg: MailMessage): Promise<boolean> {
    const key = process.env.BREVO_KEY;

    if (!key) {
      console.error("Falta BREVO_KEY: no se mandó el mail a", msg.to);
      return false;
    }

    try {
      const response = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: msg.from },
          to: [{ email: msg.to }],
          replyTo: { email: msg.replyTo },
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
        }),
      });

      if (!response.ok) {
        // El cuerpo del error dice exactamente qué rechazó (remitente sin verificar,
        // crédito agotado, destinatario inválido): sin eso, depurar es adivinar.
        const detail = await response.text();
        console.error(`Error al enviar email (${response.status}) a ${msg.to}:`, detail);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error al enviar email a", msg.to, error);
      return false;
    }
  }

  /**
   * Arma el mail con la plantilla del consultorio: quien lo llama escribe solo el
   * contenido, el sobre lo pone `shell`.
   *
   * `replyTo` se puede pisar: el formulario de contacto manda desde la casilla del
   * consultorio (la única verificada) pero necesita que "Responder" le llegue a la
   * persona que escribió.
   */
  async createMessage(
    to: string,
    subject: string,
    htmlContent: string,
    options: { replyTo?: string } = {}
  ): Promise<MailMessage> {
    const html = shell(htmlContent, { baseUrl: process.env.BASE_URL, mail: process.env.MAIL });

    return {
      to,
      from: process.env.MAIL as string,
      replyTo: options.replyTo ?? (process.env.MAIL as string),
      subject,
      html,
      text: toPlainText(html),
    };
  }
}
