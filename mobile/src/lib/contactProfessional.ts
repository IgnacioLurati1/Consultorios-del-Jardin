interface Named {
  name?: string;
  surname?: string;
  email: string;
  speciality?: string | null;
}

/**
 * El mensaje que se abre ya escrito.
 *
 * Son las preguntas que igual terminan llegando por teléfono y que la app no contesta:
 * qué obras sociales toma, cuánto sale, y cómo es la primera vez. Va como borrador y no
 * como formulario porque cada persona pregunta lo suyo: lo que importa es que no tenga
 * que arrancar de una hoja en blanco.
 */
function draft(professional: Named, patient?: Named): { subject: string; body: string } {
  const who = [patient?.name, patient?.surname].filter(Boolean).join(" ").trim();
  const greeting = professional.name ? `Hola ${professional.name}, ¿cómo estás?` : "Hola, ¿cómo estás?";

  // La firma va abajo de todo. El email escrito a mano es a propósito: Gmail manda desde
  // la cuenta que tenga abierta el navegador, que no siempre es la misma con la que la
  // persona entró a la app, y del otro lado tienen que saber a quién contestarle.
  const signature = [who, patient?.email ? `Mi cuenta en la app: ${patient.email}` : ""].filter(Boolean);

  const body = [
    greeting,
    "",
    "Te escribo desde Consultorios del Jardín, antes de sacar un turno. Quería consultarte:",
    "",
    "· ¿Trabajás con obra social o prepaga? ¿Con cuáles?",
    "· ¿Cuánto sale la consulta?",
    "· ¿Cuánto dura y cómo es la primera vez?",
    "",
    "Gracias.",
    ...(signature.length > 0 ? ["", ...signature] : []),
  ].join("\n");

  return {
    subject: `Consulta antes de sacar turno${professional.speciality ? ` · ${professional.speciality}` : ""}`,
    body,
  };
}

/**
 * Link para escribirle al profesional desde Gmail.
 *
 * Gmail no acepta un remitente en la URL: manda desde la cuenta abierta en el navegador.
 * Por eso el email del paciente viaja en el cuerpo, para que del otro lado sepan a quién
 * contestarle aunque las dos cuentas no coincidan.
 */
export function gmailComposeUrl(professional: Named, patient?: Named): string {
  const { subject, body } = draft(professional, patient);

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: professional.email,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}
