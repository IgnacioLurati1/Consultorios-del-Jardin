import { orm } from "../shared/db/orm.js";
import { Appointment } from "./appointments.entity.js";
import { Diagnostic } from "./diagnostics.entity.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { OfficeService } from "../offices/offices.service.js";

const em = orm.em;

export class AppointmentService {
  private peopleService: PeopleService;
  private scheduleService: ScheduleService;
  private officeService: OfficeService;

  constructor() {
    this.peopleService = new PeopleService();
    this.scheduleService = new ScheduleService();
    this.officeService = new OfficeService();
  }

  async findPatientAppointmentsByEmail(patientEmail: string): Promise<Appointment[]> {
    return await em.find(Appointment, { diagnostics: { patient: { email: patientEmail } } });
  }

  async getDiagnostic(patientEmail: string, num: number) {
    return await em.findOneOrFail(Diagnostic, { patient: { email: patientEmail }, appointment: { numAppointment: num } });
  }

  async findProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(Appointment, { professional: { email: professionalEmail } }, { populate: ["room", "room.office"] });
  }

  async findPendingProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(
      Appointment,
      { professional: { email: professionalEmail }, cancelDate: "Pending" },
      { populate: ["room", "room.office"] }
    );
  }

  async deleteAppointment(num: number, professionalEmail: string) {
    const appointment = await em.findOneOrFail(Appointment, {
      numAppointment: num,
      cancelDate: "Pending",
      professional: { email: professionalEmail },
    });
    em.remove(appointment);
    await em.flush();
    return appointment;
  }

  async updateAppointment(num: number, professionalEmail: string, data: Partial<Appointment>) {
    const appointment = await em.findOneOrFail(
      Appointment,
      {
        numAppointment: num,
        cancelDate: "Accepted",
        professional: { email: professionalEmail },
      },
      { populate: ["diagnostics", "diagnostics.patient"] }
    );

    if (!data.initialHour || !data.finalHour) throw new Error("Debe proporcionar initialHour y finalHour");

    for (const diagnostic of appointment.diagnostics.getItems()) {
      if (await this.checkPatientAppointmentOverlap(data.initialHour, data.finalHour, diagnostic.patient.email))
        throw new Error("Un paciente ya tiene una cita en este horario"); // We don't specify which one for security reasons
    }

    if (await this.checkProfessionalAppointmentOverlap(data.initialHour, data.finalHour, professionalEmail, appointment.date))
      throw new Error("El profesional ya tiene una cita en este horario");

    em.assign(appointment, data);
    await em.flush();
    return appointment;
  }

  async getAppointmentDiagnostics(num: number): Promise<Diagnostic[]> {
    return await em.find(Diagnostic, { appointment: { numAppointment: num } });
  }

  async checkPatientAppointmentOverlap(initialHour: string, finalHour: string, patientEmail: string): Promise<Appointment | null> {
    const appointment = await em.findOne(Appointment, {
      $and: [
        { initialHour: { $lt: finalHour } },
        { finalHour: { $gt: initialHour } },
        { diagnostics: { patient: { email: patientEmail } } },
      ],
    });
    return appointment;
  }

  async checkProfessionalAppointmentOverlap(
    initialHour: string,
    finalHour: string,
    professionalEmail: string,
    date: Date
  ): Promise<Appointment | null> {
    const appointment = await em.findOne(Appointment, {
      $and: [
        { initialHour: { $lt: finalHour } },
        { finalHour: { $gt: initialHour } },
        { professional: { email: professionalEmail } },
        { date },
      ],
    });
    return appointment;
  }

  async checkAppointmentDurationFormat(initialHour: string, scheduleInitialHour: string, duration: number): Promise<boolean> {
    let [hours, minutes] = initialHour.split(":").map(Number);
    const initialMinutes = hours * 60 + minutes;

    [hours, minutes] = scheduleInitialHour.split(":").map(Number);
    const scheduleInitialMinutes = hours * 60 + minutes;

    const k = (initialMinutes - scheduleInitialMinutes) / duration;

    return !(k >= 0 && Number.isInteger(k));
  }

  async createPatientAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    type: "single" | "group",
    professionalEmail: string,
    officeId: number
  ): Promise<Appointment> {
    const professional = await this.peopleService.findPersonByEmail(professionalEmail);

    if (professional.type !== "professional") throw new Error("El email no corresponde a un profesional");

    const office = await this.officeService.findOficeById(officeId);

    if (!office.active) throw new Error("El consultorio seleccionado no está activo");

    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const dayName = days[new Date(date).getDay()];

    const schedule = await this.scheduleService.findScheduleByHourRange(initialHour, dayName, professional, office);

    if (schedule.allowedType !== type) throw new Error("El tipo de turno no coincide con el tipo de horario");

    const [hours, minutes] = initialHour.split(":").map(Number);
    const startDateTime = new Date();
    startDateTime.setHours(hours, minutes, 0, 0);
    startDateTime.setMinutes(startDateTime.getMinutes() + schedule.duration);
    const finalHour = startDateTime.toTimeString().slice(0, 5);

    if (await this.checkPatientAppointmentOverlap(initialHour, finalHour, patientEmail))
      throw new Error("El paciente ya tiene una cita en este horario");

    if (await this.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date))
      throw new Error("El profesional ya tiene una cita en este horario");

    if (await this.checkAppointmentDurationFormat(initialHour, schedule.initialHour, schedule.duration))
      throw new Error("La hora inicial no es válida!");

    const room = schedule.room;

    if (!room.active) throw new Error("La sala asignada al horario no está activa");

    // Creating appointment
    const appointment = em.create(Appointment, {
      date,
      initialHour,
      finalHour,
      type,
      professional,
      room,
      value: 0,
      cancelDate: "Pending",
    });

    appointment.diagnostics.add(
      em.create(Diagnostic, {
        patient: await this.peopleService.findPersonByEmail(patientEmail),
        appointment,
        state: "Pending",
        observations: null,
      })
    );

    await em.flush();
    return appointment;
  }
}
