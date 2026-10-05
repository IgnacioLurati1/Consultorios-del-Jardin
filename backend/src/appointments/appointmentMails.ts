import { button, buttonPair, escapeHtml, factsCard, note, paragraph, title, warning } from "../config/mailTemplate.js";
import type { Words } from "../shared/vocabulary.js";

/**
 * Los mails de turnos, armados y sin mandar.
 *
 * Antes cada mail se armaba adentro de la función que lo mandaba, y no había forma de ver
 * uno sin mandarlo. La configuración del consultorio necesita justamente eso: mostrar cómo
 * queda un mail con las palabras que se están eligiendo. Así que acá está el texto y en el
 * servicio de turnos está el envío; los dos usan estas funciones, y la vista previa también.
 *
 * Cada una recibe las palabras del rubro (`w`, ver shared/vocabulary) y los datos del turno
 * ya escritos, y devuelve el asunto, el cuerpo y el aviso de la campanita que va con él. Con
 * las palabras de siempre, el texto es letra por letra el que había; lo fija
 * `appointmentMails.test.ts`.
 */

export interface Fact {
  label: string;
  value: string;
}

/** Lo que un mail sabe del turno, ya escrito. */
export interface MailData {
  /** Fecha, hora y con quién, en el orden en que se muestran. Ver factsFor. */
  facts: Fact[];
  /** "martes 2 de septiembre a las 09:00", para el paciente. */
  when: string;
  /** "martes 2 de septiembre de 09:00 a 09:45", para el profesional. */
  agenda: string;
  /** El nombre del paciente, o "Un paciente" en las palabras del consultorio. */
  patient: string;
  /** El nombre del profesional, o vacío si no se sabe. */
  professional: string;
  /** Debajo de cuántas horas una baja es "sobre la hora". */
  shortNoticeHours?: number;
  /** Una dirección de la web, con el dominio del consultorio. */
  url: (path: string) => string;
  /** Si el paciente puede cancelar solo. Sin dato, sí (ver las reglas del consultorio). */
  canCancel?: boolean;
  /** Si el paciente puede pedir otro turno solo. Sin dato, sí. */
  canBook?: boolean;
  /** Con varias sucursales, la dirección de la del turno: es la que va en el recordatorio. */
  branchAddress?: string;
}

export interface BuiltMail {
  subject: string;
  html: string;
}

export interface Notice {
  title: string;
  body: string;
}

/**
 * Los datos del turno en un mail: fecha, hora, con quién y en qué consultorio, siempre en
 * este orden.
 *
 * Al paciente se le nombra el profesional y solo la hora de inicio: con la de fin a la vista,
 * la sesión parece de duración fija, y no lo es. Al profesional se le nombra el paciente y
 * las dos horas, que es como lee su agenda, y el consultorio, que al paciente no le sirve.
 */
export function factsFor(
  w: Words,
  to: "patient" | "professional",
  values: { date: string; start: string; end: string; professional: string; patient: string; room: string; branch?: string }
): Fact[] {
  // Con varias sucursales, en cuál es. Con una sola no se dice: es la de siempre.
  const branch = values.branch ? [{ label: w.Sucursal, value: values.branch }] : [];

  if (to === "patient") {
    return [
      { label: "Fecha", value: values.date },
      { label: "Hora", value: values.start },
      { label: w.Profesional, value: values.professional },
      ...branch,
    ];
  }

  return [
    { label: "Fecha", value: values.date },
    { label: "Hora de inicio", value: values.start },
    { label: "Hora de fin", value: values.end },
    { label: w.Paciente, value: values.patient },
    ...branch,
    { label: w.Sala, value: values.room },
  ];
}

/**
 * Una frase con el consejo al final, si hay uno.
 *
 * `lead` va antes y `tail` después. Sin consejo quedan solos, sin un punto colgando.
 */
export function withAdvice(advice: string, lead: string, tail = ""): string {
  return [lead, advice, tail]
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .map((part) => `${part}.`)
    .join(" ");
}

/* ============================================================
   Al paciente
   ============================================================ */

/** El paciente pidió un turno y espera que lo confirmen. */
export function createdMail(w: Words, d: MailData): BuiltMail & { notice: Notice } {
  const subject = `Pedimos tu ${w.turno}`;

  return {
    subject,
    notice: {
      title: `Tenés ${w.un("turno")} pendiente`,
      body: `${d.when}. Falta que ${w.el("profesional")} ${w.lo("turno")} confirme.`,
    },
    html: [
      title(subject),
      paragraph(`Ya tenemos tu pedido. Falta que ${w.el("profesional")} ${w.lo("turno")} confirme y te avisamos apenas lo haga.`),
      factsCard(`${w.El("turno")} que pediste`, d.facts),
      button(`Ver mis ${w.turnos}`, d.url("/AppointmentsList")),
      note(`Si ${w.lo("turno")} pediste sin querer, cancela${w.lo("turno")} desde tus ${w.turnos}.`),
    ].join(""),
  };
}

/** Le movieron el turno de día u hora. */
export function updatedMail(w: Words, d: MailData): BuiltMail & { notice: Notice } {
  const subject = `Cambiamos tu ${w.turno} de horario`;

  return {
    subject,
    notice: { title: `Te cambiamos ${w.el("turno")} de horario`, body: `Ahora es ${d.when}.` },
    html: [
      title(subject),
      factsCard("Ahora es", d.facts),
      paragraph(
        d.canCancel === false
          ? `Si este horario no te sirve, avisale ${w.al("lugar")}.`
          : d.canBook === false
            ? `Si este horario no te sirve, podés cancelar${w.lo("turno")}.`
            : `Si este horario no te sirve, podés cancelar${w.lo("turno")} y pedir otro.`
      ),
      button(`Ver mis ${w.turnos}`, d.url("/AppointmentsList")),
    ].join(""),
  };
}

/** El profesional no pudo tomar el pedido. */
export function rejectedMail(w: Words, d: MailData): BuiltMail & { notice: Notice } {
  const subject = `No pudimos darte ${w.ese("turno")}`;

  return {
    subject,
    notice: { title: subject, body: `${w.El("profesional")} no pudo tomar ese horario. Podés elegir otro.` },
    html: [
      title(subject),
      paragraph(`${w.El("profesional")} no pudo tomar el horario que pediste.`),
      factsCard(`${w.El("turno")} que no salió`, d.facts),
      ...(d.canBook === false
        ? []
        : [paragraph("Hay más horarios disponibles. Elegí otro y lo intentamos de nuevo."), button("Buscar otro horario", d.url("/Appointment"))]),
      note(
        `Si necesitás una fecha en particular, <a href="${d.url("/contacto")}" style="color:#2f5e46">escribinos</a> y lo vemos.`
      ),
    ].join(""),
  };
}

/** Se canceló el turno. */
export function canceledMail(w: Words, d: MailData): BuiltMail & { notice: Notice } {
  const subject = `Se canceló tu ${w.turno}`;

  return {
    subject,
    notice: { title: subject, body: `Era ${d.when}.` },
    html: [
      title(subject),
      paragraph(`${capitalFirst(w.este("turno"))} ya no está en la agenda.`),
      factsCard(`${w.Turno} cancelad${w.o("turno")}`, d.facts),
      ...(d.canBook === false ? [] : [button(`Pedir ${w.otro("turno")}`, d.url("/Appointment"))]),
    ].join(""),
  };
}

/** El profesional confirmó el pedido. */
export function acceptedMail(w: Words, d: MailData, advice: string): BuiltMail & { notice: Notice } {
  const subject = `Tu ${w.turno} está confirmad${w.o("turno")}`;

  return {
    subject,
    notice: { title: `Te confirmaron ${w.el("turno")}`, body: withAdvice(advice, d.when) },
    html: [
      title(subject),
      paragraph(`${w.El("profesional")} confirmó el horario. Te esperamos.`),
      factsCard(`Tu ${w.turno}`, d.facts),
      paragraph(withAdvice(advice, "", `Antes ${w.del("turno")} llega un recordatorio.`)),
      button(`Ver mis ${w.turnos}`, d.url("/AppointmentsList")),
      note(`¿No vas a poder ir? Cancela${w.lo("turno")} desde tus ${w.turnos} así el horario le queda a otra persona.`),
    ].join(""),
  };
}

/**
 * El profesional le cargó un turno.
 *
 * Nace confirmado: no hay nada que aceptar. Si el turno no se pudo leer, el mail sale igual y
 * sin los datos; que llegue el aviso importa más que el detalle.
 */
export function addedMail(w: Words, d: MailData | null, url: (path: string) => string): BuiltMail & { notice: Notice } {
  const subject = `Te anotamos en ${w.un("turno")}`;

  return {
    subject,
    notice: {
      title: subject,
      body: d
        ? `${d.when}, con ${d.professional || w.el("lugar")}.`
        : `Desde ${w.el("lugar")} te asignaron ${w.un("turno")}. Entrá para ver el día y la hora.`,
    },
    html: [
      title(subject),
      paragraph(`Desde ${w.el("lugar")} te asignaron ${w.un("turno")}, y ya está confirmad${w.o("turno")}.`),
      ...(d ? [factsCard(`Tu ${w.turno}`, d.facts)] : []),
      button(`Ver mis ${w.turnos}`, url("/AppointmentsList")),
      warning(`Si no esperabas ${w.este("turno")}, avisanos. Puede ser un error de carga.`),
    ].join(""),
  };
}

/** "Hoy", "mañana" o la fecha, para el recordatorio. */
export type ReminderDay = "today" | "tomorrow" | { date: string };

export function reminderTitles(w: Words, day: ReminderDay): { title: string; subject: string } {
  if (day === "today") return { title: `${w.Turno} de hoy`, subject: `Hoy tenés ${w.turno}` };
  if (day === "tomorrow") return { title: `${w.Turno} de mañana`, subject: `Mañana tenés ${w.turno}` };
  return { title: `Próxim${w.o("turno")} ${w.turno}`, subject: `Tenés ${w.turno} el ${day.date}` };
}

/**
 * El recordatorio, con la pregunta de si viene.
 *
 * Los dos botones abren una página que pide un toque más para confirmar. No contestan solos
 * al abrirse porque los programas de correo abren los links por su cuenta para revisarlos.
 * Sin links firmados, el mail sale sin la pregunta.
 */
export function reminderMail(
  w: Words,
  d: MailData,
  extra: { day: ReminderDay; address: string; advice: string; links: { yes: string; no: string } | null }
): BuiltMail & { notice: Notice } {
  const { title: heading, subject } = reminderTitles(w, extra.day);
  const where = extra.address ? `En <strong>${escapeHtml(extra.address)}</strong>.` : "";
  const advice = extra.advice ? ` ${escapeHtml(extra.advice)}.` : "";

  return {
    subject,
    notice: { title: subject, body: extra.address ? `${d.when}. Es en ${extra.address}.` : `${d.when}.` },
    html: [
      title(heading),
      factsCard(heading, d.facts),
      ...(where || advice ? [paragraph(`${where}${advice}`.trim())] : []),
      ...(extra.links
        ? [
            paragraph(`La respuesta le avisa ${w.al("profesional")} con tiempo.`),
            ...(d.canCancel === false
              ? [
                  button("Confirmar asistencia", extra.links.yes),
                  note(`Para cancelar hay que avisarle ${w.al("lugar")}.`),
                ]
              : [
                  buttonPair(
                    { label: "Confirmar asistencia", href: extra.links.yes },
                    { label: `Cancelar ${w.turno}`, href: extra.links.no }
                  ),
                  note(
                    `Al cancelar, el horario queda disponible para otra persona. ${w.El("turno")} también figura en <a href="${d.url(
                      "/AppointmentsList"
                    )}" style="color:#2f5e46">Mis ${w.turnos}</a>.`
                  ),
                ]),
          ]
        : [
            button(`Ver mis ${w.turnos}`, d.url("/AppointmentsList")),
            note(
              d.canCancel === false
                ? `Para cancelar hay que avisarle ${w.al("lugar")}.`
                : "Para cancelar, conviene hacerlo hoy. Así el horario queda disponible para otra persona."
            ),
          ]),
    ].join(""),
  };
}

/* ============================================================
   Al profesional
   ============================================================ */

/**
 * Le sacaron un turno: pedido, o confirmado solo si tiene la confirmación automática.
 *
 * Con la confirmación automática no hay nada que contestar, y pedirle que confirme algo ya
 * confirmado lo manda a buscar un botón que no existe.
 */
export function newBookingMail(w: Words, d: MailData, pending: boolean): BuiltMail & { notice: Notice } {
  const subject = pending ? `Te pidieron ${w.un("turno")}` : `Te sacaron ${w.un("turno")}`;

  return {
    subject,
    notice: { title: subject, body: `${d.patient}, ${d.agenda}.` },
    html: [
      title(subject),
      paragraph(
        pending
          ? `${w.Un("paciente")} pidió un horario tuyo. Queda esperando hasta que lo contestes.`
          : `${w.Un("paciente")} sacó ${w.un("turno")} y quedó confirmad${w.o("turno")} sol${w.o("turno")}, como lo tenés configurado.`
      ),
      factsCard(w.El("turno"), d.facts),
      button(pending ? "Ver los pedidos" : "Ver mi agenda", d.url("/AppointmentsList")),
      ...(pending
        ? [note(`Si no lo contestás, el pedido se da de baja solo cuando pasa la hora ${w.del("turno")}.`)]
        : []),
    ].join(""),
  };
}

/** Un paciente dio de baja un pedido que todavía no estaba contestado. */
export function withdrawnMail(w: Words, d: MailData): BuiltMail & { notice: Notice } {
  const subject = "Se dio de baja un pedido";

  return {
    subject,
    notice: {
      title: subject,
      body: `${d.patient} dio de baja el pedido de ${d.agenda}. Ese horario vuelve a estar libre.`,
    },
    html: [
      title(subject),
      paragraph(`${w.Un("paciente")} dio de baja ${w.un("turno")} que te había pedido y que no habías contestado.`),
      factsCard("El pedido que se cayó", d.facts),
      paragraph("No tenés que hacer nada. Ese horario vuelve a estar disponible."),
      button("Ver mi agenda", d.url("/AppointmentsList")),
    ].join(""),
  };
}

/**
 * Un paciente canceló y el horario quedó libre.
 *
 * Con menos anticipación que la baja tardía, la campanita lo dice: cambia lo que el
 * profesional hace al leerlo.
 */
export function slotFreedMail(w: Words, d: MailData, short: boolean): BuiltMail & { notice: Notice } {
  const subject = "Se te liberó un horario";

  return {
    subject,
    notice: {
      title: short ? `Te cancelaron ${w.un("turno")} sobre la hora` : subject,
      body: short
        ? `${d.patient} dio de baja ${w.el("turno")} de ${d.agenda}, con menos de ${noticeSpan(d.shortNoticeHours)} de aviso.`
        : `${d.patient} canceló ${w.el("turno")} de ${d.agenda}.`,
    },
    html: [
      title(subject),
      paragraph(`${w.Un("paciente")} canceló su ${w.turno}, así que ese horario vuelve a estar disponible.`),
      factsCard("Horario liberado", d.facts),
      button("Ver mi agenda", d.url("/ProfessionalHome")),
    ].join(""),
  };
}

/** El aviso de la víspera del profesional: cuántos turnos tiene mañana y a qué hora empieza. */
export function tomorrowNotice(w: Words, count: number, first: string): Notice {
  return {
    title: count === 1 ? `Mañana tenés ${w.un("turno")}` : `Mañana tenés ${count} ${w.turnos}`,
    body: `${w.o("turno") === "a" ? "La primera" : "El primero"}, a las ${first}.`,
  };
}

/** "un día" con la baja tardía de siempre; si no, las horas. */
function noticeSpan(hours = 24): string {
  if (hours === 24) return "un día";
  if (hours === 1) return "una hora";
  return `${hours} horas`;
}

function capitalFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
