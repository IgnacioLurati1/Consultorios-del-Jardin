import dotenv from "dotenv";
import sgMail, { MailDataRequired } from "@sendgrid/mail";

dotenv.config();

export default class MailService {
  async sendMail(msg: MailDataRequired) {
    try {
    sgMail.setApiKey(process.env.SENDGRID_KEY as string);
    await sgMail.send(msg);
    } catch (error) {
      console.error("--------------------------- Error al enviar email --------------------------- \n", error); // para depuración por consola en caso de fallos de mails masivos por parte de la api de sendgrid
    }
  }

  async createMessage(to: string, subject: string, htmlContent: string): Promise<MailDataRequired> {
    const baseHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
            .header { background-color: #52b788; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: white; padding: 20px; }
            .footer { background-color: #d8f3dc; padding: 15px; text-align: center; font-size: 12px; color: #2d6a4f; border-radius: 0 0 5px 5px; }
            .header h1 { margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Consultorios Jardín</h1>
            </div>
            <div class="content">
              ${htmlContent}
            </div>
            <div class="footer">
              <p>&copy; 2025 Consultorios Jardín. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const msg: MailDataRequired = {
      to: to,
      from: process.env.MAIL as string,
      replyTo: process.env.MAIL as string,
      subject: subject,
      html: baseHtml,
    };
    return msg;
  }
}
