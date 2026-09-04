import ICAL from "ical.js";
import AdmZip from "adm-zip";
import { badRequest } from "../shared/errors.js";

/**
 * Leer un calendario exportado y sacarle los eventos, sin saber nada de turnos.
 *
 * Esta mitad del importador no conoce el consultorio: recibe bytes y devuelve eventos con
 * día, hora y texto. Todo lo que decide qué se convierte en turno y qué no vive en
 * import.service.ts. La separación es la que deja probar el formato —que es donde están
 * las rarezas— sin base de datos y sin un profesional inventado.
 *
 * El formato iCalendar tiene bastantes trampas y ninguna es evidente: las líneas se
 * pliegan a los 75 caracteres, las horas pueden venir en UTC o con una zona declarada más
 * arriba en el mismo archivo, un evento semanal es una sola entrada con una regla de
 * repetición, y una semana en la que ese evento se movió aparece como una entrada aparte
 * que pisa a la original. Nada de eso se resuelve leyendo el texto a mano, así que lo
 * hace `ical.js`, que además no arrastra dependencias.
 */

/**
 * La zona del consultorio, escrita acá y no deducida del reloj del servidor.
 *
 * Un evento exportado guarda un instante, no un horario: "18:30 UTC" y "15:30 en Buenos
 * Aires" son el mismo momento escrito distinto. El turno, en cambio, guarda la hora que
 * se lee en la pared. Convertir de uno al otro necesita una zona, y si esa zona fuera la
 * del proceso, mover el servidor de región correría todos los turnos importados.
 */
export const CLINIC_TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Techos para no quedarse sin memoria con un archivo enorme.
 *
 * Un Takeout de alguien que usa el calendario hace diez años trae decenas de miles de
 * eventos, y un evento "todos los días, para siempre" se expande hasta donde uno lo deje.
 * Los tres números son generosos para un uso real y cortan antes de tumbar el servidor.
 */
const MAX_EVENTS = 20000;
const MAX_OCCURRENCES_PER_EVENT = 1000;
const MAX_UNZIPPED_BYTES = 80 * 1024 * 1024;

/** Un evento del calendario, ya con la hora del consultorio y en un solo día. */
export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  /** El día, "AAAA-MM-DD". */
  date: string;
  /** "HH:MM", hora del consultorio. */
  initialHour: string;
  finalHour: string;
  /** Ocupa el día entero y no tiene horario: no puede ser un turno. */
  allDay: boolean;
  /** Estaba cancelado en el calendario. */
  cancelled: boolean;
  /** Empieza un día y termina otro: tampoco puede ser un turno. */
  overnight: boolean;
}

export interface ParseResult {
  events: CalendarEvent[];
  /** Cuántos archivos .ics se leyeron. Un Takeout suele traer varios. */
  calendars: number;
  /** Si se llegó a alguno de los techos y quedaron eventos sin leer. */
  truncated: boolean;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Le saca al texto lo que sobra antes de la primera línea.
 *
 * Un archivo guardado en Windows suele arrancar con una marca invisible de tres bytes que
 * dice en qué codificación está. Para el que lee el calendario esa marca es basura pegada
 * a la palabra `BEGIN`, y el archivo entero pasa a no ser un calendario: lo rechazaba
 * completo, sin que se viera por qué.
 */
function clean(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/^\s+/, "");
}

/** Un instante, escrito como lo vería un reloj colgado en el consultorio. */
function clinicTime(date: Date): { date: string; hour: string } {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  // A las 24:00 lo escribe así en vez de 00:00, y como hora de turno no existe.
  const hour = get("hour") === "24" ? "00" : get("hour");

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: `${hour}:${get("minute")}`,
  };
}

/**
 * Los archivos de calendario que trae un zip.
 *
 * Un Takeout de Google es un zip con `Takeout/Calendar/<nombre>.ics` adentro, uno por
 * cada calendario de la cuenta. Se leen todos: cuál es el de trabajo lo sabe el que
 * exportó, no nosotros, y un evento que no cae en un horario de atención se descarta
 * después igual.
 *
 * Nada se escribe en disco. Es lo que hace que un zip preparado a mano no pueda plantar
 * un archivo fuera de su carpeta: no hay carpeta.
 */
function readZip(buffer: Buffer): string[] {
  let entries;

  try {
    entries = new AdmZip(buffer).getEntries();
  } catch {
    throw badRequest("No pudimos abrir el archivo. ¿Seguro que es el zip que descargaste de Google?");
  }

  const texts: string[] = [];
  let total = 0;

  for (const entry of entries) {
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith(".ics")) continue;

    total += entry.header.size;
    if (total > MAX_UNZIPPED_BYTES) throw badRequest("El archivo es demasiado grande. Exportá un calendario a la vez.");

    texts.push(entry.getData().toString("utf8"));
  }

  if (texts.length === 0)
    throw badRequest("Ese zip no tiene ningún calendario adentro. Buscá el que dice Takeout y tiene archivos .ics.");

  return texts;
}

/**
 * Las zonas horarias que el propio archivo define.
 *
 * Un .ics que usa `TZID=America/Argentina/Buenos_Aires` trae más arriba el bloque que
 * explica qué significa eso, porque no puede suponer que quien lo lea tenga una base de
 * zonas. Registrarlos es lo que después permite convertir esas horas; sin esto las toma
 * como si fueran del lugar donde corre el servidor.
 */
function registerTimezones(calendar: ICAL.Component): void {
  for (const block of calendar.getAllSubcomponents("vtimezone")) {
    const timezone = new ICAL.Timezone(block);
    if (timezone.tzid && !ICAL.TimezoneService.has(timezone.tzid)) ICAL.TimezoneService.register(timezone);
  }
}

/** Un evento con su día y su hora ya resueltos. */
function toEvent(uid: string, summary: string, description: string, start: ICAL.Time, end: ICAL.Time): CalendarEvent {
  const from = clinicTime(start.toJSDate());
  const to = clinicTime(end.toJSDate());

  return {
    uid,
    summary: (summary ?? "").trim(),
    description: (description ?? "").trim(),
    date: from.date,
    initialHour: from.hour,
    finalHour: to.hour,
    allDay: start.isDate,
    cancelled: false,
    overnight: from.date !== to.date,
  };
}

/**
 * Los eventos de uno o varios calendarios, con los repetidos ya desplegados.
 *
 * Un evento semanal viaja como una sola entrada con la regla "todos los lunes", así que
 * para que la agenda quede completa hay que recorrer la regla y sacar una fecha por vez.
 * El recorrido se corta en `until`, que es hasta dónde pidió importar el profesional: sin
 * ese límite, una repetición sin fecha de fin no termina nunca.
 *
 * Las semanas que el profesional movió o borró en Google salen bien sin trabajo extra:
 * una entrada con `RECURRENCE-ID` pisa a la de esa fecha —y de ahí sale su horario y su
 * título propios— y las borradas están anotadas en la regla misma.
 */
export function parseCalendars(input: Buffer | string, until: Date): ParseResult {
  const isZip = Buffer.isBuffer(input) && input.length > 1 && input[0] === 0x50 && input[1] === 0x4b;
  const texts = (isZip ? readZip(input as Buffer) : [input.toString()]).map(clean);

  const events: CalendarEvent[] = [];
  let truncated = false;

  for (const text of texts) {
    if (events.length >= MAX_EVENTS) {
      truncated = true;
      break;
    }

    let calendar: ICAL.Component;

    try {
      calendar = new ICAL.Component(ICAL.parse(text));
    } catch {
      throw badRequest("No pudimos leer el calendario. Tiene que ser el archivo .ics tal como lo exporta Google.");
    }

    registerTimezones(calendar);

    // Las entradas que pisan una fecha puntual de un evento repetido se atan primero a su
    // evento, porque el recorrido de la regla ya las tiene que tener a mano para saber
    // que esa semana va distinta.
    const masters: ICAL.Event[] = [];
    const exceptions: ICAL.Event[] = [];

    for (const block of calendar.getAllSubcomponents("vevent")) {
      let event: ICAL.Event;

      try {
        event = new ICAL.Event(block);
      } catch {
        continue; // Un evento roto no invalida el resto del archivo.
      }

      if (!event.startDate || !event.endDate) continue;
      (block.hasProperty("recurrence-id") ? exceptions : masters).push(event);
    }

    for (const exception of exceptions) {
      const master = masters.find((candidate) => candidate.uid === exception.uid);
      if (master) master.relateException(exception);
      // Si no aparece el evento original —pasa cuando el rango exportado empieza después—
      // la excepción entra sola, como un evento suelto más.
      else masters.push(exception);
    }

    for (const event of masters) {
      if (events.length >= MAX_EVENTS) {
        truncated = true;
        break;
      }

      const cancelled = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";

      if (!event.isRecurring()) {
        events.push({ ...toEvent(event.uid, event.summary, event.description, event.startDate, event.endDate), cancelled });
        continue;
      }

      const iterator = event.iterator();
      let occurrences = 0;
      let next: ICAL.Time | null;

      while ((next = iterator.next())) {
        if (occurrences++ >= MAX_OCCURRENCES_PER_EVENT || events.length >= MAX_EVENTS) {
          truncated = true;
          break;
        }

        // El recorrido va en orden, así que en cuanto se pasa del rango pedido no queda
        // nada más que mirar de este evento.
        if (next.toJSDate() > until) break;

        const occurrence = event.getOccurrenceDetails(next);

        events.push({
          ...toEvent(
            event.uid,
            occurrence.item.summary,
            occurrence.item.description,
            occurrence.startDate,
            occurrence.endDate
          ),
          cancelled,
        });
      }
    }
  }

  return { events, calendars: texts.length, truncated };
}
