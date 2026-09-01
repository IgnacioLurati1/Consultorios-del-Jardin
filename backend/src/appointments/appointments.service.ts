import type { FilterQuery } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { Appointment } from "./appointments.entity.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { OfficeService } from "../offices/offices.service.js";
import { EntityManager } from "@mikro-orm/mysql";
import { RoomService } from "../rooms/rooms.service.js";
import { AppointmentEngine } from "./appointments.engine.js";
import MailService from "../config/sendGrid.js";
import {groqClient, GROQ_CONFIG} from "../config/groq.js";
import {buildSecretaryPrompt} from "../prompts/secretary.js";
import {SECRETARY_TOOLS} from "./secretary.tools.js";
import Groq from "groq-sdk";
import { badRequest, conflict, notFound } from "../shared/errors.js";

const em = orm.em;

// Estados "vivos" de un turno. Cancelar escribe un ISO timestamp en `state`
// (para que el unique index deje volver a sacar turno en la misma franja),
// así que un estado que no esté en esta lista es un turno cancelado.
export const ACTIVE_APPOINTMENT_STATES = ["pending", "accepted", "assisted", "missed"];

type SimpleMessage = { role: "user" | "assistant"; content: string };
interface SecretaryResponse {
  content: string;
  chatHistory: SimpleMessage[];
}

// Vista "diagnóstico" de un turno. El diagnóstico dejó de ser una entidad propia:
// ahora es la parte clínica del turno (paciente + estado + observaciones).
interface DiagnosticView {
  appointment: number | undefined;
  patient: string;
  state: string;
  observations: string | null;
}

export class AppointmentService {
  private peopleService: PeopleService;
  private scheduleService: ScheduleService;
  private officeService: OfficeService;
  private roomService: RoomService;
  private mailService: MailService;

  constructor() {
    this.peopleService = new PeopleService();
    this.scheduleService = new ScheduleService();
    this.officeService = new OfficeService();
    this.roomService = new RoomService();
    this.mailService = new MailService();
  }

  private toDiagnosticView(appointment: Appointment): DiagnosticView {
    return {
      appointment: appointment.numAppointment,
      patient: appointment.patient ? appointment.patient.email : "",
      state: appointment.state,
      observations: appointment.observations ?? null,
    };
  }

  async findPatientAppointmentsByEmail(patientEmail: string, page = 0, includeCancelled = false): Promise<Appointment[]> {
    const limit = 15;
    const offset = page * limit;
    return await em.find(
      Appointment,
      { patient: { email: patientEmail }, ...(includeCancelled ? {} : { state: { $in: ACTIVE_APPOINTMENT_STATES } }) },
      {
        populate: ["room.office", "professional", "patient"],
        limit,
        offset,
        orderBy: { date: "DESC", initialHour: "DESC" },
      }
    );
  }

  async getPersonalMedicalHistory(patientEmail: string) {
    return await em.find(
      Appointment,
      { patient: { email: patientEmail } },
      { populate: ["professional", "room.office"], orderBy: { date: "DESC", initialHour: "DESC" } }
    );
  }

  async getPatientMedicalHistory(professionalEmail: string, patientEmail: string) {
    return await em.find(
      Appointment,
      {
        patient: { email: patientEmail },
        professional: { email: professionalEmail },
      },
      { populate: ["professional", "room.office"], orderBy: { date: "DESC", initialHour: "DESC" } }
    );
  }

  async getDiagnostic(patientEmail: string, num: number): Promise<DiagnosticView> {
    const appointment = await em.findOneOrFail(
      Appointment,
      { numAppointment: num, patient: { email: patientEmail } },
      { populate: ["patient"] }
    );
    return this.toDiagnosticView(appointment);
  }

  async findUniqueProfessionalAppointment(professionalEmail: string, numAppointment: number) {
    return await em.findOneOrFail(
      Appointment,
      { professional: { email: professionalEmail }, numAppointment: numAppointment },
      { populate: ["patient"] }
    );
  }

  async findProfessionalAppointmentsByEmail(professionalEmail: string, page = 0, includeCancelled = false): Promise<Appointment[]> {
    const limit = 15;
    const offset = page * limit;
    return await em.find(
      Appointment,
      { professional: { email: professionalEmail }, ...(includeCancelled ? {} : { state: { $in: ACTIVE_APPOINTMENT_STATES } }) },
      { populate: ["room.office", "patient", "recurrence"], limit, offset, orderBy: { date: "DESC", initialHour: "DESC" } }
    );
  }

  // Turnos de un profesional entre dos fechas. Lo usa la vista de grilla semanal,
  // donde paginar de a 15 no sirve: hace falta la semana completa.
  async findProfessionalAppointmentsInRange(
    professionalEmail: string,
    from: Date,
    to: Date,
    includeCancelled = false
  ): Promise<Appointment[]> {
    return await em.find(
      Appointment,
      {
        professional: { email: professionalEmail },
        date: { $gte: from, $lte: to },
        ...(includeCancelled ? {} : { state: { $in: ACTIVE_APPOINTMENT_STATES } }),
      },
      { populate: ["room.office", "patient", "recurrence"], orderBy: { date: "ASC", initialHour: "ASC" } }
    );
  }

  // Vista de solo lectura para el admin: horarios, estado y paciente, SIN las observaciones
  // clínicas. El recorte se hace acá y no en el front para que el dato no viaje.
  async findProfessionalAppointmentsForAdmin(
    professionalEmail: string,
    page = 0,
    includePast = false,
    kind: "all" | "normal" | "overbooked" = "all"
  ) {
    const limit = 15;
    const offset = page * limit;

    // Por defecto el admin ve lo que viene, del turno mas cercano en adelante: lo
    // pasado ya no se controla. Si pide ver los pasados se muestra todo, y ahi
    // conviene el orden inverso para que arriba quede lo mas reciente.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: FilterQuery<Appointment> = {
      professional: { email: professionalEmail },
      ...(includePast ? {} : { date: { $gte: today } }),
      ...(kind === "all" ? {} : { overbooked: kind === "overbooked" }),
    };

    const appointments = await em.find(Appointment, where, {
      populate: ["room.office", "patient"],
      limit,
      offset,
      orderBy: includePast
        ? { date: "DESC" as const, initialHour: "DESC" as const }
        : { date: "ASC" as const, initialHour: "ASC" as const },
    });

    return appointments.map((a) => ({
      numAppointment: a.numAppointment,
      date: a.date,
      initialHour: a.initialHour,
      finalHour: a.finalHour,
      state: a.state,
      overbooked: a.overbooked,
      patient: a.patient ? { email: a.patient.email, name: a.patient.name, surname: a.patient.surname } : null,
      room: { idRoom: a.room.idRoom, description: a.room.description },
    }));
  }

  async findPendingProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(
      Appointment,
      { professional: { email: professionalEmail }, state: "pending" },
      { populate: ["room.office", "patient"] }
    );
  }

  async deleteAppointment(num: number, professionalEmail: string) {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        state: "pending",
        professional: { email: professionalEmail },
      },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe, ya no está pendiente o no es tuyo");

    await this.sendAppointmentRejectedEmails(appointment);
    em.remove(appointment);
    await em.flush();
    return appointment; // Not used for now
  }

  async updateAppointment(num: number, professionalEmail: string, data: Partial<Appointment>) {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        // Se puede editar cualquier turno vivo, no solo los aceptados: por ejemplo
        // ponerle el valor a uno pendiente, o a uno ya asistido.
        state: { $in: ACTIVE_APPOINTMENT_STATES },
        professional: { email: professionalEmail },
      },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe, ya fue cancelado o no es tuyo");

    // Solo se toca lo que efectivamente vino. Si se le pasa una clave con undefined,
    // em.assign explota ("You must pass a non-undefined value...").
    const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<Appointment>;

    if (Object.keys(changes).length === 0) throw badRequest("No hay cambios para aplicar");

    if (changes.value !== undefined && changes.value < 0) throw badRequest("El valor del turno no puede ser negativo");

    // Solo se revalidan horarios (y se avisa por mail) si realmente cambió la franja.
    // Cambiarle el valor a un turno no tiene por qué mandarle un mail al paciente.
    const sameHour = (a?: string, b?: string) => (a ?? "").slice(0, 5) === (b ?? "").slice(0, 5);
    const sameDay = (a?: Date, b?: Date) => new Date(a as Date).toDateString() === new Date(b as Date).toDateString();

    const scheduleChanged =
      (changes.initialHour !== undefined && !sameHour(changes.initialHour, appointment.initialHour)) ||
      (changes.finalHour !== undefined && !sameHour(changes.finalHour, appointment.finalHour)) ||
      (changes.date !== undefined && !sameDay(changes.date, appointment.date));

    if (scheduleChanged) {
      const initialHour = (changes.initialHour ?? appointment.initialHour).slice(0, 5);
      const finalHour = (changes.finalHour ?? appointment.finalHour).slice(0, 5);
      const date = changes.date ?? appointment.date;

      if (!this.scheduleService.isValidHourFormat(initialHour) || !this.scheduleService.isValidHourFormat(finalHour))
        throw badRequest("El horario tiene que estar en formato HH:MM");

      if (initialHour >= finalHour) throw badRequest("La hora de inicio tiene que ser anterior a la de fin");

      if (appointment.patient) {
        if (await this.checkPatientAppointmentOverlap(initialHour, finalHour, appointment.patient.email, date, undefined, num))
          throw conflict("El paciente ya tiene otro turno que se superpone con ese horario");
      }

      if (await this.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, undefined, num))
        throw conflict("Ya tenés otro turno que se superpone con ese horario");
    }

    em.assign(appointment, changes);
    await em.flush();

    if (scheduleChanged) await this.sendAppointmentUpdatedEmails(appointment);

    return appointment;
  }

  isValidDate(date: Date): boolean {
    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);
    return !isNaN(inputDate.getTime()) && inputDate >= today;
  }

  // Separa los dos motivos por los que una fecha puede no servir, para poder decirle al
  // usuario cual de los dos le paso. Un turno de hoy mas tarde sigue siendo valido.
  private assertBookableDate(date: Date) {
    if (Number.isNaN(new Date(date).getTime())) throw badRequest("La fecha del turno no es válida");
    if (!this.isValidDate(date)) throw badRequest("No se puede sacar un turno en una fecha que ya pasó");
  }

  // Chequeos de horario compartidos por el alta de paciente y la del profesional.
  private assertValidHour(hour: string, label: string) {
    if (!this.scheduleService.isValidHourFormat(hour)) throw badRequest(`${label} tiene que estar en formato HH:MM`);
  }

  // Un turno tiene como mucho un paciente, así que devuelve 0 o 1 elemento.
  async getAppointmentDiagnostics(num: number, professionalEmail: string): Promise<DiagnosticView[]> {
    const appointment = await em.findOne(
      Appointment,
      { numAppointment: num, professional: { email: professionalEmail } },
      { populate: ["patient"] }
    );

    if (!appointment || !appointment.patient) return [];
    return [this.toDiagnosticView(appointment)];
  }

  async checkPatientAppointmentOverlap(
    initialHour: string,
    finalHour: string,
    patientEmail: string,
    date: Date,
    emT?: EntityManager,
    excludeNumAppointment?: number
  ): Promise<Appointment | null> {
    const appointment = await (emT || em).findOne(Appointment, {
      date,
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ACTIVE_APPOINTMENT_STATES },
      patient: { email: patientEmail },
      // Al editar un turno, no tiene que chocar consigo mismo
      ...(excludeNumAppointment ? { numAppointment: { $ne: excludeNumAppointment } } : {}),
    });
    return appointment;
  }

  async checkProfessionalAppointmentOverlap(
    initialHour: string,
    finalHour: string,
    professionalEmail: string,
    date: Date,
    emT?: EntityManager,
    excludeNumAppointment?: number
  ): Promise<Appointment | null> {
    const appointment = await (emT || em).findOne(Appointment, {
      date,
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ACTIVE_APPOINTMENT_STATES },
      professional: { email: professionalEmail },
      // Al editar un turno, no tiene que chocar consigo mismo
      ...(excludeNumAppointment ? { numAppointment: { $ne: excludeNumAppointment } } : {}),
    });
    return appointment;
  }

  // Estados que el profesional puede setear a mano. La cancelación tiene su propio endpoint.
  // "missed" es el "No vino": el turno pasó y el paciente no se presentó.
  async checkAppointmentStateFormat(state: string): Promise<boolean> {
    return ACTIVE_APPOINTMENT_STATES.includes(state);
  }

  async updateDiagnostic(num: number, patientEmail: string, professionalEmail: string, data: Partial<Appointment>) {
    const appointment = await em.findOne(
      Appointment,
      { numAppointment: num, professional: { email: professionalEmail } },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");
    if (patientEmail && appointment.patient?.email !== patientEmail) throw badRequest("El paciente no corresponde a este turno");

    if (data.state !== undefined) {
      if (!(await this.checkAppointmentStateFormat(data.state)))
        throw badRequest("Ese estado no es válido. Para cancelar el turno usá el botón de cancelar");
      appointment.state = data.state;
    }
    if (data.observations !== undefined) {
      appointment.observations = data.observations;
    }
    await em.flush();
    return this.toDiagnosticView(appointment);
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
    const appointment = await em.findOne(
      Appointment,
      { numAppointment: num, professional: { email: professionalEmail } },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");
    if (patientEmail && appointment.patient?.email !== patientEmail) throw badRequest("El paciente no corresponde a este turno");

    appointment.observations = observations;
    await em.flush();
    return this.toDiagnosticView(appointment);
  }

  async acceptAppointment(num: number, professionalEmail: string) {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        state: "pending",
        professional: { email: professionalEmail },
      },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no está pendiente de confirmación o no es tuyo");

    appointment.state = "accepted";
    await em.flush();
    await this.sendAppointmentAcceptedEmails(appointment);
    return appointment; // Not used for now
  }

  async cancelAppointment(num: number, email: string, type: "professional" | "client") {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        $or: [{ professional: { email } }, { patient: { email } }],
      },
      { populate: ["patient", "professional"] }
    );

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");

    if (appointment.state === "assisted") throw badRequest("No se puede cancelar un turno que ya figura como asistido");
    if (appointment.state === "missed") throw badRequest("No se puede cancelar un turno marcado como 'No vino'");

    if (appointment.state === "pending") {
      await this.deleteAppointment(num, appointment.professional.email);
      return appointment;
    }

    if (appointment.state !== "accepted") throw badRequest("Ese turno ya estaba cancelado");

    appointment.state = new Date().toISOString();
    await em.flush();

    await this.sendAppointmentCanceledEmails(appointment);
    if (type === "client") await this.sendAppointmentCanceledToProfessional(appointment, appointment.professional.email);

    return appointment; // Not used for now
  }

  async createPatientAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Partial<Appointment>> {
    const refreshed = await em.transactional(async (em) => {
      this.assertValidHour(initialHour, "La hora de inicio");
      this.assertBookableDate(date);

      const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
      const appointment: Appointment = await engine.validateAndCreateAppointment(
        patientEmail,
        date,
        initialHour,
        professionalEmail,
        officeId
      );

      await em.flush();
      return await em.findOneOrFail(
        Appointment,
        { numAppointment: appointment.numAppointment },
        { populate: ["patient", "professional"] }
      );
    });

    await this.sendAppointmentCreatedEmail(patientEmail, refreshed, initialHour).catch((err) =>
      console.error("Error enviando email de creación de turno:", err)
    );
    const result = {
      numAppointment: refreshed.numAppointment,
      date: refreshed.date,
      initialHour: refreshed.initialHour,
      finalHour: refreshed.finalHour,
      value: refreshed.value,
      professionalEmail: refreshed.professional.email,
      room: refreshed.room,
    };
    return result as Partial<Appointment>;
  }

  async createProfessionalAppointment(
    date: Date,
    initialHour: string,
    finalHour: string,
    idRoom: number,
    value: number,
    professionalEmail: string,
    patientEmail?: string,
    overbooked = false
  ): Promise<Partial<Appointment>> {
    return await em.transactional(async (em) => {
      this.assertValidHour(initialHour, "La hora de inicio");
      this.assertValidHour(finalHour, "La hora de fin");
      this.assertBookableDate(date);

      if (initialHour >= finalHour) throw badRequest("La hora de inicio tiene que ser anterior a la de fin");
      if (!(value >= 0)) throw badRequest("El valor del turno tiene que ser un número mayor o igual a cero");
      if (!idRoom) throw badRequest("Tenés que elegir una sala para el turno");
      const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
      const appointment = await engine.validateAndCreateProfessionalAppointment(
        date,
        initialHour,
        finalHour,
        idRoom,
        value,
        professionalEmail,
        patientEmail,
        overbooked
      );

      await em.flush();
      return {
        numAppointment: appointment.numAppointment,
        date: appointment.date,
        initialHour: appointment.initialHour,
        finalHour: appointment.finalHour,
        value: appointment.value,
        overbooked: appointment.overbooked,
        professionalEmail: appointment.professional.email,
        room: appointment.room,
      } as Partial<Appointment>;
    });
  }

  async addPatientToAppointment(numAppointment: number, patientEmail: string, professionalEmail: string) {
    const appointment = await this.findUniqueProfessionalAppointment(professionalEmail, numAppointment);

    if (appointment.patient) throw conflict("Ese turno ya tiene un paciente asignado");

    if (await this.checkPatientAppointmentOverlap(appointment.initialHour, appointment.finalHour, patientEmail, appointment.date))
      throw conflict("El paciente ya tiene otro turno que se superpone con ese horario");

    appointment.patient = await this.peopleService.findPersonByEmail(patientEmail);

    await em.flush();
    await this.sendPatientAddedEmail(patientEmail, numAppointment);
    return this.toDiagnosticView(appointment); // Not used for now
  }

  async getAvailableAppointmensForPatient(idOffice: number, professionalEmail: string, patientEmail: string) {
    const engine = new AppointmentEngine(this.peopleService, this.scheduleService, this.officeService, this.roomService, this, em);
    const appointments = engine.getAvailableAppointmentsForPatient(patientEmail, professionalEmail, idOffice);
    return appointments;
  }

  private async sendAppointmentCreatedEmail(patientEmail: string, appointment: Appointment, initialHour: string) {
    const htmlContent = `
      <p>Hola,</p>
      <p>Tu solicitud de turno ha sido registrada correctamente.</p>
      <p><strong>Detalles del turno:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora inicial:</strong> ${initialHour}</li>
      </ul>
      <p>Tu turno está pendiente de que el profesional lo acepte. Te notificaremos cuando sea confirmado.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(patientEmail, "Solicitud de Turno Registrada", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentUpdatedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = `
      <p>Hola,</p>
      <p>Te notificamos que tu turno ha sido modificado.</p>
      <p><strong>Nuevos detalles del turno:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora inicial:</strong> ${appointment.initialHour}</li>
        <li><strong>Hora final:</strong> ${appointment.finalHour}</li>
      </ul>
      <p>Por favor, revisa tu calendario y confirma la disponibilidad.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(appointment.patient.email, "Tu Turno Ha Sido Modificado", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentRejectedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = `
      <p>Hola,</p>
      <p>Te informamos que tu solicitud de turno ha sido rechazada.</p>
      <p><strong>Detalles del turno rechazado:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora inicial:</strong> ${appointment.initialHour}</li>
      </ul>
      <p>Si tienes alguna pregunta, por favor contáctanos.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(appointment.patient.email, "Solicitud de Turno Rechazada", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentCanceledEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = `
      <p>Hola,</p>
      <p>Te notificamos que se ha cancelado el turno.</p>
      <p><strong>Detalles del turno:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora inicial:</strong> ${appointment.initialHour}</li>
      </ul>
      <p>Sugerimos la posibilidad de realizar un nuevo turno.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(appointment.patient.email, "Turno cancelado", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentCanceledToProfessional(appointment: Appointment, email: string) {
    const htmlContent = `
        <p>Hola,</p>
        <p>Te notificamos que un paciente ha cancelado su turno.</p>
        <p><strong>Detalles del turno:</strong></p>
        <ul>
          <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
          <li><strong>Hora inicial:</strong> ${appointment.initialHour}</li>
        </ul>
        <p>Para más información acceder vía web.</p>
        <p>¡Gracias!</p>
      `;
    const message = await this.mailService.createMessage(email, "Cancelación de paciente", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentAcceptedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = `
      <p>Hola,</p>
      <p>Te informamos que tu turno ha sido aceptado por el profesional.</p>
      <p><strong>Detalles del turno:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora inicial:</strong> ${appointment.initialHour}</li>
      </ul>
      <p>Por favor, revisa tu calendario. Si tienes alguna duda, contáctanos.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(appointment.patient.email, "Tu Turno Ha Sido Aceptado", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendPatientAddedEmail(patientEmail: string, numAppointment: number) {
    const htmlContent = `
      <p>Hola,</p>
      <p>Has sido añadido a un turno en nuestros consultorios.</p>
      <p><strong>Detalles del turno:</strong></p>
      <ul>
        <li><strong>Número de turno:</strong> ${numAppointment}</li>
        <li><strong>Estado:</strong> Pendiente de tu aceptación</li>
      </ul>
      <p>Por favor, verifica que esta asignación sea correcta. Si se trata de un error, contáctanos inmediatamente.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(patientEmail, "Has Sido Añadido a un Turno", htmlContent);
    await this.mailService.sendMail(message);
  }

  private formatDateArgentina(date: Date): string {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const noonUtc = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(noonUtc);
  }

  async getAppointmentsForReminder(): Promise<Appointment[]> {
    const now = new Date();
    const argentinaTz = this.formatDateArgentina(now);
    const [day, month, year] = argentinaTz.split("/");
    const today = new Date(`${year}-${month}-${day}T00:00:00-03:00`);

    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow2359 = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000 - 1000);

    return await em.find(
      Appointment,
      {
        date: { $gte: tomorrow, $lte: tomorrow2359 },
        state: "accepted",
        reminderSent: "not sent",
        patient: { $ne: null },
      },
      { populate: ["patient", "professional"] }
    );
  }

  private async sendReminderEmail(patientEmail: string, appointment: Appointment) {
    const htmlContent = `
      <p>Hola,</p>
      <p>Te recordamos que tienes un turno programado mañana.</p>
      <p><strong>Detalles del turno:</strong></p>
      <ul>
        <li><strong>Fecha:</strong> ${this.formatDateArgentina(appointment.date as Date)}</li>
        <li><strong>Hora:</strong> ${appointment.initialHour}</li>
        <li><strong>Profesional:</strong> ${appointment.professional.name} ${appointment.professional.surname}</li>
      </ul>
      <p>Por favor, asegúrate de llegar 5 minutos antes de tu turno.</p>
      <p>¡Gracias!</p>
    `;
    const message = await this.mailService.createMessage(patientEmail, "Recordatorio de Tu Turno", htmlContent);
    await this.mailService.sendMail(message);
  }

  async sendReminderEmails(appointment: Appointment): Promise<void> {
    if (!appointment.patient) return;
    await this.sendReminderEmail(appointment.patient.email, appointment);
  }

  async updateReminderStatus(numAppointment: number): Promise<void> {
    const appointment = await em.findOneOrFail(Appointment, { numAppointment });
    appointment.reminderSent = "sent";
    await em.flush();
  }

  async generateSecretaryResponse(patientEmail: string, userMessage: string, history: SimpleMessage[]): Promise<SecretaryResponse> {
    const [patient, appointments] = await Promise.all([
      this.peopleService.findPersonByEmail(patientEmail),
      this.findPatientAppointmentsByEmail(patientEmail, 0),
    ]);

    const systemPrompt = buildSecretaryPrompt(patient.name, appointments);

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ];

    const MAX_ITERATIONS = 5;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let response: Groq.Chat.ChatCompletion;
      try {
        response = await groqClient.chat.completions.create({
          ...GROQ_CONFIG,
          messages,
          tools: SECRETARY_TOOLS,
          tool_choice: "auto",
        });
      } catch (err: any) {
        console.error("[Secretary] Groq API error:", err?.message, err?.status, JSON.stringify(err?.error));
        throw err;
      }

      const choice = response.choices[0];
      messages.push(choice.message as any);

      if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls) {
        const content = choice.message.content || "Lo siento, no pude generar una respuesta en este momento.";
        const chatHistory = messages
          .filter((m): m is { role: "user" | "assistant"; content: string } =>
            (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0
          )
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        return { content, chatHistory };
      }

      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let result: any;
        try {
          result = await this.executeTool(toolCall.function.name, args, patientEmail);
        } catch (err: any) {
          result = { error: err.message };
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        } as any);
      }
    }

    return { content: "Lo siento, no pude completar la solicitud. Por favor intentá de nuevo.", chatHistory: [] };
  }

  private async executeTool(name: string, args: any, patientEmail: string): Promise<any> {
    switch (name) {
      case "get_active_offices":
        return await this.officeService.findAllActiveOffices();

      case "get_professionals":
        return await this.peopleService.findProfessionalsWithOffices(args.officeId);

      case "get_available_appointments":
        return await this.getAvailableAppointmensForPatient(args.officeId, args.professionalEmail, patientEmail);

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  }
}
