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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 2000;

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
  if (form.phone.trim() && !/^[\d\s()+-]{6,30}$/.test(form.phone.trim())) return "Formato de teléfono inválido";
  return null;
}

export function validateMessage(form: ContactForm): string | null {
  const message = form.message.trim();
  if (message.length < MIN_MESSAGE) return "El mensaje es demasiado corto";
  if (message.length > MAX_MESSAGE) return "El mensaje supera el máximo de caracteres";
  return null;
}

/** Manda la consulta. El backend la reenvía por mail a la casilla del consultorio. */
export function sendContactMessage(form: ContactForm): Promise<void> {
  return api
    .post("/contact", {
      reason: form.reason,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      message: form.message.trim(),
      website: form.website,
    })
    .then(() => undefined)
    .catch((err) => {
      throw new Error(err.response?.data?.message || "Error al enviar el mensaje");
    });
}
