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
import { toISODate } from "../shared/dates.js";
const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

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
    if (!overbooked) await this.assertFitsSchedule(date, initialHour, finalHour, idRoom, professionalEmail);

    if (await this.appointmentService.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, this.em))
      throw conflict("Ya tenés otro turno que se superpone con ese horario");

    const room = await this.roomService.findRoomById(idRoom, this.em);

    if (!room.active) throw badRequest("El consultorio que elegiste está dado de baja");

    const appointment = this.em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      professional: await this.peopleService.findPersonByEmail(professionalEmail, this.em),
      patient: patientEmail ? await this.peopleService.findPersonByEmail(patientEmail, this.em) : null,
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
  private async assertFitsSchedule(date: Date, initialHour: string, finalHour: string, idRoom: number, professionalEmail: string) {
    const day = dayNameOf(date);
    const schedule = await this.scheduleService.findScheduleForSlot(professionalEmail, day, initialHour, this.em);

    if (!schedule)
      throw badRequest(`No atendés los ${day} a las ${initialHour}. Si querés darlo igual, marcalo como sobreturno.`);

    if (String(schedule.room.idRoom) !== String(idRoom))
      throw badRequest(`Los ${day} a las ${initialHour} atendés en ${schedule.room.description}: elegí ese consultorio o marcalo como sobreturno.`);

    if (await this.appointmentService.checkAppointmentDurationFormat(initialHour, schedule.initialHour, schedule.duration))
      throw badRequest(
        `Ese módulo arranca a las ${schedule.initialHour} con turnos de ${schedule.duration} minutos, así que ${initialHour} no es el inicio de ninguno. Marcalo como sobreturno si querés darlo igual.`
      );

    const expectedFinal = addMinutes(initialHour, schedule.duration);

    if (finalHour !== expectedFinal)
      throw badRequest(`Un turno de ese módulo dura ${schedule.duration} minutos: tendría que terminar a las ${expectedFinal}.`);

    if (expectedFinal > schedule.finalHour)
      throw badRequest(`Ese turno terminaría a las ${expectedFinal} y ese día atendés hasta las ${schedule.finalHour}.`);
  }

  async validateAndCreateAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    professionalEmail: string,
    officeId: number
  ) {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);

    this.assertCanTakeAppointments(professional);

    // El profesional puede sacar turno como paciente, pero no consigo mismo: estaría
    // ocupando su propio módulo con un turno que no atiende nadie. La pantalla ya no lo
    // ofrece; esto es lo que lo hace cierto.
    if (professional.email === patientEmail) throw badRequest("No podés sacar un turno con vos mismo");
    const office = await this.officeService.findOficeById(officeId, this.em);

    if (!office.active) throw badRequest("El consultorio que elegiste está dado de baja");
    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const parsed = typeof date === "string" ? new Date(date + "T00:00:00") : date;

    // Asegura que sea interpretado como hora local
    const year = parsed.getFullYear();
    const month = parsed.getMonth();
    const day = parsed.getDate();
    const localDate = new Date(year, month, day); // esto ya es local
    const dayName = days[localDate.getDay()];

    // La licencia se chequea acá y no solo al listar horarios libres: la lista se arma
    // una vez y el paciente puede tardar en elegir, así que entre que la vio y confirmó
    // el profesional pudo haber cargado las vacaciones.
    const vacationDays = await this.settingsService.vacationDays(professionalEmail);

    if (vacationDays.has(toISODate(localDate)))
      throw badRequest("El profesional no atiende ese día. Elegí otra fecha");

    const schedule = await this.scheduleService.findScheduleByHourRange(initialHour, dayName, professional, office, this.em);
    // We ask for the office eventhough it's not strictly necessary, to ensure in case of schedule overlaps that the office is the correct one

    const [hours, minutes] = initialHour.split(":").map(Number);
    const startDateTime = new Date();
    startDateTime.setHours(hours, minutes, 0, 0);
    startDateTime.setMinutes(startDateTime.getMinutes() + schedule.duration);
    const finalHour = startDateTime.toTimeString().slice(0, 5);

    if (finalHour > schedule.finalHour)
      throw badRequest(`Ese turno terminaría a las ${finalHour} y el profesional atiende hasta las ${schedule.finalHour}`);

    if (await this.appointmentService.checkPatientAppointmentOverlap(initialHour, finalHour, patientEmail, date, this.em))
      throw conflict("Ya tenés otro turno que se superpone con ese horario");

    if (await this.appointmentService.checkAppointmentDurationFormat(initialHour, schedule.initialHour, schedule.duration))
      throw badRequest(
        `Los turnos de ese día arrancan a las ${schedule.initialHour} y duran ${schedule.duration} minutos: ${initialHour} no cae en el inicio de ninguno`
      );

    const room = schedule.room;

    if (!room.active) throw badRequest("El consultorio asignado a ese horario está dado de baja");

    // El mismo control que filtra la lista de horarios libres, otra vez al confirmar. La
    // lista se arma una vez y el paciente puede tardar en elegir; entre medio el admin
    // pudo cambiar el horario de la sucursal. Y sin esto el control vivía solo en lo que
    // se muestra: una request armada a mano entraba igual.
    if (initialHour < office.openingTime || finalHour > office.closingTime)
      throw badRequest(
        `La sucursal abre de ${office.openingTime} a ${office.closingTime}: a esa hora no hay nadie para atenderte`
      );

    if (await this.appointmentService.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, this.em))
      throw conflict("Ese horario ya está ocupado. Elegí otro");

    const appointment = this.em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      professional,
      patient: await this.peopleService.findPersonByEmail(patientEmail, this.em),
      room,
      value: 0,
      // Con la confirmación automática prendida el turno nace ocupando el horario, sin
      // pasar por la bandeja de pedidos del profesional.
      state: professional.autoAccept ? "accepted" : "pending",
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
    if (professional.type !== "professional") throw badRequest("La persona elegida no es un profesional");

    if (!professional.active || !professional.bookable)
      throw badRequest("Ese profesional no está tomando turnos. Elegí otro");
  }

  async getAvailableAppointmentsForPatient(
    patientEmail: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Array<{ date: Date; initialHour: string; finalHour: string }>> {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);
    this.assertCanTakeAppointments(professional);

    const office = await this.officeService.findOficeById(officeId, this.em);
    if (!office.active) throw badRequest("El consultorio que elegiste está dado de baja");

    const schedules = await this.scheduleService.findSchedulesByProfessionalAndOffice(professional, office, this.em);

    // Los días de licencia siguen contando como días hábiles del horizonte: si alguien se
    // toma dos semanas, el paciente no ve horarios en vez de ver los de la vuelta. Que la
    // agenda aparezca vacía es la respuesta correcta a "¿cuándo puedo ir?".
    const vacationDays = await this.settingsService.vacationDays(professionalEmail);

    const availableSlots: Array<{ date: Date; initialHour: string; finalHour: string }> = [];

    // La sucursal manda por encima del horario que tenga cargado el profesional. Los dos
    // se editan por separado —el admin cambia el horario del edificio, el profesional sus
    // módulos— y nadie vuelve a revisar al otro, así que un módulo de 08:00 sobrevive a
    // que la sucursal pase a abrir 10:00. Ofrecerlo manda a alguien a una puerta cerrada.
    const minutesOf = (hour: string) => {
      const [hours, minutes] = String(hour ?? "").split(":").map(Number);
      return hours * 60 + minutes;
    };

    const officeOpens = minutesOf(office.openingTime);
    const officeCloses = minutesOf(office.closingTime);

    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    let businessDaysCount = 0;
    let currentDate = new Date(today);

    while (businessDaysCount < 12) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0) {
        const dayName = days[dayOfWeek];
        const daySchedules = vacationDays.has(toISODate(currentDate)) ? [] : schedules.filter((s) => s.day === dayName);

        const isToday = currentDate.toDateString() === now.toDateString();

        // 4. Obtén los minutos actuales (solo si es "hoy")
        const realCurrentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

        for (const schedule of daySchedules) {
          const [scheduleHours, scheduleMinutes] = schedule.initialHour.split(":").map(Number);
          const [finalHours, finalMinutes] = schedule.finalHour.split(":").map(Number);
          const scheduleInitialMinutes = scheduleHours * 60 + scheduleMinutes;
          const scheduleFinalMinutes = finalHours * 60 + finalMinutes;

          let currentMinutes = scheduleInitialMinutes;

          while (currentMinutes + schedule.duration <= scheduleFinalMinutes) {
            if (isToday && currentMinutes < realCurrentMinutes) {
              currentMinutes += schedule.duration; // Avanza al siguiente slot
              continue; // Omite el resto del código y sigue con el próximo slot
            }

            // Se saltea el turno en vez de arrancar el bucle en la hora de apertura: al
            // reservar se controla que la hora sea un múltiplo exacto de la duración
            // contado desde el arranque del módulo, y correr el arranque ofrecería
            // horarios que después el propio sistema rechaza.
            if (currentMinutes < officeOpens || currentMinutes + schedule.duration > officeCloses) {
              currentMinutes += schedule.duration;
              continue;
            }

            const slotHours = Math.floor(currentMinutes / 60);
            const slotMinutes = currentMinutes % 60;
            const initialHour = `${slotHours.toString().padStart(2, "0")}:${slotMinutes.toString().padStart(2, "0")}`;

            const finalMinutes = currentMinutes + schedule.duration;
            const finalSlotHours = Math.floor(finalMinutes / 60);
            const finalSlotMinutes = finalMinutes % 60;
            const finalHour = `${finalSlotHours.toString().padStart(2, "0")}:${finalSlotMinutes.toString().padStart(2, "0")}`;

            const patientHasConflict = await this.appointmentService.checkPatientAppointmentOverlap(
              initialHour,
              finalHour,
              patientEmail,
              new Date(currentDate),
              this.em
            );

            if (!patientHasConflict) {
              const professionalConflict = await this.appointmentService.checkProfessionalAppointmentOverlap(
                initialHour,
                finalHour,
                professionalEmail,
                new Date(currentDate),
                this.em
              );

              if (!professionalConflict) {
                availableSlots.push({ date: new Date(currentDate), initialHour, finalHour });
              }
            }

            currentMinutes += schedule.duration;
          }
        }

        businessDaysCount++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }
}
