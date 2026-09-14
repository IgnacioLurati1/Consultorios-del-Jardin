import api from "../../axios";

/**
 * Motivos posibles de una consulta. La lista es cerrada y coincide con la del backend:
 * el asunto del mail se arma con esto, así la casilla del consultorio queda ordenada
 * sola en vez de llenarse de "Consulta" a secas.
 */
export const REASONS = [
  { id: "turnos", label: "Turnos", hint: "Solicitudes, cambios y cancelaciones." },
  { id: "profesional", label: "Quiero trabajar acá", hint: "Profesionales interesados en sumarse al consultorio." },
  { id: "sugerencia", label: "Sugerencia", hint: "Propuestas de mejora." },
  { id: "otro", label: "Otra consulta", hint: "Otros temas." },
];

/** El motivo de quien quiere sumarse al equipo: pide teléfono y acepta un CV. */
export const APPLICATION = "profesional";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 2000;

/** El mismo tope que el backend. Un CV pesa unos cientos de kilobytes. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.doc,.docx,.odt";

export interface ContactForm {
  reason: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  /** Campo trampa: está escondido, así que solo lo completa un bot. */
  website: string;
}

export const emptyContactForm: ContactForm = {
  reason: "",
  name: "",
  email: "",
  phone: "",
  message: "",
  website: "",
};

export function validateReason(form: ContactForm): string | null {
  if (!form.reason) return "Falta elegir el motivo";
  return null;
}

export function validatePerson(form: ContactForm): string | null {
  if (form.name.trim().length < 2) return "Falta el nombre";
  if (!EMAIL_REGEX.test(form.email.trim())) return "Formato de email inválido. Debe incluir @ y un punto";
  // A un profesional se lo llama para la entrevista: sin teléfono no hay cómo.
  if (form.reason === APPLICATION && !form.phone.trim()) return "Falta el teléfono";
  if (form.phone.trim() && !/^[\d\s()+-]{6,30}$/.test(form.phone.trim())) return "Formato de teléfono inválido";
  return null;
}

export function validateMessage(form: ContactForm): string | null {
  const message = form.message.trim();
  if (message.length < MIN_MESSAGE) return "El mensaje es demasiado corto";
  if (message.length > MAX_MESSAGE) return "El mensaje supera el máximo de caracteres";
  return null;
}

/** El CV es opcional. Si está, tiene que ser PDF o Word y entrar en el tope. */
export function validateCv(file: File | null): string | null {
  if (!file) return null;
  if (!/\.(pdf|docx?|odt)$/i.test(file.name)) return "El CV tiene que ser PDF o Word";
  if (file.size > MAX_CV_BYTES) return "El CV supera los 5 MB";
  return null;
}

/**
 * Manda la consulta. El backend la reenvía por mail a la casilla del consultorio.
 *
 * Sin CV viaja como siempre, en JSON. Con CV va como formulario con archivo, que es la
 * única forma de mandar un archivo. Se separa a propósito: la página y el servidor se
 * publican por separado, y un servidor que todavía no espera archivos entiende igual el
 * envío en JSON, así que mientras tanto lo único que no anda es adjuntar.
 */
export function sendContactMessage(form: ContactForm, cv: File | null = null): Promise<void> {
  const fields = {
    reason: form.reason,
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    message: form.message.trim(),
    website: form.website,
  };

  const request = (() => {
    if (!cv || form.reason !== APPLICATION) return api.post("/contact", fields);

    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append("cv", cv);

    // Sin el Content-Type de JSON que trae el cliente: el navegador escribe el suyo, con
    // el separador de cada envío. Ver importService.ts.
    return api.post("/contact", body, { headers: { "Content-Type": undefined } });
  })();

  return request
    .then(() => undefined)
    .catch((err) => {
      throw new Error(err.response?.data?.message || "Error al enviar el mensaje");
    });
}
