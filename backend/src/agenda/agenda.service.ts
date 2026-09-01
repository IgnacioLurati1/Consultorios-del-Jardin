import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Office } from "../offices/offices.entity.js";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { badRequest } from "../shared/errors.js";
import { addDays, dayName, startOfDay, toISODate } from "../shared/dates.js";

const em = orm.em;

/** Cancelar escribe un ISO timestamp en `state`: un estado que no está acá es cancelado. */
const LIVE_STATES = ["pending", "accepted", "assisted", "missed"];
const isCancelled = (state: string) => !LIVE_STATES.includes(state);

/** Si no hay sucursales cargadas, la grilla igual tiene que dibujarse con algo. */
const DEFAULT_OPENING = "08:00";
const DEFAULT_CLOSING = "21:00";

/** "08:00" -> 480. Sumar y comparar minutos es más simple que hacerlo con el texto. */
function minutes(hour: string): number {
  const [h, m] = hour.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function hhmm(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Las columnas TIME vuelven como "08:00:00" y en pantalla siempre van sin los segundos. */
const hour = (value: string) => value.slice(0, 5);

function personView(person: Person) {
  return {
    email: person.email,
    name: person.name,
    surname: person.surname,
    speciality: person.speciality ?? null,
  };
}

/** El día de la semana como lo guardan los horarios: en minúscula y sin acentos. */
function scheduleDay(date: Date): string {
  return dayName(date)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** El lunes de la semana de esa fecha. El domingo cierra la semana, no la abre. */
function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest("La fecha tiene que venir como AAAA-MM-DD");

  const date = startOfDay(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Esa fecha no existe");
  return date;
}

/**
 * La agenda del consultorio mirada por día, no por profesional.
 *
 * El resto del sistema pregunta siempre "¿qué hace tal profesional?". Acá la pregunta es
 * la del que administra el edificio: qué pasa el martes, quién está, qué sala queda
 * libre y a qué hora hay más gente adentro.
 */
export class AgendaService {
  /** De cuándo a cuándo dibujar la grilla: la sucursal que abre más temprano y la que cierra más tarde. */
  private async openingHours(): Promise<{ opening: string; closing: string }> {
    const offices = await em.find(Office, { active: true });
    if (offices.length === 0) return { opening: DEFAULT_OPENING, closing: DEFAULT_CLOSING };

    return {
      opening: offices.reduce((earliest, office) => (hour(office.openingTime) < earliest ? hour(office.openingTime) : earliest), "23:59"),
      closing: offices.reduce((latest, office) => (hour(office.closingTime) > latest ? hour(office.closingTime) : latest), "00:00"),
    };
  }

  /**
   * Un día completo: las salas, quién atiende en cada una y qué turnos hay.
   *
   * Los horarios y los turnos van juntos en la misma respuesta porque la pantalla alterna
   * entre las dos vistas con un botón. Es un día de un solo consultorio: traer las dos
   * cosas cuesta menos que hacer esperar una carga cada vez que se toca el botón.
   */
  async forDay(dateValue: string) {
    const date = parseDate(dateValue);
    const day = scheduleDay(date);

    const [rooms, schedules, appointments, hours] = await Promise.all([
      em.find(Room, { active: true }, { populate: ["office"], orderBy: { description: "ASC" } }),
      em.find(Schedule, { day }, { populate: ["person", "room"] }),
      em.find(Appointment, { date }, { populate: ["professional", "patient", "room"], orderBy: { initialHour: "ASC" } }),
      this.openingHours(),
    ]);

    // El horario de un profesional dado de baja quedaría dibujado en la grilla sin que
    // nadie vaya a atender ahí.
    const active = schedules.filter((schedule) => schedule.person.active);
    const live = appointments.filter((appointment) => !isCancelled(appointment.state));

    return {
      date: toISODate(date),
      day: dayName(date),
      ...hours,
      rooms: rooms.map((room) => ({
        idRoom: room.idRoom!,
        description: room.description,
        office: { idOffice: room.office.idOffice!, description: room.office.description },
      })),
      schedules: active.map((schedule) => ({
        idRoom: schedule.room.idRoom!,
        initialHour: hour(schedule.initialHour),
        finalHour: hour(schedule.finalHour),
        duration: schedule.duration,
        professional: personView(schedule.person),
      })),
      appointments: live.map((appointment) => ({
        numAppointment: appointment.numAppointment!,
        idRoom: appointment.room.idRoom!,
        initialHour: hour(appointment.initialHour),
        finalHour: hour(appointment.finalHour),
        state: appointment.state,
        /** Fuera de los módulos del profesional: lo metió a mano. */
        overbooked: !!appointment.overbooked,
        /** Salió de un turno que se repite solo. */
        recurring: !!appointment.recurrence,
        professional: personView(appointment.professional),
        patient: appointment.patient ? personView(appointment.patient) : null,
      })),
      /** Los cancelados no se dibujan, pero saber que estuvieron explica un hueco raro. */
      cancelled: appointments.length - live.length,
    };
  }

  /**
   * Cómo viene la semana, día por día.
   *
   * Contesta las tres preguntas que se hacen mirando un edificio: a qué hora hay que
   * abrir y cerrar, cuándo va a estar lleno, y cuánta gente va a pasar.
   *
   * La apertura y el cierre salen de los horarios de atención (quién dijo que viene) y
   * las dos cantidades salen de los turnos (quién tiene algo que hacer). No es una
   * inconsistencia: son dos preguntas distintas, y mezclarlas daría "abre 8" los días en
   * que ese profesional no tiene ni un turno.
   */
  async forWeek(weeksAhead = 0) {
    const monday = addDays(mondayOf(startOfDay(new Date())), weeksAhead * 7);
    const sunday = addDays(monday, 6);
    const today = startOfDay(new Date());

    const [schedules, appointments] = await Promise.all([
      em.find(Schedule, {}, { populate: ["person", "room"] }),
      em.find(
        Appointment,
        { date: { $gte: monday, $lte: sunday } },
        { populate: ["professional", "patient", "room"], orderBy: { initialHour: "ASC" } }
      ),
    ]);

    const active = schedules.filter((schedule) => schedule.person.active);
    const live = appointments.filter((appointment) => !isCancelled(appointment.state));

    const days = [];

    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(monday, offset);
      const day = scheduleDay(date);

      const daySchedules = active.filter((schedule) => schedule.day === day);
      const dayAppointments = live.filter((appointment) => startOfDay(appointment.date).getTime() === date.getTime());

      days.push({
        date: toISODate(date),
        day: dayName(date),
        isToday: date.getTime() === today.getTime(),
        earliest: this.edge(daySchedules, "initialHour", "min"),
        latest: this.edge(daySchedules, "finalHour", "max"),
        peak: this.peakHour(dayAppointments),
        patients: new Set(dayAppointments.map((a) => a.patient?.email).filter(Boolean)).size,
        professionals: new Set(dayAppointments.map((a) => a.professional.email)).size,
        appointments: dayAppointments.length,
      });
    }

    return { from: toISODate(monday), to: toISODate(sunday), weeksAhead, days };
  }

  /**
   * La punta del día: quién abre y quién cierra.
   *
   * Devuelve a todos los que empatan en esa hora, no al primero que aparece. Es el dato
   * que hace falta cuando hay que pedirle a alguien que abra: si son tres, son tres.
   */
  private edge(schedules: Schedule[], field: "initialHour" | "finalHour", pick: "min" | "max") {
    if (schedules.length === 0) return null;

    const hours = schedules.map((schedule) => hour(schedule[field]));
    const edge = pick === "min" ? hours.reduce((a, b) => (b < a ? b : a)) : hours.reduce((a, b) => (b > a ? b : a));

    // Un profesional con dos módulos ese día no tiene por qué aparecer dos veces.
    const people = new Map<string, ReturnType<typeof personView>>();
    for (const schedule of schedules) {
      if (hour(schedule[field]) === edge) people.set(schedule.person.email, personView(schedule.person));
    }

    return { hour: edge, professionals: Array.from(people.values()) };
  }

  /**
   * La hora de mayor concurrencia, como una franja de una hora.
   *
   * Se mide en turnos que pisan la franja, que es lo mismo que decir cuánta gente hay
   * adentro del edificio a la vez. Va de hora en punto a hora en punto porque es como se
   * dice: "de 10 a 11 esto se llena".
   *
   * Ante un empate gana la más temprana: entre dos horas igual de cargadas, la que sirve
   * para organizar el día es la primera.
   */
  private peakHour(appointments: Appointment[]) {
    if (appointments.length === 0) return null;

    const first = Math.floor(Math.min(...appointments.map((a) => minutes(a.initialHour))) / 60) * 60;
    const last = Math.max(...appointments.map((a) => minutes(a.finalHour)));

    let bestFrom = first;
    let bestCount = 0;

    for (let from = first; from < last; from += 60) {
      const to = from + 60;
      const count = appointments.filter((a) => minutes(a.initialHour) < to && minutes(a.finalHour) > from).length;
      if (count > bestCount) {
        bestCount = count;
        bestFrom = from;
      }
    }

    const to = bestFrom + 60;
    const inBand = appointments.filter((a) => minutes(a.initialHour) < to && minutes(a.finalHour) > bestFrom);

    return {
      from: hhmm(bestFrom),
      to: hhmm(to),
      appointments: inBand.length,
      patients: new Set(inBand.map((a) => a.patient?.email).filter(Boolean)).size,
      professionals: new Set(inBand.map((a) => a.professional.email)).size,
      // Los turnos de la franja: es lo que se abre al tocarla, para saber de quién son.
      items: inBand.map((appointment) => ({
        numAppointment: appointment.numAppointment!,
        initialHour: hour(appointment.initialHour),
        finalHour: hour(appointment.finalHour),
        state: appointment.state,
        overbooked: !!appointment.overbooked,
        room: appointment.room.description,
        professional: personView(appointment.professional),
        patient: appointment.patient ? personView(appointment.patient) : null,
      })),
    };
  }
}
