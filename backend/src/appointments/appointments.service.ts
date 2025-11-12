import { orm } from "../shared/db/orm.js";
import { Appointment } from "./appointments.entity.js";
import { Diagnostic } from "./diagnostics.entity.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { OfficeService } from "../offices/offices.service.js";
import { EntityManager } from "@mikro-orm/mysql";
import { RoomService } from "../rooms/rooms.services.js";
import { AppointmentEngine } from "./appointments.engine.js";

const em = orm.em;

export class AppointmentService {
  private peopleService: PeopleService;
  private scheduleService: ScheduleService;
  private officeService: OfficeService;
  private roomService: RoomService;

  constructor() {
    this.peopleService = new PeopleService();
    this.scheduleService = new ScheduleService();
    this.officeService = new OfficeService();
    this.roomService = new RoomService();
  }

  async findPatientAppointmentsByEmail(patientEmail: string): Promise<Appointment[]> {
    return await em.find(Appointment, { diagnostics: { patient: { email: patientEmail } } }, { populate: ["room.office", "diagnostics"] });
  }

  async getPersonalMedicalHistory(patientEmail: string) {
    return await em.find(Diagnostic, { patient: { email: patientEmail } });
  }

  async getPatientMedicalHistory(professionalEmail: string, patientEmail: string) {
    return await em.find(Diagnostic, { patient: { email: patientEmail }, appointment: { professional: { email: professionalEmail } } });
  }

  async getDiagnostic(patientEmail: string, num: number) {
    return await em.findOneOrFail(Diagnostic, { patient: { email: patientEmail }, appointment: { numAppointment: num } });
  }

  async findUniqueProfessionalAppointment(professionalEmail: string, numAppointment: number) {
    return await em.findOneOrFail(
      Appointment,
      { professional: { email: professionalEmail }, numAppointment: numAppointment },
      { populate: ["room.office", "diagnostics"] }
    );
  }

  async findProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(Appointment, { professional: { email: professionalEmail } }, { populate: ["room.office", "diagnostics"] });
  }

  async findPendingProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(
      Appointment,
      { professional: { email: professionalEmail }, state: "pending" },
      { populate: ["room.office", "diagnostics"] }
    );
  }

  checkHoursOverlapAndFormat(initialHour: string, finalHour: string): boolean {
    if (!this.scheduleService.isValidHourFormat(initialHour) || !this.scheduleService.isValidHourFormat(finalHour)) return false;
    return initialHour < finalHour;
  }

  async deleteAppointment(num: number, professionalEmail: string) {
    const appointment = await em.findOneOrFail(Appointment, {
      numAppointment: num,
      state: "pending",
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
        state: "accepted",
        professional: { email: professionalEmail },
      },
      { populate: ["diagnostics", "diagnostics.patient"] } // HABRIA QUE FILTRAR QUE DEVUELVE
    );

    if (!data.initialHour || !data.finalHour) throw new Error("Debe proporcionar initialHour y finalHour");
    // Lo puse aca porque sino typescript me tiraba flor de error

    if (!this.checkHoursOverlapAndFormat(data.initialHour, data.finalHour))
      throw new Error("El formato de las horas es inválido o la hora inicial es mayor o igual a la final");

    for (const diagnostic of appointment.diagnostics.getItems()) {
      if (
        await this.checkPatientAppointmentOverlap(data.initialHour, data.finalHour, diagnostic.patient.email, data.date || appointment.date)
      )
        throw new Error("Un paciente ya tiene una cita en este horario"); // We don't specify which one for security reasons
    }

    if (await this.checkProfessionalAppointmentOverlap(data.initialHour, data.finalHour, professionalEmail, data.date || appointment.date))
      throw new Error("Usted ya tiene un turno en este horario!");

    if (data.value !== undefined && data.value < 0) throw new Error("El valor del turno no puede ser negativo");

    em.assign(appointment, data);
    await em.flush();
    return appointment;
  }

  isValidDate(date: Date): boolean {
    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);
    return !isNaN(inputDate.getTime()) && inputDate >= today;
  }

  async getAppointmentDiagnostics(num: number, professionalEmail: string): Promise<Diagnostic[]> {
    return await em.find(Diagnostic, { appointment: { numAppointment: num, professional: { email: professionalEmail } } });
  }

  async checkPatientAppointmentOverlap(
    initialHour: string,
    finalHour: string,
    patientEmail: string,
    date: Date,
    emT?: EntityManager
  ): Promise<Appointment | null> {
    const appointment = await (em || emT).findOne(Appointment, {
      date,
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ["pending", "accepted"] },
      diagnostics: { patient: { email: patientEmail } },
    });
    return appointment;
  }

  async checkProfessionalAppointmentOverlap(
    initialHour: string,
    finalHour: string,
    professionalEmail: string,
    date: Date,
    emT?: EntityManager
  ): Promise<Appointment | null> {
    const appointment = await (em || emT).findOne(Appointment, {
      date,
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ["pending", "accepted"] },
      professional: { email: professionalEmail },
    });
    return appointment;
  }

  async checkDiagnosticStateFormat(state: string): Promise<boolean> {
    const validStates = ["pending", "assisted", "canceled"];
    return validStates.includes(state);
  }

  async updateDiagnostic(num: number, patientEmail: string, professionalEmail: string, data: Partial<Diagnostic>) {
    const diagnostic = await em.findOneOrFail(Diagnostic, {
      appointment: { numAppointment: num, professional: { email: professionalEmail } },
      patient: { email: patientEmail },
    });
    if (data.state !== undefined) {
      if (!(await this.checkDiagnosticStateFormat(data.state))) throw new Error("Estado del diagnóstico inválido");
      diagnostic.state = data.state;
    }
    if (data.observations !== undefined) {
      diagnostic.observations = data.observations;
    }
    await em.flush();
    return diagnostic;
  }

  async checkAppointmentDurationFormat(initialHour: string, scheduleInitialHour: string, duration: number): Promise<boolean> {
    let [hours, minutes] = initialHour.split(":").map(Number);
    const initialMinutes = hours * 60 + minutes;

    [hours, minutes] = scheduleInitialHour.split(":").map(Number);
    const scheduleInitialMinutes = hours * 60 + minutes;

    const k = (initialMinutes - scheduleInitialMinutes) / duration;

    return !(k >= 0 && Number.isInteger(k));
  }

  async addObservation(num: number, professionalEmail: string, observations: string, patientEmail: string) {
    const diagnostic = await em.findOneOrFail(Diagnostic, {
      appointment: { numAppointment: num, professional: { email: professionalEmail } },
      patient: { email: patientEmail },
    });

    diagnostic.observations = observations;
    await em.flush();
    return diagnostic;
  }

  async acceptAppointment(num: number, professionalEmail: string) {
    const appointment = await em.findOneOrFail(Appointment, {
      numAppointment: num,
      state: "pending",
      professional: { email: professionalEmail },
    });

    appointment.state = "accepted";
    await em.flush();
    return appointment;
  }

  async cancelAppointment(num: number, email: string, type: "professional" | "client") {
    const appointment = await em.findOneOrFail(Appointment, {
      numAppointment: num,
      $or: [{ professional: { email } }, { diagnostics: { patient: { email } } }],
    });

    if (appointment.type === "taller" && type === "professional") {
      appointment.state = new Date().toISOString();
    } else if (appointment.type === "taller" && type === "client") {
      let diagnostic = await this.getDiagnostic(email, num);

      if (diagnostic.state === "assisted") throw new Error("No puede cancelar un turno asistido");
      diagnostic.state = "canceled";

      await em.flush();
      return appointment;
    } else if (appointment.type === "simple" && appointment.state === "accepted") {
      appointment.state = new Date().toISOString();
    } else if (appointment.type === "simple" && appointment.state === "pending") {
      await this.deleteAppointment(num, appointment.professional.email);
    } else {
      throw new Error("El turno ya fue cancelado");
    }

    await em.flush();
    return appointment;
  }

  async createPatientAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    type: "simple" | "taller",
    professionalEmail: string,
    officeId: number
  ): Promise<Partial<Appointment>> {
    return await em.transactional(async (em) => {
      const isValid =
        this.scheduleService.isValidHourFormat(initialHour) && this.isValidDate(date) && this.scheduleService.isValidAllowedTypes(type);

      if (!isValid) throw new Error("Información de turno inválida");

      const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
      const appointment = engine.validateAndCreateAppointment(patientEmail, date, initialHour, type, professionalEmail, officeId);

      await em.flush();
      return appointment;
    });
  }

  async createProfessionalAppointment(
    date: Date,
    initialHour: string,
    finalHour: string,
    type: "simple" | "taller",
    idRoom: number,
    value: number,
    professionalEmail: string,
    patientEmail?: string
  ) {
    return await em.transactional(async (em) => {
      const isValid =
        this.scheduleService.isValidHourFormat(initialHour) &&
        this.isValidDate(date) &&
        this.scheduleService.isValidAllowedTypes(type) &&
        initialHour < finalHour &&
        value >= 0;

      if (!isValid) throw new Error("Información de turno inválida");
      const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
      const appointment = engine.validateAndCreateProfessionalAppointment(
        date,
        initialHour,
        finalHour,
        idRoom,
        value,
        type,
        professionalEmail,
        patientEmail
      );

      await em.flush();
      return appointment;
    });
  }

  async addPatientToAppointment(numAppointment: number, patientEmail: string, professionalEmail: string) {
    const diagnostics = await this.getAppointmentDiagnostics(numAppointment, professionalEmail);
    const appointment = await this.findUniqueProfessionalAppointment(professionalEmail, numAppointment);

    if (await this.checkPatientAppointmentOverlap(appointment.initialHour, appointment.finalHour, patientEmail, appointment.date))
      throw new Error("El paciente ya tiene una cita en este horario");

    if (!(appointment.type == "simple" && diagnostics.length == 0)) {
      throw new Error("El turno ya tiene un paciente!");
    }
    let diagnostic;
    appointment.diagnostics.add(
      (diagnostic = em.create(Diagnostic, {
        patient: await this.peopleService.findPersonByEmail(patientEmail, em),
        appointment,
        state: "pending",
        observations: null,
      }))
    );

    await em.flush();
    return diagnostic;
  }

  async getAvailableAppointmensForPatient(idOffice: number, professionalEmail: string, patientEmail: string) {
    const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
    const appointments = engine.getAvailableAppointmentsForPatient(patientEmail, professionalEmail, idOffice);
    return appointments;
  }
}
