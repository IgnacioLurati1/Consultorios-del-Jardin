import { EntityManager } from "@mikro-orm/mysql";
import { OfficeService } from "../offices/offices.service.js";
import { PeopleService } from "../people/people.service.js";
import { RoomService } from "../rooms/rooms.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { AppointmentService } from "./appointments.service.js";
import { Appointment } from "./appointments.entity.js";
import { badRequest, conflict } from "../shared/errors.js";
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

    if (!room.active) throw badRequest("La sala que elegiste está dada de baja");

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
      reminderSent: "not sent",
      overbooked,
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
      throw badRequest(`Los ${day} a las ${initialHour} atendés en ${schedule.room.description}: elegí esa sala o marcalo como sobreturno.`);

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

    if (professional.type !== "professional") throw badRequest("La persona elegida no es un profesional");
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

    if (!room.active) throw badRequest("La sala asignada a ese horario está dada de baja");

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
      state: "pending",
      observations: null,
      reminderSent: "not sent",
      // El paciente solo puede sacar turno en las franjas que el profesional publica.
      overbooked: false,
    });

    return appointment;
  }

  async getAvailableAppointmentsForPatient(
    patientEmail: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Array<{ date: Date; initialHour: string; finalHour: string }>> {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);
    if (professional.type !== "professional") throw badRequest("La persona elegida no es un profesional");

    const office = await this.officeService.findOficeById(officeId, this.em);
    if (!office.active) throw badRequest("El consultorio que elegiste está dado de baja");

    const schedules = await this.scheduleService.findSchedulesByProfessionalAndOffice(professional, office, this.em);

    const availableSlots: Array<{ date: Date; initialHour: string; finalHour: string }> = [];

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
        const daySchedules = schedules.filter((s) => s.day === dayName);

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
