import { MAX_LIGHT, readableBackground } from "../shared/elementColors.js";

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

/**
 * Los datos del consultorio que van en el sobre.
 *
 * Llegan de la configuración de la instalación (ver config/mailer, que los pasa). Estos de
 * acá son los de siempre, para cuando se arma un mail sin configuración a mano, como en una
 * prueba.
 */
export interface MailIdentity {
  name: string;
  address: string;
  publicHours: string;
  instagram: string;
  /** El teléfono y el WhatsApp que se publican. Vacíos o sin cargar, no salen. */
  phone?: string;
  whatsapp?: string;
  services: string[];
  /** El color de la marca. Sin él, el verde de siempre. */
  brand: { hue: number; saturation: number } | null;
  /** El color propio de la cabecera, si el consultorio eligió uno. Ver shared/elementColors. */
  headerColor?: string | null;
}

export const DEFAULT_MAIL_IDENTITY: MailIdentity = {
  name: "Consultorios del Jardín",
  address: "9 de Julio 3672",
  publicHours: "Lunes a viernes, de 9 a 20",
  instagram: "consultorios_jardin",
  services: ["Psicología", "Psicopedagogía", "Psiquiatría", "Nutrición", "Fonoaudiología"],
  brand: null,
};

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/**
 * Pasa el mail al color de la marca.
 *
 * Se hace sobre el HTML terminado y no en cada pieza porque el verde no está solo en las
 * piezas de este archivo: varios mails escriben `color:#2f5e46` a mano en un link. Así
 * entra todo de una vez, y sin marca el mail sale idéntico al de siempre.
 *
 * La crema del pie y los colores de aviso no cambian: no son de la marca, son de lo que
 * dicen.
 */
function rebrand(html: string, brand: MailIdentity["brand"]): string {
  if (!brand) return html;

  const { hue, saturation } = brand;
  const swaps: Array<[string, string]> = [
    [C.green, hslToHex(hue, saturation, 35)],
    [C.greenDark, hslToHex(hue, saturation, 28)],
    [C.greenSoft, hslToHex(hue, saturation * 0.7, 93)],
    ["#cfe3d6", hslToHex(hue, saturation * 0.6, 85)],
  ];

  return swaps.reduce((out, [from, to]) => out.split(from).join(to).split(from.toUpperCase()).join(to), html);
}

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

/**
 * Un encabezado de sección, con la línea chica de arriba.
 *
 * Es el mismo par que abre cada bloque de la portada. Sirve para separar "lo que pasó"
 * de "lo que podés hacer" sin meter una raya en el medio.
 */
export function sectionHead(kicker: string, headline: string): string {
  return `
    <p style="margin:26px 0 6px;font-size:12px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${C.green}">${escapeHtml(
      kicker
    )}</p>
    <p style="margin:0 0 4px;font-family:${SERIF};font-size:22px;line-height:1.2;color:${C.ink}">${escapeHtml(
      headline
    )}</p>`;
}

/**
 * Las tarjetas de acceso de la portada, tal como se ven en la página.
 *
 * Blancas sobre el gris del papel, con el borde fino, la esquina redondeada y el filo
 * verde arriba. Es el mismo objeto que la persona va a encontrar cuando entre, así que el
 * mail funciona como una foto de adónde va y no como una lista de promesas.
 *
 * De a dos por fila y en tablas anidadas, que es la única grilla que entienden Outlook y
 * Gmail. Con una cantidad impar, la última queda sola a la izquierda y ocupa su mitad.
 */
export function featureCards(items: Array<{ title: string; text: string }>): string {
  // El filo verde es el borde de arriba de la tarjeta y no una fila aparte: como fila
  // dejaba una hendija blanca de un píxel en cada punta, donde asoma el borde del recuadro.
  const card = (item: { title: string; text: string }) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="100%" style="height:100%;background:#ffffff;border:1px solid ${C.border};border-top:3px solid ${C.green};border-radius:12px;border-collapse:separate">
      <tr>
        <td style="padding:13px 16px 15px">
          <p style="margin:0;font-family:${SERIF};font-size:17px;line-height:1.25;color:${C.greenDark}">${escapeHtml(
            item.title
          )}</p>
          <p style="margin:6px 0 0;font-size:13.5px;line-height:1.5;color:${C.muted}">${escapeHtml(item.text)}</p>
        </td>
      </tr>
    </table>`;

  const filas: string[] = [];

  for (let i = 0; i < items.length; i += 2) {
    const izquierda = items[i];
    const derecha = items[i + 1];

    filas.push(`
      <tr>
        <td width="50%" height="100%" style="width:50%;height:100%;padding:0 6px 12px 0;vertical-align:top">${card(izquierda)}</td>
        <td width="50%" height="100%" style="width:50%;height:100%;padding:0 0 12px 6px;vertical-align:top">${
          derecha ? card(derecha) : "&nbsp;"
        }</td>
      </tr>`);
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 6px">
      <tr>
        <td style="padding:16px 16px 4px;background:${C.paper};border-radius:14px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">${filas.join(
            ""
          )}</table>
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

/**
 * Dos botones lado a lado, para una pregunta con dos respuestas. El primero va lleno y el
 * segundo con borde: los dos se pueden tocar, pero no pesan lo mismo.
 */
export function buttonPair(primary: { label: string; href: string }, secondary: { label: string; href: string }): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto">
      <tr>
        <td style="background:${C.green};border-radius:8px">
          <a href="${primary.href}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(
            primary.label
          )}</a>
        </td>
        <td style="width:12px">&nbsp;</td>
        <td style="border:2px solid ${C.green};border-radius:8px">
          <a href="${secondary.href}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:15px;font-weight:bold;color:${C.greenDark};text-decoration:none">${escapeHtml(
            secondary.label
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
export function shell(
  content: string,
  office: { baseUrl?: string; mail?: string; identity?: MailIdentity } = {}
): string {
  const site = office.baseUrl || "#";
  const mail = office.mail ?? "";
  const who = office.identity ?? DEFAULT_MAIL_IDENTITY;
  const name = escapeHtml(who.name);
  const instagram = who.instagram.replace(/^@/, "");

  const phone = (who.phone ?? "").trim();
  const whatsapp = (who.whatsapp ?? "").replace(/\D/g, "");

  // El renglón de contacto del pie, con lo que haya: un consultorio sin Instagram no
  // muestra un link roto.
  const contact = [
    phone ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" style="color:${C.greenDark}">${escapeHtml(phone)}</a>` : "",
    whatsapp ? `<a href="https://wa.me/${whatsapp}" style="color:${C.greenDark}">WhatsApp</a>` : "",
    mail ? `<a href="mailto:${escapeHtml(mail)}" style="color:${C.greenDark}">${escapeHtml(mail)}</a>` : "",
    instagram
      ? `<a href="https://instagram.com/${encodeURIComponent(instagram)}" style="color:${C.greenDark}">@${escapeHtml(instagram)}</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return rebrand(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-font-smoothing:antialiased">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.paper}">
    <tr>
      <td align="center" style="padding:28px 14px 36px">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${C.border};border-radius:14px;overflow:hidden;font-family:${SANS}">

          <tr>
            <td style="padding:24px 30px;background:${who.headerColor ? readableBackground(who.headerColor, MAX_LIGHT.mail) : C.green}">
              <p style="margin:0;font-family:${SERIF};font-size:21px;color:${C.cream};letter-spacing:0.01em">${name}</p>
              ${
                who.services.length
                  ? `<p style="margin:4px 0 0;font-size:12px;color:#cfe3d6;letter-spacing:0.08em;text-transform:uppercase">${who.services
                      .map(escapeHtml)
                      .join(" · ")}</p>`
                  : ""
              }
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
                <strong>${escapeHtml(who.address)}</strong><br>
                ${escapeHtml(who.publicHours)}
              </p>
              ${contact ? `<p style="margin:0;font-size:13px;line-height:1.7;color:${C.greenDark}">${contact}</p>` : ""}
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
</html>`, who.brand);
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
