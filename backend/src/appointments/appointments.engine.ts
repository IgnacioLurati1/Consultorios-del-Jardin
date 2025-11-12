import { EntityManager } from "@mikro-orm/mysql";
import { OfficeService } from "../offices/offices.service.js";
import { PeopleService } from "../people/people.service.js";
import { RoomService } from "../rooms/rooms.services.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { AppointmentService } from "./appointments.service.js";
import { Appointment } from "./appointments.entity.js";
import { Diagnostic } from "./diagnostics.entity.js";
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
    type: "simple" | "taller",
    professionalEmail: string,
    patientEmail?: string
  ) {
    if (await this.appointmentService.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, this.em))
      throw new Error("El profesional ya tiene una cita en este horario");

    const room = await this.roomService.findRoomById(idRoom, this.em);

    if (!room.active) throw new Error("La sala seleccionada no está activa");

    const appointment = this.em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      type,
      professional: await this.peopleService.findPersonByEmail(professionalEmail, this.em),
      room,
      value,
      state: "accepted",
    });

    if (type === "simple" && patientEmail) {
      appointment.diagnostics.add(
        this.em.create(Diagnostic, {
          patient: await this.peopleService.findPersonByEmail(patientEmail, this.em),
          appointment,
          state: "pending",
          observations: null,
        })
      );
    }

    return {
      numAppointment: appointment.numAppointment,
      date: appointment.date,
      initialHour: appointment.initialHour,
      finalHour: appointment.finalHour,
      type: appointment.type,
      state: appointment.state,
    };
  }

  async validateAndCreateAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    type: "simple" | "taller",
    professionalEmail: string,
    officeId: number
  ) {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);

    if (professional.type !== "professional") throw new Error("El email no corresponde a un profesional");
    const office = await this.officeService.findOficeById(officeId, this.em);

    if (!office.active) throw new Error("El consultorio seleccionado no está activo");
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

    if (schedule.allowedType !== type) throw new Error("El tipo de turno no coincide con el tipo de horario");

    const [hours, minutes] = initialHour.split(":").map(Number);
    const startDateTime = new Date();
    startDateTime.setHours(hours, minutes, 0, 0);
    startDateTime.setMinutes(startDateTime.getMinutes() + schedule.duration);
    const finalHour = startDateTime.toTimeString().slice(0, 5);

    if (finalHour > schedule.finalHour) throw new Error("El turno excede la hora final del consultorio");

    if (await this.appointmentService.checkPatientAppointmentOverlap(initialHour, finalHour, patientEmail, date, this.em))
      throw new Error("El paciente ya tiene una cita en este horario");

    if (await this.appointmentService.checkAppointmentDurationFormat(initialHour, schedule.initialHour, schedule.duration))
      throw new Error("La hora inicial no es válida!");

    const room = schedule.room;

    if (!room.active) throw new Error("La sala asignada al horario no está activa");

    let appointment;

    if (type === "taller") {
      appointment = await this.em.findOne(Appointment, {
        date,
        initialHour,
        professional: { email: professionalEmail },
        type: "taller",
        state: { $in: ["pending", "accepted"] },
      });
      if (!appointment) {
        if (await this.appointmentService.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, this.em))
          throw new Error("El profesional ya tiene una cita en este horario");
        appointment = this.em.create(Appointment, {
          date,
          initialHour,
          finalHour,
          type,
          professional,
          room,
          value: 0,
          state: "pending",
        });
      }
    } else {
      if (await this.appointmentService.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, this.em))
        throw new Error("El profesional ya tiene una cita en este horario");
      appointment = this.em.create(Appointment, {
        date,
        initialHour,
        finalHour,
        type,
        professional,
        room,
        value: 0,
        state: "pending",
      });
    }
    appointment.diagnostics.add(
      this.em.create(Diagnostic, {
        patient: await this.peopleService.findPersonByEmail(patientEmail, this.em),
        appointment,
        state: "pending",
        observations: null,
      })
    );

    return {
      numAppointment: appointment.numAppointment,
      date: appointment.date,
      initialHour: appointment.initialHour,
      finalHour: appointment.finalHour,
      type: appointment.type,
      state: appointment.state,
    };
  }

  async getAvailableAppointmentsForPatient(
    patientEmail: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Array<{ date: Date; initialHour: string; finalHour: string; type: "simple" | "taller" }>> {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail, this.em);
    if (professional.type !== "professional") throw new Error("El email no corresponde a un profesional");

    const office = await this.officeService.findOficeById(officeId, this.em);
    if (!office.active) throw new Error("El consultorio seleccionado no está activo");

    const schedules = await this.scheduleService.findSchedulesByProfessionalAndOffice(professional, office, this.em);

    const availableSlots: Array<{ date: Date; initialHour: string; finalHour: string; type: "simple" | "taller" }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    let businessDaysCount = 0;
    let currentDate = new Date(today);

    while (businessDaysCount < 12) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0) {
        const dayName = days[dayOfWeek];
        const daySchedules = schedules.filter((s) => s.day === dayName);

        for (const schedule of daySchedules) {
          const [scheduleHours, scheduleMinutes] = schedule.initialHour.split(":").map(Number);
          const [finalHours, finalMinutes] = schedule.finalHour.split(":").map(Number);
          const scheduleInitialMinutes = scheduleHours * 60 + scheduleMinutes;
          const scheduleFinalMinutes = finalHours * 60 + finalMinutes;

          let currentMinutes = scheduleInitialMinutes;

          while (currentMinutes + schedule.duration <= scheduleFinalMinutes) {
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
              const professionalConflict = await this.em.findOne(
                Appointment,
                {
                  date: new Date(currentDate),
                  initialHour: { $lt: finalHour },
                  finalHour: { $gt: initialHour },
                  state: { $in: ["pending", "accepted"] },
                  professional: { email: professionalEmail },
                },
                { populate: ["diagnostics", "diagnostics.patient"] }
              );

              if (!professionalConflict) {
                if (schedule.allowedType !== "simple" && schedule.allowedType !== "taller") {
                  throw new Error(`Tipo de horario inválido: ${schedule.allowedType}`);
                }
                availableSlots.push({ date: new Date(currentDate), initialHour, finalHour, type: schedule.allowedType });
              } else if (professionalConflict.type === "taller") {
                const patientAlreadyInWorkshop = professionalConflict.diagnostics.getItems().some((d) => d.patient.email === patientEmail);
                if (!patientAlreadyInWorkshop) {
                  availableSlots.push({ date: new Date(currentDate), initialHour, finalHour, type: "taller" });
                }
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
