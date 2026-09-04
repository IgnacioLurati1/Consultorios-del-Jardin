import { EntityManager } from "@mikro-orm/mysql";
import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { ACTIVE_APPOINTMENT_STATES } from "../appointments/appointments.service.js";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { badRequest, notFound } from "../shared/errors.js";
import { parseISODate, startOfDay, toISODate } from "../shared/dates.js";
import { CalendarEvent, CLINIC_TIMEZONE, parseCalendars } from "./calendar.parser.js";

/**
 * Convertir el calendario de alguien en turnos del consultorio.
 *
 * El profesional que ya venía anotando sus sesiones en Google llega con años de agenda
 * escrita y ninguna forma de traerla. Esto la trae, sin pedirle que revise evento por
 * evento y sin inventar lo que el calendario no dice.
 *
 * Lo que no se inventa, en concreto:
 *
 * - **El paciente queda vacío.** En el calendario el paciente es un texto libre —a veces
 *   el nombre, a veces un apodo, a veces nada— y adivinar a quién se refiere significaría
 *   meter turnos en la ficha de la persona equivocada. El título se guarda en las
 *   observaciones, que es donde sirve para asignarlo a mano después.
 * - **El valor queda vacío si no aparece.** Un turno en cero es un turno que se regaló, y
 *   eso después aparece en los números del mes como si de verdad hubiera entrado nada.
 * - **La duración es la del evento**, aunque no coincida con los módulos de hoy. Son
 *   turnos históricos: no tienen por qué respetar una grilla que en ese momento no
 *   existía, y a veces están cargados a ojo.
 * - **Nada queda como turno repetible.** Un evento semanal entra como turnos sueltos, uno
 *   por semana. La repetición es una configuración a futuro, y traer el pasado no es
 *   pedir que siga pasando.
 *
 * De dónde sale el consultorio: del horario de atención que cubre esa hora de ese día. Es
 * el único dato del que se puede deducir, y también lo que define qué entra: un evento que
 * no cae en ningún horario de atención no es un turno, es cualquier otra cosa que la
 * persona tenía anotada.
 */

/** Los días como los guardan los horarios de atención: en minúscula y sin acentos. */
const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/**
 * Los mismos días, escritos como se leen.
 *
 * Van aparte porque los de arriba son una clave de base de datos y estos son castellano:
 * "no atendés los sabado" tiene dos errores en tres palabras, y es un texto que el
 * profesional lee una vez por cada evento que se saltea.
 */
const DAY_LABELS = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];

/** Cómo quedan los turnos importados según lo que haya elegido el profesional. */
export type StateChoice = "past-assisted" | "all-accepted" | "all-assisted";
export type PaymentChoice = "past-paid" | "all-paid" | "none" | "unset";

export interface ImportOptions {
  /** Qué tramo del calendario se mira, "AAAA-MM-DD" los dos. */
  from: string;
  to: string;
  state: StateChoice;
  payment: PaymentChoice;
  /** Guardar el título del evento en las observaciones del turno. */
  keepTitle: boolean;
  /**
   * Traer también los que caen fuera de los horarios de atención.
   *
   * De un evento así no se puede deducir el consultorio, que es de donde sale siempre.
   * Entran al consultorio donde el profesional atiende más horas, que es la única
   * respuesta razonable cuando no hay una correcta.
   */
  outsideSchedule: boolean;
}

export interface PlannedAppointment {
  date: string;
  initialHour: string;
  finalHour: string;
  idRoom: number;
  room: string;
  value: number | null;
  state: string;
  paymentState: "unpaid" | "paid" | null;
  observations: string | null;
  /** Ya pasó: es lo que decide el estado y el cobro en las opciones "los que pasaron". */
  past: boolean;
  /** No entra justo en un módulo de atención de hoy. Se importa igual, pero se avisa. */
  offGrid: boolean;
  /** No cae en ningún horario de atención, así que el consultorio salió del más usado. */
  outsideSchedule: boolean;
  /** Lo que decía el evento, para que la previa se pueda leer. */
  summary: string;
}

export interface SkippedEvent {
  summary: string;
  when: string;
  reason: string;
}

export interface ImportPlan {
  planned: PlannedAppointment[];
  skipped: SkippedEvent[];
  /** Eventos leídos del archivo, antes de filtrar por fecha. */
  read: number;
  /** Los que caen fuera del tramo pedido. No se listan de a uno: suelen ser miles. */
  outOfRange: number;
  calendars: number;
  /** El archivo era tan grande que quedó algo sin leer. */
  truncated: boolean;
}

export interface ImportResult extends ImportPlan {
  created: number;
  /** Turnos que fallaron al guardarse. Cero salvo que algo raro pase. */
  failed: number;
}

/** Cuántos turnos entran de una vez. Más que esto y algo se entendió mal. */
const MAX_PER_IMPORT = 2000;

/** De a cuántos se guardan. Una tanda por consulta, sin cargar la base de a una fila. */
const BATCH_SIZE = 50;

/**
 * El consultorio donde el profesional atiende más horas.
 *
 * Es a donde van a parar los turnos que no caen en ningún horario de atención, cuando se
 * pide traerlos igual. No es un dato del evento —el calendario no dice dónde fue— sino la
 * respuesta menos arbitraria posible: el lugar donde esa persona pasa la mayor parte de su
 * semana. Se cuenta por minutos de atención y no por cantidad de módulos, porque tres
 * módulos de media hora pesan menos que dos de una.
 *
 * Sólo entran los consultorios habilitados: mandar turnos a uno dado de baja es dejarlos
 * en un lugar que ya no existe.
 */
function busiestRoom(schedules: Schedule[]): Room | null {
  const totals = new Map<number, { room: Room; minutes: number }>();

  for (const schedule of schedules) {
    if (!schedule.room.active) continue;

    const id = schedule.room.idRoom!;
    const entry = totals.get(id) ?? { room: schedule.room, minutes: 0 };

    entry.minutes += Math.max(0, minutesOf(schedule.finalHour) - minutesOf(schedule.initialHour));
    totals.set(id, entry);
  }

  // El empate lo desempata el número de consultorio, para que dos importaciones del mismo
  // archivo elijan siempre el mismo y no queden turnos repartidos al azar entre dos salas.
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes || a.room.idRoom! - b.room.idRoom!)[0]?.room ?? null;
}

function minutesOf(hour: string): number {
  const [h, m] = hour.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/**
 * El día y la hora de ahora, en el consultorio.
 *
 * Se compara contra los strings del turno y no contra un `Date` a propósito: el turno
 * guarda "el martes a las 15:00", no un instante, y mezclar las dos cosas es de donde
 * salen los errores de un día para atrás.
 */
function nowInClinic(): { date: string; hour: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: `${hour}:${get("minute")}` };
}

/**
 * Lo que salió el turno, si el evento lo dice en algún lado.
 *
 * Nadie anota el precio de la misma manera dos veces, y menos entre una persona y otra:
 * "Sesión $6000", "cobré 12.000", "8 mil", "15k", "Marta 20000 pesos". Se busca en el
 * título y en la descripción, y se toma lo primero que sea claramente plata.
 *
 * Con símbolo de moneda alcanza y sobra: si dice pesos, es plata. Sin símbolo hay que
 * desconfiar, porque en el título de un turno los números son casi siempre otra cosa —el
 * número de sesión, una fecha, un teléfono, un documento, el año—. Por eso un número
 * suelto entra sólo si tiene entre cuatro y seis cifras: eso deja afuera los documentos y
 * los teléfonos, que son más largos, y las numeraciones, que son más cortas.
 *
 * Cuando no encuentra nada devuelve null y el turno queda sin valor. Eso es distinto de
 * cero: cero dice que se atendió gratis.
 */
export function readValue(text: string): number | null {
  if (!text) return null;

  // Primero se sacan las horas y las fechas, que son la otra cosa de un calendario que
  // siempre tiene números: sin esto "14:30" aporta un 30 y "12/05/2026" un 2026.
  const clean = text
    .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, " ")
    .replace(/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/g, " ")
    .replace(/\b\d{1,2}[/\-]\d{1,2}\b/g, " ");

  // Con símbolo de moneda, antes o después del número. Es lo único que dice "esto es
  // plata" sin lugar a dudas, así que se acepta cualquier monto.
  const signed =
    clean.match(/(?:u\$s|ar\$|\$|ars\b|usd\b)\s*(\d[\d.,]*)/i) ??
    clean.match(/(\d[\d.,]*)\s*(?:\$|pesos?\b|ars\b|usd\b)/i);

  if (signed) {
    const amount = toNumber(signed[1]);
    if (amount !== null && amount > 0) return amount;
  }

  // "8 mil" y "15k", que es como se escribe cuando se escribe rápido.
  const shorthand = clean.match(/(\d{1,3})\s*(?:mil\b|k\b)/i);
  if (shorthand) {
    const amount = Number(shorthand[1]) * 1000;
    if (amount > 0 && amount <= MAX_VALUE) return amount;
  }

  for (const match of clean.matchAll(/(?<![\d.,])(\d[\d.,]*\d|\d)(?![\d.,])/g)) {
    const digits = match[1].replace(/[.,]/g, "");

    // Cuatro a seis cifras: de mil a un millón. Menos que eso es una numeración —"Sesión
    // 3", "Sala 101"— y más es un documento o un teléfono.
    if (digits.length < 4 || digits.length > 6) continue;

    const amount = toNumber(match[1]);
    if (amount === null) continue;

    // Un año suelto no es un precio. "Control 2026" aparece, y $2.026 exactos no.
    if (match[1].length === 4 && amount >= 1900 && amount <= 2100) continue;

    if (amount >= 1000) return amount;
  }

  return null;
}

/** Más que esto no es el precio de una consulta: es otro número que se coló. */
const MAX_VALUE = 100_000_000;

/**
 * Un número escrito como plata, sin saber de antemano con qué convención.
 *
 * Manda el último separador: si lo siguen tres cifras es de miles y si lo siguen una o
 * dos, de centavos. Así entran las dos formas sin tener que preguntar cuál se usó —"5.000"
 * y "5,000" son cinco mil, "5.50" y "5,50" son cinco con cincuenta— que importa porque un
 * calendario en inglés escribe los miles con coma y leerlo al revés convertía cinco mil en
 * cinco.
 *
 * Los centavos se redondean: el valor del turno es un entero.
 */
function toNumber(raw: string): number | null {
  const text = raw.trim().replace(/[.,]+$/, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const last = Math.max(text.lastIndexOf("."), text.lastIndexOf(","));
  const decimals = last === -1 ? -1 : text.length - last - 1;

  const normalized =
    last === -1 || decimals === 3
      ? text.replace(/[.,]/g, "")
      : `${text.slice(0, last).replace(/[.,]/g, "")}.${text.slice(last + 1)}`;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_VALUE) return null;

  return Math.round(value);
}

export class CalendarImportService {
  /**
   * Lee el archivo y arma el plan, sin tocar la base.
   *
   * Es la misma cuenta que después hace la importación de verdad, para que lo que se ve en
   * la previa sea lo que va a pasar y no una estimación parecida.
   */
  async plan(professionalEmail: string, file: Buffer, options: ImportOptions, emT?: EntityManager): Promise<ImportPlan> {
    const em = emT ?? orm.em.fork();
    const { from, to } = this.range(options);

    const professional = await em.findOne(Person, { email: professionalEmail, type: "professional" });
    if (!professional) throw notFound("No encontramos tu ficha de profesional");

    const schedules = await em.find(Schedule, { person: professional }, { populate: ["room", "room.office"] });
    if (schedules.length === 0)
      throw badRequest(
        "Todavía no cargaste tus horarios de atención. El consultorio de cada turno sale de ahí, así que sin eso no hay de dónde sacarlo."
      );

    // El recorrido de los eventos que se repiten se corta acá: sin un tope, una repetición
    // sin fecha de fin no termina nunca.
    const until = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    const parsed = parseCalendars(file, until);

    const existing = await em.find(Appointment, {
      professional,
      date: { $gte: from, $lte: to },
      state: { $in: ACTIVE_APPOINTMENT_STATES },
    });

    // Lo que ya está ocupado, por día. Incluye lo que se va planificando en esta misma
    // corrida: dos eventos superpuestos en el calendario no pueden entrar los dos.
    const taken = new Map<string, { initialHour: string; finalHour: string }[]>();
    for (const appointment of existing) {
      const key = toISODate(startOfDay(appointment.date));
      taken.set(key, [...(taken.get(key) ?? []), { initialHour: appointment.initialHour.slice(0, 5), finalHour: appointment.finalHour.slice(0, 5) }]);
    }

    // Sólo se busca si se pidió: sin la opción prendida, un evento fuera de horario se
    // saltea igual que antes.
    const fallback = options.outsideSchedule ? busiestRoom(schedules) : null;

    const now = nowInClinic();
    const fromKey = toISODate(from);
    const toKey = toISODate(to);

    const planned: PlannedAppointment[] = [];
    const skipped: SkippedEvent[] = [];
    let outOfRange = 0;

    // En orden cronológico: cuando dos eventos se pisan, el que entra es el que empieza
    // antes, y sin ordenar eso dependería del orden del archivo.
    const events = [...parsed.events].sort((a, b) =>
      a.date === b.date ? a.initialHour.localeCompare(b.initialHour) : a.date.localeCompare(b.date)
    );

    for (const event of events) {
      if (event.date < fromKey || event.date > toKey) {
        outOfRange++;
        continue;
      }

      const reason = this.rejectionOf(event, schedules, taken, fallback);
      if (typeof reason === "string") {
        skipped.push({ summary: this.title(event), when: `${event.date} ${event.initialHour}`, reason });
        continue;
      }

      if (planned.length >= MAX_PER_IMPORT) {
        skipped.push({
          summary: this.title(event),
          when: `${event.date} ${event.initialHour}`,
          reason: `De una vez entran hasta ${MAX_PER_IMPORT} turnos. Importá un tramo más corto.`,
        });
        continue;
      }

      const { room, schedule } = reason;
      const past = event.date < now.date || (event.date === now.date && event.finalHour <= now.hour);

      planned.push({
        date: event.date,
        initialHour: event.initialHour,
        finalHour: event.finalHour,
        idRoom: room.idRoom!,
        room: room.description,
        value: readValue(`${event.summary} ${event.description}`),
        state: options.state === "all-accepted" ? "accepted" : options.state === "all-assisted" ? "assisted" : past ? "assisted" : "accepted",
        paymentState: this.paymentFor(options.payment, past),
        observations: options.keepTitle && event.summary ? event.summary : null,
        past,
        // No arranca donde arranca un módulo, o no dura lo que dura uno. Entra igual
        // —es histórico— pero la previa lo dice, porque en la agenda va a verse corrido.
        // El que ni siquiera cae en un horario está fuera de la grilla por definición.
        offGrid:
          schedule === null ||
          (minutesOf(event.initialHour) - minutesOf(schedule.initialHour)) % schedule.duration !== 0 ||
          minutesOf(event.finalHour) - minutesOf(event.initialHour) !== schedule.duration,
        outsideSchedule: schedule === null,
        summary: this.title(event),
      });

      taken.set(event.date, [...(taken.get(event.date) ?? []), { initialHour: event.initialHour, finalHour: event.finalHour }]);
    }

    return { planned, skipped, read: parsed.events.length, outOfRange, calendars: parsed.calendars, truncated: parsed.truncated };
  }

  /**
   * Importa de verdad.
   *
   * Vuelve a armar el plan en vez de confiar en el que vio el profesional: entre la previa
   * y el botón puede haber pasado cualquier cosa —otro turno cargado a mano, un horario de
   * atención cambiado— y lo que se guarda tiene que ser correcto contra la base de ahora,
   * no contra la de hace un minuto.
   *
   * Va de a tandas, y si una tanda falla reintenta sus turnos de a uno. Importar dos años
   * son cientos de inserciones: que una sola choque contra algo inesperado no puede
   * llevarse puestas las otras cuatrocientas, y menos dejar al profesional sin saber
   * cuáles entraron.
   */
  async run(professionalEmail: string, file: Buffer, options: ImportOptions): Promise<ImportResult> {
    const plan = await this.plan(professionalEmail, file, options);

    let created = 0;
    let failed = 0;

    for (let index = 0; index < plan.planned.length; index += BATCH_SIZE) {
      const batch = plan.planned.slice(index, index + BATCH_SIZE);
      const em = orm.em.fork();

      try {
        const context = await this.contextFor(em, professionalEmail, batch);
        for (const item of batch) this.build(em, context, item);
        await em.flush();
        created += batch.length;
      } catch {
        for (const item of batch) {
          const single = orm.em.fork();

          try {
            const context = await this.contextFor(single, professionalEmail, [item]);
            this.build(single, context, item);
            await single.flush();
            created++;
          } catch {
            failed++;
          }
        }
      }
    }

    return { ...plan, created, failed };
  }

  /**
   * El profesional y las salas que necesita una tanda, buscados de una sola vez.
   *
   * Van juntos porque los dos se resuelven igual —una consulta para toda la tanda— y
   * porque pedirlos de a uno convertiría cincuenta turnos en cien consultas.
   */
  private async contextFor(
    em: EntityManager,
    professionalEmail: string,
    batch: PlannedAppointment[]
  ): Promise<{ professional: Person; rooms: Map<number, Room> }> {
    const professional = await em.findOneOrFail(Person, { email: professionalEmail });
    const rooms = await em.find(Room, { idRoom: { $in: [...new Set(batch.map((item) => item.idRoom))] } });

    return { professional, rooms: new Map(rooms.map((room) => [room.idRoom!, room])) };
  }

  /** Un turno importado, listo para guardar. */
  private build(em: EntityManager, context: { professional: Person; rooms: Map<number, Room> }, item: PlannedAppointment): Appointment {
    const room = context.rooms.get(item.idRoom);
    if (!room) throw badRequest("El consultorio de ese turno ya no existe");

    return em.create(Appointment, {
      date: startOfDay(item.date),
      initialHour: item.initialHour,
      finalHour: item.finalHour,
      professional: context.professional,
      // Sin paciente: el calendario no dice quién es de una forma en la que se pueda
      // confiar, y el turno se asigna después desde la pantalla del turno.
      patient: null,
      room,
      value: item.value,
      state: item.state,
      observations: item.observations,
      paymentState: item.paymentState,
      paidAmount: null,
      // No se avisa nada por mail: no hay paciente a quien avisarle, y aunque lo hubiera,
      // un recordatorio de un turno de hace dos años no le sirve a nadie.
      reminderSent: "sent",
      // Un turno importado no es un sobreturno. El sobreturno es una decisión —meter uno
      // de más fuera del horario— y contarlos juntos ensuciaría esa cuenta en los números
      // del consultorio. Que no entre justo en la grilla ya se ve en el horario.
      overbooked: false,
      origin: "import",
      recurrence: null,
    });
  }

  /** Los pesos de un turno según lo que se haya elegido. */
  private paymentFor(choice: PaymentChoice, past: boolean): "unpaid" | "paid" | null {
    if (choice === "all-paid") return "paid";
    if (choice === "none") return "unpaid";
    // "unset" deja el turno sin registro de cobro, que es lo que ya significaba null para
    // los turnos viejos: no se sabe. No aparece ni cobrado ni adeudado.
    if (choice === "unset") return null;

    return past ? "paid" : "unpaid";
  }

  /**
   * Por qué un evento no puede ser un turno, o dónde va a ir a parar.
   *
   * Devolver el lugar en vez de un booleano evita buscarlo dos veces, y devolver el motivo
   * como texto es lo que después deja mostrarle al profesional qué se salteó y por qué: una
   * importación que dice "entraron 40 de 120" y no explica los otros 80 obliga a comparar a
   * mano contra el calendario.
   *
   * El horario vuelve por separado del consultorio porque puede no haberlo: cuando el
   * evento cae fuera de la grilla y se pidió traerlo igual, el consultorio sale del de
   * respaldo y no hay ningún módulo contra el cual medirlo.
   */
  private rejectionOf(
    event: CalendarEvent,
    schedules: Schedule[],
    taken: Map<string, { initialHour: string; finalHour: string }[]>,
    fallback: Room | null
  ): string | { room: Room; schedule: Schedule | null } {
    if (event.cancelled) return "En el calendario estaba cancelado.";
    if (event.allDay) return "Ocupa el día entero y no dice a qué hora era.";
    if (event.overnight) return "Empieza un día y termina en otro.";
    if (minutesOf(event.finalHour) <= minutesOf(event.initialHour)) return "No dura nada: empieza y termina a la misma hora.";

    const weekday = startOfDay(event.date).getDay();
    const day = DAY_NAMES[weekday];
    const covering = schedules.filter(
      (schedule) =>
        schedule.day === day &&
        schedule.initialHour.slice(0, 5) <= event.initialHour &&
        schedule.finalHour.slice(0, 5) > event.initialHour
    );

    // El primero que sirva. Si dos horarios se pisan y uno apunta a un consultorio dado de
    // baja, el turno tiene por qué ir al otro en vez de quedar afuera.
    const usable = covering.find((schedule) => schedule.room.active) ?? null;

    let room: Room;
    let schedule: Schedule | null;

    if (usable) {
      room = usable.room;
      schedule = usable;
    } else {
      const reason =
        covering.length === 0
          ? `No atendés los ${DAY_LABELS[weekday]} a las ${event.initialHour}.`
          : `El consultorio ${covering[0].room.description} está dado de baja.`;

      if (!fallback) return reason;

      room = fallback;
      schedule = null;
    }

    // La superposición se mira igual, caiga donde caiga: dos turnos a la misma hora siguen
    // siendo dos turnos a la misma hora aunque uno haya entrado por el consultorio de
    // respaldo.
    const overlaps = (taken.get(event.date) ?? []).some(
      (slot) => event.initialHour < slot.finalHour && event.finalHour > slot.initialHour
    );

    if (overlaps) return "Ya tenías un turno a esa hora.";

    return { room, schedule };
  }

  /** Cómo se nombra un evento que no tiene título. */
  private title(event: CalendarEvent): string {
    return event.summary || "(sin título)";
  }

  /** El tramo pedido, ya validado. */
  private range(options: ImportOptions): { from: Date; to: Date } {
    const from = parseISODate(options.from ?? "");
    const to = parseISODate(options.to ?? "");

    if (!from || !to) throw badRequest("Elegí desde y hasta qué fecha querés importar");
    if (from > to) throw badRequest("La fecha de inicio tiene que ser anterior a la de fin");

    return { from, to };
  }
}
