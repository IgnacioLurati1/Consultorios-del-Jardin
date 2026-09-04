import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Person } from "../people/people.entity.js";
import { ACTIVE_APPOINTMENT_STATES } from "../appointments/appointments.service.js";
import { badRequest, notFound } from "../shared/errors.js";
import { parseISODate, startOfDay, toISODate } from "../shared/dates.js";
import { CLINIC_TIMEZONE } from "./calendar.parser.js";

/**
 * Llevarse la agenda a un calendario de afuera.
 *
 * Es la vuelta del importador y es mucho más simple, porque acá los datos ya están
 * ordenados: sale un archivo `.ics`, que es lo que sabe leer Google Calendar —y también
 * Outlook, y el calendario del teléfono, que usan todos el mismo formato—.
 *
 * Dos decisiones que hacen que el archivo se pueda volver a importar sin ensuciar nada:
 *
 * - **Cada turno lleva siempre el mismo identificador.** Volver a exportar el mismo tramo
 *   y subirlo otra vez actualiza los eventos que ya estaban en vez de duplicarlos, que es
 *   lo que pasa cuando el identificador se inventa en cada exportación.
 * - **Las horas van con la zona del consultorio escrita al lado**, y no convertidas a
 *   otra. El turno guarda la hora que se lee en la pared —"el lunes a las 14:00"— así que
 *   se copia tal cual y no hay ninguna cuenta que pueda salir mal.
 */

export interface ExportOptions {
  from: string;
  to: string;
  /** Incluir los turnos dados de baja, marcados como cancelados en el calendario. */
  includeCancelled: boolean;
  /** Poner el nombre del paciente en el título del evento. */
  withPatientName: boolean;
}

/** Cómo se lee cada estado en el calendario de destino. */
const STATE_LABELS: Record<string, string> = {
  pending: "A confirmar",
  accepted: "Confirmado",
  assisted: "Vino",
  missed: "No vino",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Sin cobrar",
  partial: "Pago parcial",
  paid: "Cobrado",
};

/**
 * Escapa el texto que va adentro de una propiedad.
 *
 * Sin esto, un paciente apellidado como "Pérez, Juan" parte la propiedad en dos —la coma
 * separa valores en este formato— y el evento entra cortado o no entra. Lo mismo con el
 * punto y coma, la barra invertida y los saltos de línea.
 */
function escape(text: string): string {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Parte las líneas largas como pide el formato.
 *
 * El límite son 75 octetos, no 75 caracteres, y en castellano no es lo mismo: una "ñ"
 * ocupa dos. Se corta contando bytes y la línea sigue en la de abajo, empezada con un
 * espacio, que es la marca de "esto viene de arriba".
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // El primer trozo entra entero; los siguientes pierden un byte por el espacio de
    // continuación. Y se retrocede hasta el principio de un carácter, porque cortar una
    // "ñ" al medio deja dos bytes que no son ninguna letra.
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;

    parts.push((start === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return parts.join("\r\n");
}

/** "2026-08-03" y "14:00" como los escribe el formato: 20260803T140000. */
function stamp(date: Date | string, hour: string): string {
  const day = toISODate(startOfDay(date)).replace(/-/g, "");
  const [h, m] = hour.slice(0, 5).split(":");
  return `${day}T${h}${m}00`;
}

/** El momento de la exportación, en UTC, que es como pide el formato esta propiedad. */
function nowUtc(): string {
  return `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * Qué dice el evento adentro.
 *
 * Sin dos puntos: en un calendario esto se lee en un globito chico, y "Estado: Vino" al
 * lado de "Cobro: Cobrado" es una columna de dos puntos que no aporta nada.
 */
function description(appointment: Appointment): string {
  const lines: string[] = [];

  lines.push(
    `Paciente — ${
      appointment.patient ? `${appointment.patient.surname}, ${appointment.patient.name}` : "sin asignar"
    }`
  );
  lines.push(`Estado — ${STATE_LABELS[appointment.state] ?? "Cancelado"}`);

  if (appointment.value != null) lines.push(`Valor — $${appointment.value}`);

  if (appointment.paymentState) {
    const detail =
      appointment.paymentState === "partial" && appointment.paidAmount != null
        ? `${PAYMENT_LABELS.partial}, entraron $${appointment.paidAmount}`
        : PAYMENT_LABELS[appointment.paymentState];
    lines.push(`Cobro — ${detail}`);
  }

  if (appointment.observations) lines.push("", appointment.observations);

  lines.push("", "Exportado de Consultorios del Jardín.");

  return lines.join("\n");
}

/** Cómo se llama el evento en el calendario de destino. */
function summary(appointment: Appointment, withPatientName: boolean): string {
  if (!appointment.patient) return "Turno sin paciente";
  if (!withPatientName) return "Turno";

  return `${appointment.patient.surname}, ${appointment.patient.name}`;
}

export class CalendarExportService {
  /**
   * El archivo con los turnos del profesional en ese tramo.
   *
   * Devuelve también cuántos entraron, porque el que aprieta exportar necesita saber si
   * bajó una agenda o un archivo vacío, y un `.ics` no se puede mirar por arriba.
   */
  async build(professionalEmail: string, options: ExportOptions): Promise<{ ics: string; appointments: number }> {
    const from = parseISODate(options.from ?? "");
    const to = parseISODate(options.to ?? "");

    if (!from || !to) throw badRequest("Elegí desde y hasta qué fecha querés exportar");
    if (from > to) throw badRequest("La fecha de inicio tiene que ser anterior a la de fin");

    const em = orm.em.fork();

    const professional = await em.findOne(Person, { email: professionalEmail, type: "professional" });
    if (!professional) throw notFound("No encontramos tu ficha de profesional");

    const appointments = await em.find(
      Appointment,
      {
        professional,
        date: { $gte: from, $lte: to },
        ...(options.includeCancelled ? {} : { state: { $in: ACTIVE_APPOINTMENT_STATES } }),
      },
      { populate: ["patient", "room", "room.office"], orderBy: { date: "ASC", initialHour: "ASC" } }
    );

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Consultorios del Jardin//Agenda//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escape(`Turnos de ${professional.surname}, ${professional.name}`)}`,
      `X-WR-TIMEZONE:${CLINIC_TIMEZONE}`,
      // La zona del consultorio, declarada adentro del archivo para que el programa que lo
      // abra sepa qué quiere decir el nombre sin tener que buscarlo en ningún lado.
      "BEGIN:VTIMEZONE",
      `TZID:${CLINIC_TIMEZONE}`,
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0300",
      "TZOFFSETTO:-0300",
      "TZNAME:-03",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];

    const dtstamp = nowUtc();

    for (const appointment of appointments) {
      const cancelled = !ACTIVE_APPOINTMENT_STATES.includes(appointment.state);

      lines.push(
        "BEGIN:VEVENT",
        // Siempre el mismo para el mismo turno: es lo que hace que volver a subir el
        // archivo actualice el evento en vez de crear otro al lado.
        `UID:turno-${appointment.numAppointment}@consultoriosdeljardin`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=${CLINIC_TIMEZONE}:${stamp(appointment.date, appointment.initialHour)}`,
        `DTEND;TZID=${CLINIC_TIMEZONE}:${stamp(appointment.date, appointment.finalHour)}`,
        fold(`SUMMARY:${escape(summary(appointment, options.withPatientName))}`),
        fold(`DESCRIPTION:${escape(description(appointment))}`),
        fold(
          `LOCATION:${escape(
            [appointment.room?.description, appointment.room?.office?.description].filter(Boolean).join(" — ")
          )}`
        ),
        `STATUS:${cancelled ? "CANCELLED" : appointment.state === "pending" ? "TENTATIVE" : "CONFIRMED"}`,
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR", "");

    // Los saltos van así porque el formato lo pide así, y hay programas que rechazan el
    // archivo entero si vienen sueltos.
    return { ics: lines.join("\r\n"), appointments: appointments.length };
  }

  /** Cómo se llama el archivo que se baja. */
  fileName(options: ExportOptions): string {
    return `turnos-${options.from}-a-${options.to}.ics`;
  }
}
