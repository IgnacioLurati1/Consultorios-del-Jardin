import { wrap, type FilterQuery } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { Appointment } from "./appointments.entity.js";
import { wantsMail } from "../people/mailPreferences.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { OfficeService } from "../offices/offices.service.js";
import { EntityManager } from "@mikro-orm/mysql";
import { RoomService } from "../rooms/rooms.service.js";
import { AppointmentEngine } from "./appointments.engine.js";
import MailService from "../config/mailer.js";
import { button, factsCard, note, paragraph, title, warning } from "../config/mailTemplate.js";
import { badRequest, conflict, forbidden, notFound } from "../shared/errors.js";
import { Denial } from "./denials.entity.js";
import { Person } from "../people/people.entity.js";
import { addDays, monthKey, parseISODate, startOfDay } from "../shared/dates.js";
import { SecurityService } from "../security/security.service.js";

const em = orm.em;

// Estados "vivos" de un turno. Cancelar escribe un ISO timestamp en `state`
// (para que el unique index deje volver a sacar turno en la misma franja),
// así que un estado que no esté en esta lista es un turno cancelado.
export const ACTIVE_APPOINTMENT_STATES = ["pending", "accepted", "assisted", "missed"];

/** Los tres estados de cobro que puede tener un turno. */
export const PAYMENT_STATES = ["unpaid", "partial", "paid"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * Cuándo un turno cuenta como deuda.
 *
 * Tienen que darse las dos cosas. Que ya se haya dado —"assisted"—, porque un turno de la
 * semana que viene no se debe todavía, y a uno al que el paciente faltó no se le cobra
 * salvo que el consultorio decida lo contrario y lo marque a mano. Y que no esté saldado:
 * sin cobrar, o cobrado a medias.
 *
 * Los turnos anteriores a esta columna tienen `paymentState` en null y quedan afuera por
 * definición: de esos no se sabe si se cobraron, y suponerlo sería inventar.
 */
export const DEBT_FILTER = {
  state: "assisted",
  paymentState: { $in: ["unpaid", "partial"] },
} as const;

/** Lo que falta cobrar de un turno. Un pago parcial descuenta lo que ya entró. */
export function pendingAmount(appointment: Appointment): number {
  const value = appointment.value ?? 0;
  if (appointment.paymentState === "partial") return Math.max(0, value - (appointment.paidAmount ?? 0));
  if (appointment.paymentState === "unpaid") return value;
  return 0;
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
  private securityService: SecurityService;

  constructor() {
    this.peopleService = new PeopleService();
    this.scheduleService = new ScheduleService();
    this.officeService = new OfficeService();
    this.roomService = new RoomService();
    this.mailService = new MailService();
    this.securityService = new SecurityService();
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

  /**
   * Los pacientes del profesional: los que alguna vez tuvieron turno con él.
   *
   * No cuenta el turno cancelado como vínculo: si lo único que hubo entre los dos fue un
   * turno que se dio de baja, esa persona no es su paciente. Un turno pendiente sí
   * cuenta, porque ya está en la agenda.
   *
   * El estado guarda un ISO timestamp cuando se cancela, así que "no cancelado" es
   * pertenecer a la lista de estados con nombre.
   */
  async findMyPatients(professionalEmail: string) {
    const appointments = await em.find(
      Appointment,
      {
        professional: { email: professionalEmail },
        patient: { $ne: null },
        state: { $in: ["pending", "accepted", "assisted", "missed"] },
      },
      { populate: ["patient"], fields: ["patient"] }
    );

    // Una persona aparece una vez por turno: acá se queda una sola.
    const unique = new Map<string, (typeof appointments)[number]["patient"]>();
    for (const appointment of appointments) {
      if (appointment.patient) unique.set(appointment.patient.email, appointment.patient);
    }

    // Quién quedó debiendo algo, para que la lista lo diga sin tener que entrar a la
    // ficha de cada uno. Va como campo aparte y no como una columna de la persona: la
    // deuda es con este profesional, no del paciente en general.
    const debt = await this.debtByPatient(professionalEmail);

    return [...unique.values()]
      .sort((a, b) => `${a!.surname} ${a!.name}`.localeCompare(`${b!.surname} ${b!.name}`, "es"))
      .map((patient) => {
        const owed = debt.get(patient!.email);

        return {
          // `toJSON` y no `{ ...patient }`: la entidad tiene campos marcados como ocultos
          // —la contraseña, entre ellos— y el serializador de MikroORM es el que los saca.
          // Desparramarla con el spread devuelve un objeto plano que se los saltea, y el
          // hash de cada paciente termina viajando al navegador.
          ...wrap(patient!).toJSON(),
          owesPayment: !!owed,
          /** Cuántos turnos suyos quedaron sin saldar, y por cuánto. Cero si no debe. */
          owedAppointments: owed?.appointments ?? 0,
          owedAmount: owed?.amount ?? 0,
        };
      });
  }

  /**
   * Cuánto le debe cada paciente a este profesional.
   *
   * Una sola consulta para toda la lista: preguntar de a un paciente convertía la
   * pantalla de pacientes en cien consultas.
   */
  private async debtByPatient(professionalEmail: string): Promise<Map<string, { appointments: number; amount: number }>> {
    const unpaid = await em.find(Appointment, {
      professional: { email: professionalEmail },
      patient: { $ne: null },
      ...DEBT_FILTER,
    });

    const debt = new Map<string, { appointments: number; amount: number }>();

    for (const appointment of unpaid) {
      const email = appointment.patient?.email;
      if (!email) continue;

      const entry = debt.get(email) ?? { appointments: 0, amount: 0 };
      entry.appointments++;
      entry.amount += pendingAmount(appointment);
      debt.set(email, entry);
    }

    return debt;
  }

  /**
   * Los turnos que ya se dieron y todavía no se cobraron del todo.
   *
   * Del más nuevo al más viejo: lo de esta semana es lo que se reclama, y lo de hace tres
   * meses ya es otra conversación. Con tope, porque esto va arriba del panel del
   * profesional y no es la pantalla de turnos.
   */
  async findUnpaidAppointments(professionalEmail: string, limit = 50): Promise<Appointment[]> {
    return em.find(
      Appointment,
      { professional: { email: professionalEmail }, patient: { $ne: null }, ...DEBT_FILTER },
      { populate: ["patient", "professional", "room.office"], orderBy: { date: "DESC", initialHour: "DESC" }, limit }
    );
  }

  /** Cuánta gente le quedó debiendo, y por cuánto. Es lo que se mira en los números. */
  async debtSummary(professionalEmail: string): Promise<{ people: number; appointments: number; amount: number }> {
    const debt = await this.debtByPatient(professionalEmail);

    let appointments = 0;
    let amount = 0;
    for (const entry of debt.values()) {
      appointments += entry.appointments;
      amount += entry.amount;
    }

    return { people: debt.size, appointments, amount };
  }

  /**
   * Registra si el turno se cobró.
   *
   * Es del profesional sobre sus propios turnos, igual que las observaciones. El pago
   * parcial es el único que lleva monto, y se valida contra el valor del turno: aceptar
   * un pago mayor que la consulta deja una deuda negativa dando vueltas por los números.
   */
  async setPayment(
    num: number,
    professionalEmail: string,
    data: { paymentState: PaymentState; paidAmount?: number | null }
  ): Promise<Appointment> {
    const appointment = await em.findOne(
      Appointment,
      { numAppointment: num, professional: { email: professionalEmail } },
      { populate: ["patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");
    if (!ACTIVE_APPOINTMENT_STATES.includes(appointment.state))
      throw badRequest("Ese turno está cancelado: no hay nada que cobrar");

    const state = data.paymentState;
    if (!PAYMENT_STATES.includes(state))
      throw badRequest("El cobro tiene que quedar como pagado, no pagado o pago parcial");

    if (state === "partial") {
      const value = appointment.value ?? 0;
      if (value <= 0) throw badRequest("Para registrar un pago parcial el turno tiene que tener un valor cargado");

      const amount = Number(data.paidAmount);
      if (!Number.isFinite(amount) || amount <= 0)
        throw badRequest("Escribí cuánto pagó: tiene que ser un número mayor que cero");
      if (amount > value) throw badRequest(`El pago no puede superar el valor del turno, que es $${value}`);
      // Pagó todo: es un pago completo y no uno parcial. Guardarlo como parcial deja un
      // turno que figura debiendo cero, y eso después hay que explicarlo en cada pantalla.
      if (amount === value) throw badRequest(`Pagó los $${value} completos: marcalo como pagado`);

      appointment.paidAmount = Math.round(amount);
    } else {
      appointment.paidAmount = null;
    }

    appointment.paymentState = state;
    await em.flush();

    return appointment;
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
      // El profesional también se popula: sin eso la relación viaja como un email suelto
      // y el cliente no puede distinguir de qué lado del turno está mirando.
      { populate: ["room.office", "patient", "professional", "recurrence"], orderBy: { date: "ASC", initialHour: "ASC" } }
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

  /**
   * Todo lo que pasa en el consultorio un día.
   *
   * No es la agenda de nadie en particular: es quién va a estar y a qué hora, mirado
   * desde la puerta de entrada. Por eso viene ordenado por horario de ingreso y no por
   * profesional, y por eso el corazón de la respuesta son los tramos en los que se
   * juntan varios pacientes a la vez: eso es lo que se nota en la sala de espera y lo
   * único que el admin puede anticipar el día anterior.
   */
  async findDayAgenda(day: string, crowdLimit = CROWD_LIMIT) {
    const date = parseISODate(day);
    if (!date) throw badRequest("Esa fecha no existe. Tiene que venir como AAAA-MM-DD");

    const rows = await em.find(
      Appointment,
      { date, state: { $in: ACTIVE_APPOINTMENT_STATES } },
      {
        populate: ["room.office", "patient", "professional"],
        orderBy: { initialHour: "ASC" as const, finalHour: "ASC" as const },
      }
    );

    const visits = rows.map((a) => ({
      numAppointment: a.numAppointment,
      initialHour: a.initialHour,
      finalHour: a.finalHour,
      state: a.state,
      overbooked: a.overbooked,
      patient: a.patient
        ? {
            email: a.patient.email,
            name: a.patient.name,
            surname: a.patient.surname,
            phoneNumber: a.patient.phoneNumber ?? null,
          }
        : null,
      professional: {
        email: a.professional.email,
        name: a.professional.name,
        surname: a.professional.surname,
        speciality: a.professional.speciality ?? null,
      },
      room: { idRoom: a.room.idRoom, description: a.room.description, office: a.room.office?.description ?? null },
    }));

    // Un turno sin paciente asignado ocupa el consultorio pero no llena la sala de
    // espera. Para contar gente sirve el otro, así que las dos cosas van por separado.
    const withPatient = visits.filter((visit) => visit.patient);

    return {
      date: day,
      visits,
      professionals: summarizeProfessionals(visits),
      crowded: findCrowdedStretches(withPatient, crowdLimit),
      crowdLimit,
      patients: new Set(withPatient.map((visit) => visit.patient!.email)).size,
    };
  }

  async findPendingProfessionalAppointmentsByEmail(professionalEmail: string): Promise<Appointment[]> {
    return await em.find(
      Appointment,
      { professional: { email: professionalEmail }, state: "pending" },
      // Del más cercano al más lejano: un pendiente para mañana urge más que uno para el
      // mes que viene, y uno cuya fecha ya pasó es el que primero hay que sacarse de
      // encima. Sin orden, la lista salía en el orden en que MySQL tuviera ganas.
      { populate: ["room.office", "patient"], orderBy: { date: "ASC" as const, initialHour: "ASC" as const } }
    );
  }

  /**
   * Rechaza un pedido de turno: lo saca de la agenda y le avisa al paciente.
   *
   * El turno se borra, no se marca. Un pendiente todavía no era un turno de nadie: la
   * franja tiene que quedar libre para el que venga después, y el índice único de
   * (fecha, hora, profesional, estado) no admite dos filas iguales.
   *
   * `deniedByProfessional` en false es el paciente dando de baja su propio pedido. Pasa
   * por el mismo borrado, pero no es una negativa y no tiene que contarse como tal.
   */
  async deleteAppointment(num: number, professionalEmail: string, deniedByProfessional = true) {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        state: "pending",
        professional: { email: professionalEmail },
      },
      { populate: ["patient", "professional"] }
    );

    if (!appointment) throw notFound("Ese turno no existe, ya no está pendiente o no es tuyo");

    await this.sendAppointmentRejectedEmails(appointment);

    // Antes de borrar: después de esto no queda nada que contar.
    if (deniedByProfessional) await this.countDenial(appointment.professional, false);

    em.remove(appointment);
    await em.flush();
    return appointment; // Not used for now
  }

  /**
   * Suma uno al contador de rechazos del mes.
   *
   * Cuenta en el mes en que se rechaza, no en el del turno rechazado. La pregunta que
   * contesta es sobre el profesional —cuántos pedidos está dejando pasar— y no sobre la
   * agenda de un mes: contándolo del otro lado, un pedido para diciembre rechazado hoy
   * quedaría invisible hasta diciembre. Para los que vencen solos da igual, porque
   * vencen a las horas de su propio horario.
   *
   * No hace fallar lo que la llamó. Es un número para el panel; si el contador no se
   * puede guardar, el turno igual tiene que quedar rechazado.
   */
  private async countDenial(professional: Person, automatic: boolean): Promise<void> {
    try {
      const month = monthKey(new Date());
      let tally = await em.findOne(Denial, { professional, month });

      if (!tally) tally = em.create(Denial, { professional, month, denied: 0, expired: 0 });

      tally.denied += 1;
      if (automatic) tally.expired += 1;

      await em.flush();
    } catch (error) {
      console.error("No se pudo contar el rechazo:", error);
    }
  }

  /**
   * Da de baja los pedidos que nadie contestó.
   *
   * Un turno pendiente al que se le pasó la hora ya no puede ocurrir: dejarlo ahí ensucia
   * la agenda y le hace creer al paciente que todavía puede salir. Se borra y se cuenta
   * aparte, como rechazo automático, que es lo que efectivamente fue.
   *
   * No se manda mail: el horario ya pasó, así que avisar ahora no le sirve a nadie.
   */
  async expirePendingAppointments(): Promise<number> {
    const today = startOfDay(new Date());

    const pending = await em.find(
      Appointment,
      { state: "pending", date: { $lte: today } },
      { populate: ["professional"] }
    );

    const now = new Date();
    let expired = 0;

    for (const appointment of pending) {
      const day = startOfDay(appointment.date);
      const [hour, minute] = appointment.initialHour.slice(0, 5).split(":").map(Number);
      const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);

      if (startsAt > now) continue;

      await this.countDenial(appointment.professional, true);
      em.remove(appointment);
      expired++;
    }

    if (expired > 0) await em.flush();
    return expired;
  }

  /** Los rechazos de un profesional, mes por mes. Los meses sin rechazos no tienen fila. */
  async denialsByMonth(professionalEmail: string): Promise<Map<string, { denied: number; expired: number }>> {
    const rows = await em.find(Denial, { professional: { email: professionalEmail } });
    return new Map(rows.map((row) => [row.month, { denied: row.denied, expired: row.expired }]));
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
      { populate: ["patient", "professional"] }
    );

    if (!appointment) throw notFound("Ese turno no existe, ya fue cancelado o no es tuyo");

    // Solo se toca lo que efectivamente vino. Si se le pasa una clave con undefined,
    // em.assign explota ("You must pass a non-undefined value...").
    const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<Appointment>;

    if (Object.keys(changes).length === 0) throw badRequest("No hay cambios para aplicar");

    if (changes.value !== undefined && changes.value !== null && changes.value < 0)
      throw badRequest("El valor del turno no puede ser negativo");

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

  /**
   * Que la fecha sea de hoy o de más adelante.
   *
   * Pasa por `startOfDay` y no por `new Date(fecha)` porque un "AAAA-MM-DD" pelado se
   * interpreta como medianoche UTC, que en UTC-3 cae el día anterior a las nueve de la
   * noche: comparado contra hoy, un turno para hoy quedaba "en una fecha que ya pasó" y
   * no entraba ninguno de los horarios que la propia lista ofrecía. El motor ya parseaba
   * bien la misma cadena; era esta comparación la que leía otro día.
   */
  isValidDate(date: Date | string): boolean {
    const day = startOfDay(date);
    return !Number.isNaN(day.getTime()) && day >= startOfDay(new Date());
  }

  // Separa los dos motivos por los que una fecha puede no servir, para poder decirle al
  // usuario cual de los dos le paso. Un turno de hoy mas tarde sigue siendo valido.
  private assertBookableDate(date: Date | string) {
    if (Number.isNaN(startOfDay(date).getTime())) throw badRequest("La fecha del turno no es válida");
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
      { populate: ["patient", "professional"] }
    );

    if (!appointment) throw notFound("Ese turno no está pendiente de confirmación o no es tuyo");

    appointment.state = "accepted";
    await em.flush();
    await this.sendAppointmentAcceptedEmails(appointment);
    return appointment; // Not used for now
  }

  /**
   * Un turno solo. La web nunca lo necesitó porque abre el detalle sobre la lista que ya
   * tiene en pantalla; la app sí, porque el detalle es una pantalla con su propia
   * dirección y puede abrirse sin haber pasado por ninguna lista.
   *
   * Lo ve quien participa del turno. El admin ve cualquiera: es el que controla lo que
   * se da en el consultorio.
   */
  async findAppointment(num: number, email: string, type: string) {
    const mine: FilterQuery<Appointment> =
      type === "admin" ? { numAppointment: num } : { numAppointment: num, $or: [{ professional: { email } }, { patient: { email } }] };

    const appointment = await em.findOne(Appointment, mine, {
      populate: ["patient", "professional", "room", "room.office", "recurrence"],
    });

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");

    return appointment;
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
      // Solo cuenta como rechazo si lo baja el profesional. Que el paciente se arrepienta
      // de su propio pedido no dice nada de quién iba a atenderlo.
      await this.deleteAppointment(num, appointment.professional.email, type === "professional");
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

    // El control del ritmo va antes que los mails, y no después: si esta reserva hizo
    // saltar el límite, el turno se borra junto con el resto de la tanda, y avisarle a
    // nadie de un turno que dejó de existir es peor que no avisar.
    const abuse = await this.securityService.reviewBookingRate(patientEmail).catch((err) => {
      console.error("Error revisando el ritmo de reservas:", err);
      return null;
    });

    if (abuse) {
      throw forbidden(
        `Tu cuenta quedó deshabilitada y se dieron de baja los turnos que sacaste recién (${abuse.deleted}). ` +
          "Si fue un error, escribinos desde la pantalla de contacto.",
        "USER_DISABLED"
      );
    }

    // Con la confirmación automática el turno ya nació aceptado, así que mandarle
    // "falta que el profesional lo confirme" sería mentira y lo dejaría esperando un
    // segundo mail que no va a llegar nunca.
    const created =
      refreshed.state === "accepted"
        ? this.sendAppointmentAcceptedEmails(refreshed)
        : this.sendAppointmentCreatedEmail(patientEmail, refreshed, initialHour);

    await created.catch((err) => console.error("Error enviando email de creación de turno:", err));

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
      if (!idRoom) throw badRequest("Tenés que elegir un consultorio para el turno");
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

  /**
   * Los mails de turno son todos la misma escena: qué pasó, cuándo es el turno y qué
   * hacer ahora. Estos ayudantes arman esa escena para que ninguno se olvide de una parte.
   */
  private appUrl(path: string): string {
    return `${process.env.BASE_URL ?? ""}${path}`;
  }

  /** Vacío si la relación no viene cargada: mejor omitir el dato que escribir "undefined". */
  private professionalName(appointment: Appointment): string {
    const professional = appointment.professional as any;
    if (!professional?.name) return "";
    return `${professional.name} ${professional.surname ?? ""}`.trim();
  }

  private appointmentFacts(appointment: Appointment, options: { finalHour?: boolean } = {}) {
    return [
      { label: "Fecha", value: this.formatDateLong(appointment.date as Date) },
      {
        label: "Hora",
        value: options.finalHour
          ? `${appointment.initialHour} a ${appointment.finalHour}`
          : String(appointment.initialHour ?? ""),
      },
      { label: "Profesional", value: this.professionalName(appointment) },
    ];
  }

  private async sendAppointmentCreatedEmail(patientEmail: string, appointment: Appointment, initialHour: string) {
    const htmlContent = [
      title("Pedimos tu turno"),
      paragraph("Ya tenemos tu pedido. Falta que el profesional lo confirme: te avisamos por mail apenas lo haga."),
      factsCard("El turno que pediste", [
        { label: "Fecha", value: this.formatDateLong(appointment.date as Date) },
        { label: "Hora", value: initialHour },
        { label: "Profesional", value: this.professionalName(appointment) },
      ]),
      button("Ver mis turnos", this.appUrl("/AppointmentsList")),
      note("Si lo pediste sin querer, cancelalo desde tus turnos y el horario queda libre para otra persona."),
    ].join("");

    const message = await this.mailService.createMessage(patientEmail, "Pedimos tu turno", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentUpdatedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = [
      title("Cambiamos tu turno de horario"),
      paragraph("Tu turno se movió. Estos son los datos nuevos:"),
      factsCard("Ahora es", this.appointmentFacts(appointment, { finalHour: true })),
      paragraph("Anotalo en tu calendario. Si este horario no te sirve, podés cancelarlo y pedir otro."),
      button("Ver mis turnos", this.appUrl("/AppointmentsList")),
    ].join("");

    const message = await this.mailService.createMessage(
      appointment.patient.email,
      "Cambiamos tu turno de horario",
      htmlContent
    );
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentRejectedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = [
      title("No pudimos darte ese turno"),
      paragraph("El profesional no pudo tomar el horario que pediste."),
      factsCard("El turno que no salió", this.appointmentFacts(appointment)),
      paragraph("Hay más horarios disponibles: elegí otro y lo intentamos de nuevo."),
      button("Buscar otro horario", this.appUrl("/Appointment")),
      note(
        `Si necesitás una fecha en particular, <a href="${this.appUrl(
          "/contacto"
        )}" style="color:#2f5e46">escribinos</a> y lo vemos.`
      ),
    ].join("");

    const message = await this.mailService.createMessage(
      appointment.patient.email,
      "No pudimos darte ese turno",
      htmlContent
    );
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentCanceledEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = [
      title("Se canceló tu turno"),
      paragraph("Te avisamos que este turno ya no está en la agenda:"),
      factsCard("Turno cancelado", this.appointmentFacts(appointment)),
      paragraph("Si lo necesitás, podés pedir otro cuando quieras."),
      button("Pedir otro turno", this.appUrl("/Appointment")),
    ].join("");

    const message = await this.mailService.createMessage(appointment.patient.email, "Se canceló tu turno", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentCanceledToProfessional(appointment: Appointment, email: string) {
    // El único mail que le llega al profesional por la actividad de todos los días, y el
    // único que puede apagar desde su configuración. Se pregunta acá, en el que manda, y
    // no en el que cancela: así el que cancela no tiene que acordarse de una preferencia
    // que no es suya.
    if (!wantsMail(appointment.professional, "slot-freed")) return;

    const patient = appointment.patient as any;
    const patientName = patient?.name ? `${patient.name} ${patient.surname ?? ""}`.trim() : "";

    const htmlContent = [
      title("Se te liberó un horario"),
      paragraph("Un paciente canceló su turno, así que ese horario vuelve a estar disponible."),
      factsCard("Horario liberado", [
        { label: "Fecha", value: this.formatDateLong(appointment.date as Date) },
        { label: "Hora", value: String(appointment.initialHour ?? "") },
        { label: "Paciente", value: patientName },
      ]),
      button("Ver mi agenda", this.appUrl("/ProfessionalHome")),
    ].join("");

    const message = await this.mailService.createMessage(email, "Se te liberó un horario", htmlContent);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentAcceptedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const htmlContent = [
      title("Tu turno está confirmado"),
      paragraph("El profesional confirmó el horario. Te esperamos:"),
      factsCard("Tu turno", this.appointmentFacts(appointment)),
      paragraph("Llegá cinco minutos antes. El día anterior te mandamos un recordatorio."),
      button("Ver mis turnos", this.appUrl("/AppointmentsList")),
      note("¿No vas a poder ir? Cancelalo desde tus turnos así el horario le queda a otra persona."),
    ].join("");

    const message = await this.mailService.createMessage(
      appointment.patient.email,
      "Tu turno está confirmado",
      htmlContent
    );
    await this.mailService.sendMail(message);
  }

  private async sendPatientAddedEmail(patientEmail: string, numAppointment: number) {
    const htmlContent = [
      title("Te anotamos en un turno"),
      paragraph("Desde el consultorio te asignaron un turno. Entrá para ver el día y la hora, y confirmá que estás de acuerdo."),
      factsCard("Datos del turno", [
        { label: "Número", value: String(numAppointment) },
        { label: "Estado", value: "Esperando que lo confirmes" },
      ]),
      button("Ver el turno", this.appUrl("/AppointmentsList")),
      warning("Si vos no pediste este turno ni esperabas que te lo asignaran, avisanos: puede ser un error de carga."),
    ].join("");

    const message = await this.mailService.createMessage(patientEmail, "Te anotamos en un turno", htmlContent);
    await this.mailService.sendMail(message);
  }

  /**
   * "martes 2 de septiembre". En un mail la fecha se lee de un vistazo y no se confunde
   * con el formato de otro país, cosa que 02/09/2026 no garantiza.
   *
   * Se arma al mediodía UTC a propósito: la fecha del turno se guarda sola, sin hora, y
   * a las 00:00 UTC en Buenos Aires todavía es el día anterior.
   */
  private formatDateLong(date: Date): string {
    if (!date) return "";
    const d = new Date(date);
    const noonUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(noonUtc);
  }

  /**
   * Los turnos de mañana que todavía no recibieron su recordatorio.
   *
   * El día de hoy sale de `startOfDay`, que lee la hora local. Antes se armaba con los
   * componentes UTC del reloj: de las nueve de la noche en adelante en Argentina ya es el
   * día siguiente en UTC, así que el job creía que hoy era mañana y buscaba los turnos de
   * pasado mañana. Corre cada hora, así que las corridas de las 21, 22 y 23 avisaban con
   * dos días de anticipación —y como el turno queda marcado como avisado, esa gente se
   * quedaba después sin el recordatorio de la víspera, que es el que sirve—.
   */
  async getAppointmentsForReminder(): Promise<Appointment[]> {
    const tomorrow = addDays(startOfDay(new Date()), 1);
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
    const htmlContent = [
      title("Mañana tenés turno"),
      paragraph("Te lo recordamos para que no se te pase:"),
      factsCard("Tu turno de mañana", this.appointmentFacts(appointment)),
      paragraph("Es en <strong>9 de Julio 3672</strong>. Llegá cinco minutos antes."),
      button("Ver mis turnos", this.appUrl("/AppointmentsList")),
      note("Si no vas a poder ir, cancelalo hoy: así el horario le queda a otra persona."),
    ].join("");

    const message = await this.mailService.createMessage(patientEmail, "Mañana tenés turno", htmlContent);
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

}

// Cuántos pacientes a la vez ya son "se llenó". Cuatro es el número con el que se
// empezó: la sala tiene lugar para más, pero a partir de ahí deja de sentirse vacía.
const CROWD_LIMIT = 4;

type DayVisit = {
  initialHour: string;
  finalHour: string;
  patient: { email: string; name: string; surname: string } | null;
  professional: { email: string; name: string; surname: string; speciality: string | null };
};

/** Quiénes atienden ese día, desde cuándo hasta cuándo y con cuánta gente. */
function summarizeProfessionals(visits: DayVisit[]) {
  const byEmail = new Map<
    string,
    { email: string; name: string; surname: string; speciality: string | null; from: string; to: string; visits: number; patients: number }
  >();

  for (const visit of visits) {
    const found = byEmail.get(visit.professional.email);

    if (!found) {
      byEmail.set(visit.professional.email, {
        ...visit.professional,
        from: visit.initialHour,
        to: visit.finalHour,
        visits: 1,
        patients: visit.patient ? 1 : 0,
      });
      continue;
    }

    if (visit.initialHour < found.from) found.from = visit.initialHour;
    if (visit.finalHour > found.to) found.to = visit.finalHour;
    found.visits += 1;
    if (visit.patient) found.patients += 1;
  }

  return Array.from(byEmail.values()).sort((a, b) => a.from.localeCompare(b.from) || a.surname.localeCompare(b.surname));
}

/**
 * Los tramos del día en los que hay `limit` pacientes o más al mismo tiempo.
 *
 * Se barre por los bordes de los turnos y no por hora redonda: dos turnos que empiezan
 * y media y se pisan quince minutos son un cruce real, y una grilla de horas enteras no
 * lo ve. Los tramos contiguos que siguen estando llenos se pegan en uno solo, porque lo
 * que interesa es "de tres y media a cinco hay gente", no cada subdivisión interna.
 */
/** Una persona con dos turnos encimados es una sola persona en la sala de espera. */
function dedupe(visits: DayVisit[]): DayVisit[] {
  const seen = new Set<string>();

  return visits.filter((visit) => {
    const key = `${visit.patient!.email}|${visit.initialHour}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findCrowdedStretches(visits: DayVisit[], limit: number) {
  const edges = Array.from(new Set(visits.flatMap((visit) => [visit.initialHour, visit.finalHour]))).sort();

  type Stretch = { from: string; to: string; peak: number; visits: DayVisit[] };
  const stretches: Stretch[] = [];

  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const inside = visits.filter((visit) => visit.initialHour <= from && visit.finalHour >= to);

    // Se cuentan personas y no turnos: alguien con dos turnos encimados ocupa una silla,
    // no dos, y lo que se quiere saber es cuánta gente hay en la sala.
    const people = new Set(inside.map((visit) => visit.patient!.email)).size;
    if (people < limit) continue;

    const previous = stretches[stretches.length - 1];

    if (previous && previous.to === from) {
      previous.to = to;
      previous.peak = Math.max(previous.peak, people);
      for (const visit of inside) if (!previous.visits.includes(visit)) previous.visits.push(visit);
      continue;
    }

    stretches.push({ from, to, peak: people, visits: [...inside] });
  }

  return stretches.map((stretch) => ({
    from: stretch.from,
    to: stretch.to,
    peak: stretch.peak,
    patients: dedupe(stretch.visits)
      .map((visit) => ({
        email: visit.patient!.email,
        name: visit.patient!.name,
        surname: visit.patient!.surname,
        initialHour: visit.initialHour,
        finalHour: visit.finalHour,
        professional: `${visit.professional.surname}, ${visit.professional.name}`,
      }))
      .sort((a, b) => a.initialHour.localeCompare(b.initialHour) || a.surname.localeCompare(b.surname)),
    professionals: Array.from(new Set(stretch.visits.map((visit) => `${visit.professional.surname}, ${visit.professional.name}`))).sort(),
  }));
}
