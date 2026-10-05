import { EntityManager } from "@mikro-orm/mysql";
import { OfficeService } from "../offices/offices.service.js";
import { PeopleService } from "../people/people.service.js";
import { Person } from "../people/people.entity.js";
import { RoomService } from "../rooms/rooms.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { AppointmentService } from "./appointments.service.js";
import { Appointment } from "./appointments.entity.js";
import { badRequest, conflict } from "../shared/errors.js";
import { SettingsService } from "../settings/settings.service.js";
import { startOfDay, toISODate } from "../shared/dates.js";
import { assertCanSeePatient } from "../people/patientVisibility.js";
import { cachedWords, config, officeWords, type Config } from "../installation/installation.service.js";
import { capital } from "../shared/capital.js";
import { acceptsAutomatically } from "../shared/policies.js";
import {
  bookingHorizonEnd,
  gridAnchor,
  hourOf,
  isOnGrid,
  minutesOf,
  slotStarts,
  withinBookingHorizon,
  type GridModule,
  type GridOffice,
} from "./slotGrid.js";
const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/** El módulo de un horario de atención, en la forma que entiende la grilla. */
function moduleOf(schedule: { initialHour: string; finalHour: string; duration: number }): GridModule {
  return { start: minutesOf(schedule.initialHour), end: minutesOf(schedule.finalHour), duration: schedule.duration };
}

/** El horario de una sucursal, en la forma que entiende la grilla. */
function officeOf(office: { openingTime: string; closingTime: string } | null | undefined): GridOffice | null {
  if (!office?.openingTime || !office?.closingTime) return null;
  return { opens: minutesOf(office.openingTime), closes: minutesOf(office.closingTime) };
}

/**
 * La franja que tiene que estar libre en la agenda del profesional para dar este turno.
 *
 * Es el turno más el colchón de cada lado. Con el colchón en cero es el turno y nada más,
 * que es lo que se miraba siempre.
 */
function withBuffer(initialHour: string, finalHour: string, rules: Config): [string, string] {
  if (!rules.bufferMinutes) return [initialHour, finalHour];
  return [hourOf(minutesOf(initialHour) - rules.bufferMinutes), hourOf(minutesOf(finalHour) + rules.bufferMinutes)];
}

/**
 * Desde cuándo se puede reservar.
 *
 * La hora actual sin los segundos, más el aviso mínimo. Sin los segundos porque la lista
 * comparaba siempre de a minutos: a las 15:30:40 el turno de las 15:30 todavía se ofrecía, y
 * cambiar eso sería cambiar qué ve la gente sin que nadie lo haya pedido.
 */
function earliestBookable(now: Date, rules: Config): Date {
  const floor = new Date(now);
  floor.setSeconds(0, 0);
  return new Date(floor.getTime() + rules.minNoticeMinutes * 60 * 1000);
}

/** Un día a una hora "HH:MM", en hora local. */
function at(day: Date, minutes: number): Date {
  const moment = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  moment.setMinutes(minutes);
  return moment;
}

/** Nombre del día, en local, tal como se guardan los horarios de atención. */
function dayNameOf(date: Date): string {
  const parsed = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return DAY_NAMES[local.getDay()];
}

/** Suma minutos a un "HH:MM" y devuelve otro "HH:MM". */
function addMinutes(hour: string, minutes: number): string {
  const [h, m] = hour.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export class AppointmentEngine {
  private peopleService: PeopleService;
  private scheduleService: ScheduleService;
  private officeService: OfficeService;
  private roomService: RoomService;
  private appointmentService: AppointmentService;
  private settingsService: SettingsService;
  private em: EntityManager;

  constructor(
    people: PeopleService,
    schedule: ScheduleService,
    office: OfficeService,
    room: RoomService,
    appointment: AppointmentService,
    em: EntityManager
  ) {
    this.peopleService = people;
    this.scheduleService = schedule;
    this.officeService = office;
    this.roomService = room;
    this.appointmentService = appointment;
    this.settingsService = new SettingsService();
    this.em = em;
  }

  async validateAndCreateProfessionalAppointment(
    date: Date,
    initialHour: string,
    finalHour: string,
    idRoom: number,
    value: number,
    professionalEmail: string,
    patientEmail?: string,
    overbooked = false
  ) {
    // Un turno normal tiene que caer dentro de un módulo de atención del profesional y
    // durar lo que dura ese módulo. El sobreturno existe justamente para saltearse esto,
    // así que ahí no se chequea nada.
    const rules = await config();
    const w = await officeWords();

    if (!overbooked) await this.assertFitsSchedule(date, initialHour, finalHour, idRoom, professionalEmail, rules);

    // El colchón entre turnos es parte de la grilla, así que el sobreturno no lo respeta:
    // es justamente meter a alguien donde la grilla no deja.
    const [busyFrom, busyTo] = overbooked ? [initialHour, finalHour] : withBuffer(initialHour, finalHour, rules);

    if (await this.appointmentService.checkProfessionalAppointmentOverlap(busyFrom, busyTo, professionalEmail, date, this.em))
      throw conflict(
        overbooked || !rules.bufferMinutes
          ? `Ya tenés ${w.otro("turno")} que se superpone con ese horario`
          : `Ya tenés ${w.otro("turno")} a menos de ${rules.bufferMinutes} minutos de ese horario`
      );

    // Antes que el cruce de horarios: si el paciente es uno sin cuenta de otro profesional,
    // decir que "ya tiene otro turno" contaría algo de alguien que acá no existe.
    const patient = patientEmail ? await this.peopleService.findPersonByEmail(patientEmail, this.em) : null;
    if (patient) {
      await assertCanSeePatient(patient, professionalEmail, this.em);
      assertPatientEnabled(patient);
    }

    // El sobreturno se saltea los módulos, no la agenda del paciente: nadie está en dos
    // turnos a la vez. Sin esto se le podía cargar uno encima de otro que ya tenía, con
    // este profesional o con otro.
    if (patientEmail && (await this.appointmentService.checkPatientAppointmentOverlap(initialHour, finalHour, patientEmail, date, this.em)))
      throw conflict(`${w.El("paciente")} ya tiene ${w.otro("turno")} que se superpone con ese horario`);

    const room = await this.roomService.findRoomById(idRoom, this.em);

    if (!room.active) throw badRequest(`${w.El("sala")} que elegiste está dad${w.o("sala")} de baja`);

    const appointment = this.em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      professional: await this.peopleService.findPersonByEmail(professionalEmail, this.em),
      patient,
      room,
      value,
      state: "accepted",
      observations: null,
      // Nace sin cobrar. Es lo que lo pone en la lista de lo que falta cobrar.
      paymentState: "unpaid",
      reminderSent: "not sent",
      overbooked,
      origin: "professional",
    });

    return appointment;
  }

  /**
   * Chequea que la franja elegida sea uno de los turnos que el profesional atiende ese
   * día. Los mensajes cuentan qué está mal y recuerdan la salida: marcarlo como
   * sobreturno.
   */
  private async assertFitsSchedule(
    date: Date,
    initialHour: string,
    finalHour: string,
    idRoom: number,
    professionalEmail: string,
    rules: Config
  ) {
    const day = dayNameOf(date);
    const schedule = await this.scheduleService.findScheduleForSlot(professionalEmail, day, initialHour, this.em);
    const w = await officeWords();

    if (!schedule)
      throw badRequest(
        `No atendés los ${day} a las ${initialHour}. Si querés dar${w.lo("turno")} igual, marca${w.lo("turno")} como sobreturno.`
      );

    if (String(schedule.room.idRoom) !== String(idRoom))
      throw badRequest(
        `Los ${day} a las ${initialHour} atendés en ${schedule.room.description}: elegí ${w.ese("sala")} o marca${w.lo("turno")} como sobreturno.`
      );

    // La misma grilla que ve el paciente, con la misma ancla. Si la del profesional
    // arrancara en el módulo y la del paciente en la apertura, los dos cargarían turnos
    // desfasados en la misma agenda y se pisarían los bordes.
    const module = moduleOf(schedule);
    const office = officeOf((schedule.room as any)?.office);

    if (!isOnGrid(minutesOf(initialHour), module, office, rules)) {
      const anchor = gridAnchor(module, office, rules);
      const from = anchor === module.start ? schedule.initialHour : hourOf(anchor);
      const cadence = rules.slotStepMinutes
        ? `${w.un("turno")} cada ${rules.slotStepMinutes} minutos`
        : `${w.turnos} de ${schedule.duration} minutos`;
      throw badRequest(
        `Ese módulo arranca a las ${from} con ${cadence}, así que ${initialHour} no es el inicio de ${w.o("turno") === "a" ? "ninguna" : "ninguno"}. Marca${w.lo("turno")} como sobreturno si querés dar${w.lo("turno")} igual.`
      );
    }

    const expectedFinal = addMinutes(initialHour, schedule.duration);

    if (finalHour !== expectedFinal)
      throw badRequest(`${w.Un("turno")} de ese módulo dura ${schedule.duration} minutos. Tendría que terminar a las ${expectedFinal}.`);

    if (expectedFinal > schedule.finalHour)
      throw badRequest(`${capital(w.ese("turno"))} terminaría a las ${expectedFinal} y ese día atendés hasta las ${schedule.finalHour}.`);
  }

  async validateAndCreateAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    professionalEmail: string,
    officeId: number
  ) {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);
    const w = await officeWords();

    this.assertCanTakeAppointments(professional);

    // El profesional puede sacar turno como paciente, pero no consigo mismo: estaría
    // ocupando su propio módulo con un turno que no atiende nadie. La pantalla ya no lo
    // ofrece; esto es lo que lo hace cierto.
    if (professional.email === patientEmail) throw badRequest(`No podés sacar ${w.un("turno")} con vos mismo`);
    const office = await this.officeService.findOficeById(officeId, this.em);

    if (!office.active) throw badRequest(`${w.El("sucursal")} que elegiste está dad${w.o("sucursal")} de baja`);
    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const parsed = typeof date === "string" ? new Date(date + "T00:00:00") : date;

    // Asegura que sea interpretado como hora local
    const year = parsed.getFullYear();
    const month = parsed.getMonth();
    const day = parsed.getDate();
    const localDate = new Date(year, month, day); // esto ya es local
    const dayName = days[localDate.getDay()];

    const rules = await config();
    const now = new Date();

    // Lo que la lista no ofrece, la reserva no lo acepta. Antes la lista calculaba un
    // horizonte, la pantalla recortaba otro y la reserva no miraba ninguno: por el celular
    // o por el asistente se podía sacar un turno que la web no mostraba.
    if (!withinBookingHorizon(localDate, now, rules.bookingWeeksAhead))
      throw badRequest(`Todavía no se pueden pedir ${w.turnos} para esa fecha`);

    if (localDate.getDay() === 0 && !rules.opensSunday) throw badRequest("Los domingos no se atiende");

    // La licencia se chequea acá y no solo al listar horarios libres: la lista se arma
    // una vez y el paciente puede tardar en elegir, así que entre que la vio y confirmó
    // el profesional pudo haber cargado las vacaciones.
    const vacationDays = await this.settingsService.vacationDays(professionalEmail);

    if (vacationDays.has(toISODate(localDate)))
      throw badRequest(`${w.El("profesional")} no atiende ese día. Elegí otra fecha`);

    const schedule = await this.scheduleService.findScheduleByHourRange(initialHour, dayName, professional, office, this.em);
    // We ask for the office eventhough it's not strictly necessary, to ensure in case of schedule overlaps that the office is the correct one

    // En minutos y no armando un Date de hoy: aquel cruzaba mal la medianoche y dependía de
    // la zona horaria del proceso para algo que es una suma.
    const finalHour = hourOf(minutesOf(initialHour) + schedule.duration);

    if (finalHour > schedule.finalHour)
      throw badRequest(
        `${capital(w.ese("turno"))} terminaría a las ${finalHour} y ${w.el("profesional")} atiende hasta las ${schedule.finalHour}`
      );

    // Solo con un aviso mínimo cargado. En cero la reserva no miraba la hora, y empezar a
    // mirarla rechazaría el turno que alguien eligió a las 15:29 y confirmó a las 15:31.
    if (rules.minNoticeMinutes > 0 && at(localDate, minutesOf(initialHour)) < earliestBookable(now, rules))
      throw badRequest(`${w.Los("turno")} se piden con ${rules.minNoticeMinutes} minutos de anticipación como mínimo`);

    if (await this.appointmentService.checkPatientAppointmentOverlap(initialHour, finalHour, patientEmail, date, this.em))
      throw conflict(`Ya tenés ${w.otro("turno")} que se superpone con ese horario`);

    const module = moduleOf(schedule);

    if (!isOnGrid(minutesOf(initialHour), module, officeOf(office), rules)) {
      const anchor = gridAnchor(module, officeOf(office), rules);
      const from = anchor === module.start ? schedule.initialHour : hourOf(anchor);
      throw badRequest(
        rules.slotStepMinutes
          ? `${w.Los("turno")} de ese día arrancan a las ${from}, ${w.o("turno") === "a" ? "una" : "uno"} cada ${rules.slotStepMinutes} minutos. ${initialHour} no cae en el inicio de ${w.o("turno") === "a" ? "ninguna" : "ninguno"}`
          : `${w.Los("turno")} de ese día arrancan a las ${from} y duran ${schedule.duration} minutos. ${initialHour} no cae en el inicio de ${w.o("turno") === "a" ? "ninguna" : "ninguno"}`
      );
    }

    if (rules.maxActiveAppointments > 0) {
      const active = await this.em.count(Appointment, {
        patient: { email: patientEmail },
        state: { $in: ["pending", "accepted"] },
        date: { $gte: startOfDay(now) },
      });

      if (active >= rules.maxActiveAppointments)
        // Con uno solo, en singular: "Ya tenés 1 turnos pedidos" se lee como un error.
        throw conflict(
          active === 1
            ? `Ya hay ${w.un("turno")} pedid${w.o("turno")}. Se puede tener ${w.un("turno")} a la vez como máximo`
            : `Ya tenés ${active} ${w.turnos} pedid${w.os("turno")}. Se pueden tener ${rules.maxActiveAppointments} a la vez como máximo`
        );
    }

    const room = schedule.room;

    if (!room.active) throw badRequest(`${w.El("sala")} asignad${w.o("sala")} a ese horario está dad${w.o("sala")} de baja`);

    // El mismo control que filtra la lista de horarios libres, otra vez al confirmar. La
    // lista se arma una vez y el paciente puede tardar en elegir; entre medio el admin
    // pudo cambiar el horario de la sucursal. Y sin esto el control vivía solo en lo que
    // se muestra: una request armada a mano entraba igual.
    if (initialHour < office.openingTime || finalHour > office.closingTime)
      throw badRequest(
        `${w.El("sucursal")} abre de ${office.openingTime} a ${office.closingTime}: a esa hora no hay nadie para atenderte`
      );

    const [busyFrom, busyTo] = withBuffer(initialHour, finalHour, rules);

    if (await this.appointmentService.checkProfessionalAppointmentOverlap(busyFrom, busyTo, professionalEmail, date, this.em))
      throw conflict("Ese horario ya está ocupado. Elegí otro");

    const appointment = this.em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      professional,
      patient: await this.peopleService.findPersonByEmail(patientEmail, this.em),
      room,
      value: 0,
      // Con la confirmación automática el turno nace ocupando el horario, sin pasar por la
      // bandeja de pedidos del profesional. La decide él, salvo que el consultorio la imponga.
      state: acceptsAutomatically((await config()).policies, professional) ? "accepted" : "pending",
      observations: null,
      // Nace sin cobrar. Es lo que lo pone en la lista de lo que falta cobrar.
      paymentState: "unpaid",
      reminderSent: "not sent",
      // El paciente solo puede sacar turno en las franjas que el profesional publica.
      overbooked: false,
      origin: "patient",
    });

    return appointment;
  }

  /**
   * Que el profesional elegido pueda recibir turnos.
   *
   * Se llama en los dos momentos del circuito —cuando se arma la lista de horarios y
   * cuando se confirma— y no solo en el primero: entre que el paciente ve los horarios y
   * toca confirmar pasan minutos, y en el medio el admin pudo darlo de baja. Es el mismo
   * cuidado que unas líneas más abajo ya tenían las licencias.
   *
   * La lista de profesionales de la sucursal ya filtra por esto, así que por la pantalla
   * no se llega; lo que faltaba era que fuera cierto también para quien entra por otro
   * lado —una pantalla vieja, un link directo, la ruta de la app que nombra al
   * profesional en la dirección—.
   *
   * `active` y `bookable` son cosas distintas —una cuenta cerrada y alguien que por ahora
   * no toma turnos— pero para quien quiere sacar uno significan lo mismo, y el mensaje no
   * las distingue a propósito: si la cuenta de una persona está dada de baja no es asunto
   * de un paciente.
   */
  private assertCanTakeAppointments(professional: Person): void {
    const w = cachedWords();
    if (professional.type !== "professional") throw badRequest(`La persona elegida no es ${w.un("profesional")}`);

    if (!professional.active || !professional.bookable)
      throw badRequest(`${capital(w.ese("profesional"))} no está tomando ${w.turnos}. Elegí ${w.o("profesional") === "a" ? "otra" : "otro"}`);
  }

  async getAvailableAppointmentsForPatient(
    patientEmail: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Array<{ date: Date; initialHour: string; finalHour: string }>> {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);
    this.assertCanTakeAppointments(professional);

    const office = await this.officeService.findOficeById(officeId, this.em);
    if (!office.active) {
      const w = await officeWords();
      throw badRequest(`${w.El("sucursal")} que elegiste está dad${w.o("sucursal")} de baja`);
    }

    const schedules = await this.scheduleService.findSchedulesByProfessionalAndOffice(professional, office, this.em);

    // Los días de licencia siguen contando como días hábiles del horizonte: si alguien se
    // toma dos semanas, el paciente no ve horarios en vez de ver los de la vuelta. Que la
    // agenda aparezca vacía es la respuesta correcta a "¿cuándo puedo ir?".
    const vacationDays = await this.settingsService.vacationDays(professionalEmail);

    const availableSlots: Array<{ date: Date; initialHour: string; finalHour: string }> = [];

    const rules = await config();

    // La sucursal manda por encima del horario que tenga cargado el profesional. Los dos
    // se editan por separado —el admin cambia el horario del edificio, el profesional sus
    // módulos— y nadie vuelve a revisar al otro, así que un módulo de 08:00 sobrevive a
    // que la sucursal pase a abrir 10:00. Ofrecerlo manda a alguien a una puerta cerrada.
    // Cómo se reparte el módulo frente a ese horario lo decide la grilla (ver slotGrid).
    const officeHours = officeOf(office);

    const now = new Date();
    const earliest = earliestBookable(now, rules);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Hasta el último día que se puede reservar, que es el mismo que controla la reserva y
    // el mismo que mira la lista de espera.
    const lastDay = bookingHorizonEnd(now, rules.bookingWeeksAhead);

    for (let currentDate = new Date(today); currentDate <= lastDay; currentDate.setDate(currentDate.getDate() + 1)) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 && !rules.opensSunday) continue;

      const dayName = DAY_NAMES[dayOfWeek];
      const daySchedules = vacationDays.has(toISODate(currentDate)) ? [] : schedules.filter((s) => s.day === dayName);

      for (const schedule of daySchedules) {
        for (const start of slotStarts(moduleOf(schedule), officeHours, rules)) {
          // Lo que ya pasó, o lo que está más cerca que el aviso mínimo, no se ofrece.
          if (at(currentDate, start) < earliest) continue;

          const initialHour = hourOf(start);
          const finalHour = hourOf(start + schedule.duration);

          const patientHasConflict = await this.appointmentService.checkPatientAppointmentOverlap(
            initialHour,
            finalHour,
            patientEmail,
            new Date(currentDate),
            this.em
          );

          if (patientHasConflict) continue;

          const [busyFrom, busyTo] = withBuffer(initialHour, finalHour, rules);
          const professionalConflict = await this.appointmentService.checkProfessionalAppointmentOverlap(
            busyFrom,
            busyTo,
            professionalEmail,
            new Date(currentDate),
            this.em
          );

          if (!professionalConflict) availableSlots.push({ date: new Date(currentDate), initialHour, finalHour });
        }
      }
    }

    return availableSlots;
  }
}

/**
 * Que a ese paciente se le puedan cargar turnos.
 *
 * Una cuenta deshabilitada está afuera del sistema, y eso incluye la agenda: darle un
 * turno sería anotar a alguien que no va a recibir la confirmación ni el recordatorio, y
 * que dentro de unas semanas se borra con todo lo suyo (ver accountCleanup).
 *
 * El mensaje dice qué hacer, porque quien lo lee es el profesional que tiene a la persona
 * enfrente y no tiene forma de saber por qué la dieron de baja.
 */
export function assertPatientEnabled(patient: Person): void {
  if (patient.active) return;

  const w = cachedWords();
  throw badRequest(`${w.El("paciente")} está deshabilitad${w.o("paciente")}, consultar a un administrador`);
}
