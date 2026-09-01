/**
 * Cómo se ven los mails del consultorio.
 *
 * Los clientes de correo no son navegadores: Gmail recorta el <style> del <head> en
 * varios de sus clientes, Outlook renderiza con el motor de Word y flexbox y grid no
 * existen. Por eso todo esto son tablas con estilos escritos en cada etiqueta, que es
 * feo de leer pero es lo único que se ve igual en todos lados.
 *
 * Las piezas de acá abajo son las mismas para todos los mails: quien escribe uno nuevo
 * arma el contenido con estos bloques y no vuelve a inventar colores ni márgenes.
 */

/** Los mismos tokens que usa la aplicación, en hexadecimal porque en un mail no hay variables CSS. */
const C = {
  green: "#3b7658",
  greenDark: "#2f5e46",
  greenSoft: "#e8f1ec",
  cream: "#fefae0",
  paper: "#f1f4f6",
  ink: "#1f2a33",
  muted: "#64748b",
  border: "#e2e8f0",
  warnBg: "#fdf3e3",
  warnInk: "#8a5a12",
};

const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";
/** En la web los títulos van en Fraunces; en el correo no hay webfonts, así que serif. */
const SERIF = "Georgia, 'Times New Roman', serif";

const OFFICE = {
  address: "9 de Julio 3672",
  hours: "Lunes a viernes, de 8 a 20",
  instagram: "consultorios_jardin",
};

/** Todo lo que escribió una persona pasa por acá antes de entrar al HTML. */
export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Título del mail. Uno solo por mensaje: es de lo que se trata. */
export function title(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:24px;line-height:1.25;font-weight:normal;color:${C.ink}">${escapeHtml(
    text
  )}</h1>`;
}

/** Párrafo común. Admite HTML porque a veces adentro va un <strong> o un link. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.ink}">${html}</p>`;
}

/** Letra chica: avisos que se leen si hacen falta y no compiten con el mensaje. */
export function note(html: string): string {
  return `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${C.muted}">${html}</p>`;
}

export interface Fact {
  label: string;
  value: string;
}

/**
 * Los datos del turno, que son el motivo del mail.
 *
 * Van en un panel con una barra verde al costado en vez de una lista con viñetas: el
 * turno es lo único que la persona busca cuando abre esto, y así lo encuentra sin leer.
 */
export function factsCard(headline: string, facts: Fact[]): string {
  const rows = facts
    .filter((fact) => fact.value)
    .map(
      (fact) => `
        <tr>
          <td style="padding:3px 12px 3px 0;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top">${escapeHtml(
            fact.label
          )}</td>
          <td style="padding:3px 0;font-size:15px;color:${C.ink};font-weight:bold;vertical-align:top">${escapeHtml(
            fact.value
          )}</td>
        </tr>`
    )
    .join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border-collapse:separate">
      <tr>
        <td style="width:4px;background:${C.green};border-radius:3px 0 0 3px" width="4"></td>
        <td style="padding:16px 18px;background:${C.paper};border-radius:0 8px 8px 0">
          <p style="margin:0 0 10px;font-family:${SERIF};font-size:17px;color:${C.greenDark}">${escapeHtml(headline)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>`;
}

/** El texto que escribió una persona, mostrado como cita y no como parte del mail. */
export function quote(text: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0">
      <tr>
        <td style="padding:14px 18px;background:${C.greenSoft};border-radius:8px;font-size:15px;line-height:1.65;color:${
          C.ink
        };white-space:pre-wrap">${escapeHtml(text)}</td>
      </tr>
    </table>`;
}

/** Botón. Va en tabla y no en un <a> suelto para que Outlook le respete el ancho. */
export function button(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto">
      <tr>
        <td style="background:${C.green};border-radius:8px">
          <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(
            label
          )}</a>
        </td>
      </tr>
    </table>`;
}

/** Aviso de que algo no salió como se esperaba: mismo lugar, otro color. */
export function warning(html: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0">
      <tr>
        <td style="padding:14px 18px;background:${C.warnBg};border-radius:8px;font-size:14px;line-height:1.6;color:${C.warnInk}">${html}</td>
      </tr>
    </table>`;
}

/**
 * El sobre: encabezado, contenido y pie con los datos del consultorio.
 *
 * El pie no es decoración. Quien recibe un recordatorio de turno necesita la dirección
 * y el horario ahí mismo, sin volver a la página.
 */
export function shell(content: string, office: { baseUrl?: string; mail?: string } = {}): string {
  const site = office.baseUrl || "#";
  const mail = office.mail ?? "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Consultorios del Jardín</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-font-smoothing:antialiased">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper}">
    <tr>
      <td align="center" style="padding:28px 14px 36px">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${C.border};border-radius:14px;overflow:hidden;font-family:${SANS}">

          <tr>
            <td style="padding:24px 30px;background:${C.green}">
              <p style="margin:0;font-family:${SERIF};font-size:21px;color:${C.cream};letter-spacing:0.01em">Consultorios del Jardín</p>
              <p style="margin:4px 0 0;font-size:12px;color:#cfe3d6;letter-spacing:0.08em;text-transform:uppercase">Psicopedagogía · Psicología · Nutrición · Fonoaudiología</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 30px 30px">
              ${content}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 30px 24px;background:${C.cream};border-top:1px solid #efe7c4">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.7;color:${C.greenDark}">
                <strong>${OFFICE.address}</strong><br>
                ${OFFICE.hours}
              </p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:${C.greenDark}">
                <a href="mailto:${mail}" style="color:${C.greenDark}">${mail}</a> · <a href="https://instagram.com/${OFFICE.instagram}" style="color:${C.greenDark}">@${OFFICE.instagram}</a>
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#8a8461">
                Este mensaje se envió automáticamente desde <a href="${site}" style="color:#8a8461">la página del consultorio</a>.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Versión en texto plano del mismo mail.
 *
 * Va junto al HTML: los filtros de spam desconfían de los mensajes que solo traen HTML,
 * y hay clientes que directamente muestran esta versión. Se deriva del HTML para que no
 * queden dos textos que hay que acordarse de actualizar juntos.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // El link importa tanto como su texto: si se pierde, el mail deja de servir.
    .replace(/<a[^>]*href="(mailto:[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
    .replace(/<\/(p|h1|h2|h3|tr|div|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    // Sacar las etiquetas deja un espacio antes del signo: "9 de Julio 3672 .".
    .replace(/ +([.,;:!?])/g, "$1")
    .trim();
}
