interface Named {
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
}

/**
 * El mensaje que se abre ya escrito, del profesional al paciente.
 *
 * Es el reverso del que usa el paciente para escribirle al profesional antes de sacar
 * turno (ver contactProfessional.ts), y va vacío de contenido a propósito: acá el motivo
 * lo pone quien escribe —mover un turno, pedir un estudio, avisar algo— y lo único que
 * la app puede aportar es no obligar a arrancar de una hoja en blanco.
 */
function draft(patient: Named, professional?: Named): { subject: string; body: string } {
  const greeting = patient.name ? `Hola ${patient.name}, ¿cómo estás?` : "Hola, ¿cómo estás?";
  const signature = [professional?.name, professional?.surname].filter(Boolean).join(" ").trim();

  const body = [
    greeting,
    "",
    "Te escribo de Consultorios del Jardín por tu turno.",
    "",
    "",
    ...(signature ? [signature] : []),
  ].join("\n");

  return { subject: "Consultorios del Jardín", body };
}

/** Link para escribirle al paciente desde Gmail, con el mensaje ya empezado. */
export function gmailToPatientUrl(patient: Named, professional?: Named): string {
  const { subject, body } = draft(patient, professional);

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: patient.email,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Teléfono como lo escribiría una persona: "341 123-4567". */
export function prettyPhone(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return phone?.trim() || null;

  return `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Link de WhatsApp.
 *
 * Los teléfonos se guardan en diez dígitos sin 0 ni 15, que es como los pide el
 * formulario. WhatsApp los quiere con el código de país y con el 9 de los celulares
 * argentinos adelante, así que el número se arma acá y no se guarda armado: lo que está
 * en la base es el número, no el formato de una aplicación.
 */
export function whatsappUrl(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return null;

  return `https://wa.me/549${digits}`;
}
