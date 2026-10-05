import { wrap, type FilterQuery } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { Appointment } from "./appointments.entity.js";
import { wantsMail } from "../people/mailPreferences.js";
import { PeopleService } from "../people/people.service.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { OfficeService } from "../offices/offices.service.js";
import { EntityManager } from "@mikro-orm/mysql";
import { RoomService } from "../rooms/rooms.service.js";
import { AppointmentEngine, assertPatientEnabled } from "./appointments.engine.js";
import MailService from "../config/mailer.js";
import { badRequest, conflict, forbidden, notFound } from "../shared/errors.js";
import { Denial } from "./denials.entity.js";
import { Person } from "../people/people.entity.js";
import { addDays, longDate, monthKey, parseISODate, sameCalendarDay, startOfDay } from "../shared/dates.js";
import { SecurityService } from "../security/security.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { noticeOf } from "../shared/shortNotice.js";
import { cachedWords, config, officeWords } from "../installation/installation.service.js";
import { capital } from "../shared/capital.js";
import { LIVE_APPOINTMENT_STATES } from "../shared/appointmentStates.js";
import { words, type Words } from "../shared/vocabulary.js";
import {
  acceptedMail,
  addedMail,
  canceledMail,
  createdMail,
  factsFor,
  newBookingMail,
  rejectedMail,
  reminderMail,
  slotFreedMail,
  tomorrowNotice,
  updatedMail,
  withdrawnMail,
  type BuiltMail,
  type MailData,
  type ReminderDay,
} from "./appointmentMails.js";
import { WaitlistService } from "../waitlist/waitlist.service.js";
import { attendanceLinks } from "../attendance/attendance.token.js";
import { branchOf, roomLabel } from "../shared/roomLabel.js";
import { assertCanSeePatient } from "../people/patientVisibility.js";
import { RULE_MESSAGES, requireRule, rulesNow } from "../installation/rules.js";
import { hoursOfNotice } from "../shared/shortNotice.js";
import { CLINIC_TIMEZONE } from "../shared/timezone.js";

const em = orm.em;

/** "09:00:00" pasa a "09:00". La base guarda los segundos, y en un mail sobran. */
const hhmm = (hour: unknown) => String(hour ?? "").slice(0, 5);

// Estados "vivos" de un turno. La lista vive en shared/appointmentStates, que explica por
// qué cancelar no es uno de ellos; acá se reexporta con el nombre de siempre para no
// tocar a todos los que ya la importan de este archivo.
export const ACTIVE_APPOINTMENT_STATES = LIVE_APPOINTMENT_STATES;

/** Los tres estados de cobro que puede tener un turno. */
export const PAYMENT_STATES = ["unpaid", "partial", "paid"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/**
 * Cuándo un turno cuenta como deuda.
 *
 * Tienen que darse las dos cosas. Que ya se haya dado, porque un turno de la semana que
 * viene no se debe todavía. Y que no esté saldado: sin cobrar, o cobrado a medias.
 *
 * "Que ya se haya dado" depende del consultorio. Por omisión es solo "assisted": a un
 * turno al que el paciente faltó no se le cobra. Con `chargesMissed` prendido en la
 * configuración, la ausencia también se debe. El cobro automático no la toca en ningún
 * caso (ver jobs/payment.job): cobrar en la puerta a alguien que no vino no tiene sentido,
 * así que una ausencia cobrable queda como deuda de verdad.
 *
 * Los turnos anteriores a esta columna tienen `paymentState` en null y quedan afuera por
 * definición: de esos no se sabe si se cobraron, y suponerlo sería inventar.
 */
export function debtFilter(chargesMissed: boolean) {
  return {
    state: chargesMissed ? { $in: ["assisted", "missed"] } : "assisted",
    paymentState: { $in: ["unpaid", "partial"] },
  } as const;
}

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
  private notificationService: NotificationService;
  private waitlistService: WaitlistService;

  constructor() {
    this.peopleService = new PeopleService();
    this.scheduleService = new ScheduleService();
    this.officeService = new OfficeService();
    this.roomService = new RoomService();
    this.mailService = new MailService();
    this.securityService = new SecurityService();
    this.notificationService = new NotificationService();
    this.waitlistService = new WaitlistService();
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
   * Los pacientes del profesional: los que alguna vez tuvieron turno con él, y los que
   * cargó él mismo sin cuenta aunque todavía no tengan ninguno.
   *
   * No cuenta el turno cancelado como vínculo: si lo único que hubo entre los dos fue un
   * turno que se dio de baja, esa persona no es su paciente. Un turno pendiente sí
   * cuenta, porque ya está en la agenda.
   *
   * El que cargó él entra igual porque, si no, la ficha recién creada no aparecía en
   * ningún lado y parecía que el alta no había andado. Solo el que cargó él: al que cargó
   * otro profesional y ahora también ve (PatientAccess) lo encuentra buscándolo, como a
   * cualquier otro.
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
        state: { $in: ACTIVE_APPOINTMENT_STATES },
      },
      { populate: ["patient"], fields: ["patient"] }
    );

    // Una persona aparece una vez por turno: acá se queda una sola.
    const unique = new Map<string, (typeof appointments)[number]["patient"]>();
    for (const appointment of appointments) {
      if (appointment.patient) unique.set(appointment.patient.email, appointment.patient);
    }

    const loaded = await em.find(Person, { anonymous: true, createdBy: professionalEmail });
    for (const patient of loaded) {
      if (!unique.has(patient.email)) unique.set(patient.email, patient);
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
      ...debtFilter((await config()).chargesMissed),
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
      { professional: { email: professionalEmail }, patient: { $ne: null }, ...debtFilter((await config()).chargesMissed) },
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

    const w = await officeWords();
    if (!appointment) throw notFound(`${capital(w.ese("turno"))} no existe o no es tuy${w.o("turno")}`);
    if (!ACTIVE_APPOINTMENT_STATES.includes(appointment.state))
      throw badRequest(`${capital(w.ese("turno"))} está cancelad${w.o("turno")}. No hay nada que cobrar`);

    const state = data.paymentState;
    if (!PAYMENT_STATES.includes(state))
      throw badRequest("El cobro tiene que quedar como pagado, no pagado o pago parcial");

    if (state === "partial") {
      const value = appointment.value ?? 0;
      if (value <= 0) throw badRequest(`Para registrar un pago parcial ${w.el("turno")} tiene que tener un valor cargado`);

      const amount = Number(data.paidAmount);
      if (!Number.isFinite(amount) || amount <= 0)
        throw badRequest("Escribí cuánto pagó. Tiene que ser un número mayor que cero");
      if (amount > value) throw badRequest(`El pago no puede superar el valor ${w.del("turno")}, que es $${value}`);
      // Pagó todo: es un pago completo y no uno parcial. Guardarlo como parcial deja un
      // turno que figura debiendo cero, y eso después hay que explicarlo en cada pantalla.
      if (amount === value) throw badRequest(`Pagó los $${value} completos. Marcalo como pagado`);

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
      patientCancelledAt: a.patientCancelledAt ?? null,
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

    if (!appointment) {
      const w = await officeWords();
      throw notFound(`${capital(w.ese("turno"))} no existe, ya no está pendiente o no es tuy${w.o("turno")}`);
    }

    if (deniedByProfessional) {
      await this.sendAppointmentRejectedEmails(appointment).catch((err) =>
        console.error("Error avisándole al paciente del pedido rechazado:", err)
      );

      // Antes de borrar: después de esto no queda nada que contar.
      await this.countDenial(appointment.professional, false);
    } else {
      // El paciente dando de baja su propio pedido. Antes le llegaba "no pudimos darte ese
      // turno, el profesional no pudo tomar el horario", que le echaba a otro algo que
      // acababa de hacer él. El que no se estaba enterando de nada era el profesional.
      await this.sendRequestWithdrawnToProfessional(appointment).catch((err) =>
        console.error("Error avisándole al profesional del pedido dado de baja:", err)
      );
    }

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

  async updateAppointment(num: number, professionalEmail: string, data: Partial<Appointment>, byAdmin = false) {
    if (byAdmin) await requireRule((p) => p.adminBooking, RULE_MESSAGES.adminBooking);
    else await requireRule((p) => p.proEdit, RULE_MESSAGES.proEdit);

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

    const w = await officeWords();
    if (!appointment)
      throw notFound(`${capital(w.ese("turno"))} no existe, ya fue cancelad${w.o("turno")} o no es tuy${w.o("turno")}`);

    // Solo se toca lo que efectivamente vino. Si se le pasa una clave con undefined,
    // em.assign explota ("You must pass a non-undefined value...").
    const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<Appointment>;

    if (Object.keys(changes).length === 0) throw badRequest("No hay cambios para aplicar");

    /*
     * La fecha llega como "AAAA-MM-DD" y hasta acá entraba tal cual.
     *
     * Puesta así en la entidad, el ORM la lee como medianoche UTC y después escribe la
     * columna DATE con los componentes locales. En UTC-3 eso guarda el día anterior:
     * mover un turno al 12 lo dejaba agendado el 11, mientras el mail y el aviso le
     * decían al paciente que era el 12. El paciente y la agenda quedaban en días
     * distintos, y del lado del consultorio no se veía nada raro.
     *
     * El alta nunca tuvo el problema porque el motor parsea la misma cadena como
     * medianoche local. Era este camino, el de mover un turno, el único que faltaba.
     * Va antes de todo lo demás para que la comparación de si cambió el día y los
     * choques de horario miren también el día correcto.
     */
    if (changes.date !== undefined) {
      const day = startOfDay(changes.date as unknown as string);
      if (Number.isNaN(day.getTime())) throw badRequest(`La fecha ${w.del("turno")} no es válida`);
      changes.date = day;
    }

    if (changes.value !== undefined && changes.value !== null && changes.value < 0)
      throw badRequest(`El valor ${w.del("turno")} no puede ser negativo`);

    // Solo se revalidan horarios (y se avisa por mail) si realmente cambió la franja.
    // Cambiarle el valor a un turno no tiene por qué mandarle un mail al paciente.
    const sameHour = (a?: string, b?: string) => (a ?? "").slice(0, 5) === (b ?? "").slice(0, 5);
    // La ficha manda siempre fecha y horario, aunque solo se haya tocado el valor. La
    // fecha guardada vuelve de la base como medianoche UTC y la que llega es medianoche
    // local: compararlas sin `sameCalendarDay` las daba siempre distintas y el paciente
    // recibía "tu turno se movió" por un cambio de precio.
    const scheduleChanged =
      (changes.initialHour !== undefined && !sameHour(changes.initialHour, appointment.initialHour)) ||
      (changes.finalHour !== undefined && !sameHour(changes.finalHour, appointment.finalHour)) ||
      (changes.date !== undefined && !sameCalendarDay(changes.date, appointment.date));

    if (scheduleChanged) {
      const initialHour = (changes.initialHour ?? appointment.initialHour).slice(0, 5);
      const finalHour = (changes.finalHour ?? appointment.finalHour).slice(0, 5);
      const date = changes.date ?? appointment.date;

      if (!this.scheduleService.isValidHourFormat(initialHour) || !this.scheduleService.isValidHourFormat(finalHour))
        throw badRequest("El horario tiene que estar en formato HH:MM");

      if (initialHour >= finalHour) throw badRequest("La hora de inicio tiene que ser anterior a la de fin");

      if (appointment.patient) {
        if (await this.checkPatientAppointmentOverlap(initialHour, finalHour, appointment.patient.email, date, undefined, num))
          throw conflict(`${w.El("paciente")} ya tiene ${w.otro("turno")} que se superpone con ese horario`);
      }

      if (await this.checkProfessionalAppointmentOverlap(initialHour, finalHour, professionalEmail, date, undefined, num))
        throw conflict(`Ya tenés ${w.otro("turno")} que se superpone con ese horario`);
    }

    em.assign(appointment, changes);
    await em.flush();

    if (scheduleChanged)
      await this.sendAppointmentUpdatedEmails(appointment).catch((err) =>
        console.error("Error avisándole al paciente del turno movido:", err)
      );

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
    const w = cachedWords();
    if (Number.isNaN(startOfDay(date).getTime())) throw badRequest(`La fecha ${w.del("turno")} no es válida`);
    if (!this.isValidDate(date)) throw badRequest(`No se puede sacar ${w.un("turno")} en una fecha que ya pasó`);
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
      // El día pasa por `startOfDay` porque a veces llega la fecha de un turno leído de la
      // base, que vuelve como medianoche UTC. Mandada así, la consulta buscaba en el día
      // anterior: mover un turno cambiándole solo la hora no veía los que se le cruzaban.
      date: startOfDay(date),
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ACTIVE_APPOINTMENT_STATES },
      // También los que atiende: un profesional se atiende con colegas, y a la hora en que
      // tiene un paciente no puede estar sentado del otro lado.
      $or: [{ patient: { email: patientEmail } }, { professional: { email: patientEmail } }],
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
      // Por `startOfDay` por lo mismo que el chequeo del paciente.
      date: startOfDay(date),
      initialHour: { $lt: finalHour },
      finalHour: { $gt: initialHour },
      state: { $in: ACTIVE_APPOINTMENT_STATES },
      // También los turnos en que él es el paciente: si a esa hora se atiende con un colega,
      // no puede dar turno. Es lo mismo que mira el chequeo del paciente, del otro lado.
      $or: [{ professional: { email: professionalEmail } }, { patient: { email: professionalEmail } }],
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

    const w = await officeWords();
    if (!appointment) throw notFound(`${capital(w.ese("turno"))} no existe o no es tuy${w.o("turno")}`);
    if (patientEmail && appointment.patient?.email !== patientEmail)
      throw badRequest(`${w.El("paciente")} no corresponde a ${w.este("turno")}`);

    if (data.state !== undefined) {
      if (!(await this.checkAppointmentStateFormat(data.state)))
        throw badRequest(`Ese estado no es válido. Para cancelar ${w.el("turno")} usá el botón de cancelar`);
      appointment.state = data.state;
    }
    if (data.observations !== undefined) {
      appointment.observations = data.observations;
    }
    await em.flush();
    return this.toDiagnosticView(appointment);
  }

  async addObservation(num: number, professionalEmail: string, observations: string, patientEmail: string) {
    const appointment = await em.findOne(
      Appointment,
      { numAppointment: num, professional: { email: professionalEmail } },
      { populate: ["patient"] }
    );

    const w = await officeWords();
    if (!appointment) throw notFound(`${capital(w.ese("turno"))} no existe o no es tuy${w.o("turno")}`);
    if (patientEmail && appointment.patient?.email !== patientEmail)
      throw badRequest(`${w.El("paciente")} no corresponde a ${w.este("turno")}`);

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

    if (!appointment) {
      const w = await officeWords();
      throw notFound(`${capital(w.ese("turno"))} no está pendiente de confirmación o no es tuy${w.o("turno")}`);
    }

    appointment.state = "accepted";
    await em.flush();

    // El turno ya quedó confirmado. Si el mail falla se registra y se sigue: devolver un
    // error acá le haría creer al profesional que no confirmó nada.
    await this.sendAppointmentAcceptedEmails(appointment).catch((err) =>
      console.error("Error avisándole al paciente del turno confirmado:", err)
    );

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

    if (!appointment) {
      const w = await officeWords();
      throw notFound(`${capital(w.ese("turno"))} no existe o no es tuy${w.o("turno")}`);
    }

    return appointment;
  }

  /**
   * `notifyWaitlist` es la respuesta del profesional a "¿les avisamos a los que esperan?".
   * Cuando cancela el paciente no se pregunta: el aviso sale solo si llegó con tiempo.
   * Una pantalla vieja no lo manda, y en ese caso la baja del profesional no avisa.
   */
  /**
   * La recepción, sobre la agenda de cualquier profesional.
   *
   * Hace lo mismo que haría el profesional del turno (los mismos controles de horario, los
   * mismos mails), pero con la regla de la administración en lugar de las del profesional:
   * en un consultorio con recepción, el profesional no toca la agenda y la recepción sí.
   */
  private async professionalOf(num: number): Promise<string> {
    const appointment = await em.findOne(Appointment, { numAppointment: num }, { populate: ["professional"] });
    const w = await officeWords();
    if (!appointment) throw notFound(`No existe ${w.ese("turno")}`);
    return appointment.professional.email;
  }

  async updateAsAdmin(num: number, data: Partial<Appointment>) {
    await requireRule((p) => p.adminBooking, RULE_MESSAGES.adminBooking);
    return this.updateAppointment(num, await this.professionalOf(num), data, true);
  }

  async cancelAsAdmin(num: number, options: { notifyWaitlist?: boolean } = {}) {
    await requireRule((p) => p.adminBooking, RULE_MESSAGES.adminBooking);
    return this.cancelAppointment(num, await this.professionalOf(num), { ...options, byAdmin: true });
  }

  async cancelAppointment(num: number, email: string, options: { notifyWaitlist?: boolean; byAdmin?: boolean } = {}) {
    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment: num,
        $or: [{ professional: { email } }, { patient: { email } }],
      },
      { populate: ["patient", "professional"] }
    );

    const w = await officeWords();
    if (!appointment) throw notFound(`${capital(w.ese("turno"))} no existe o no es tuy${w.o("turno")}`);

    /*
     * De que lado del turno esta el que lo baja.
     *
     * Sale del turno y no del tipo de cuenta, que es de donde salia antes. El profesional
     * tambien se atiende, y sacando turno con un colega el que cancela es el paciente:
     * mirando el tipo de cuenta esa baja se anotaba como un rechazo del colega, que no
     * hizo nada, y ademas no le avisaba a nadie de que el horario quedaba libre.
     */
    const asProfessional = appointment.professional.email === email;

    // Las reglas del consultorio. Retirar un pedido que todavía no se confirmó queda
    // siempre permitido, de los dos lados: no hay nada dado que se esté cancelando.
    if (appointment.state === "accepted") {
      const { p } = await rulesNow();
      if (asProfessional && !p.proCancel && !options.byAdmin) throw forbidden(RULE_MESSAGES.proCancel(w), "RULE_OFF");
      if (!asProfessional && !p.patientCancel) throw forbidden(RULE_MESSAGES.patientCancel(w), "RULE_OFF");
      if (!asProfessional && p.cancelNoticeHours > 0) {
        const left = hoursOfNotice(appointment.date, appointment.initialHour, new Date());
        if (left < p.cancelNoticeHours) throw forbidden(RULE_MESSAGES.cancelNotice(w, p.cancelNoticeHours), "RULE_OFF");
      }
    }

    if (appointment.state === "assisted")
      throw badRequest(`No se puede cancelar ${w.un("turno")} que ya figura como asistid${w.o("turno")}`);
    if (appointment.state === "missed")
      throw badRequest(`No se puede cancelar ${w.un("turno")} marcad${w.o("turno")} como 'No vino'`);

    if (appointment.state === "pending") {
      // Solo cuenta como rechazo si lo baja el profesional. Que el paciente se arrepienta
      // de su propio pedido no dice nada de quién iba a atenderlo.
      await this.deleteAppointment(num, appointment.professional.email, asProfessional);
      await this.waitlistService.onSlotFreed(appointment, asProfessional ? "professional" : "patient", options.notifyWaitlist === true);
      return appointment;
    }

    if (appointment.state !== "accepted")
      throw badRequest(`${capital(w.ese("turno"))} ya estaba cancelad${w.o("turno")}`);

    appointment.state = new Date().toISOString();
    // De quién vino la baja no se puede sacar del estado, que guarda la misma fecha
    // cancele quien cancele. Se anota solo la del paciente, que es la que el profesional
    // mira después para saber con cuánta anticipación le avisaron.
    if (!asProfessional) appointment.patientCancelledAt = new Date();
    await em.flush();

    await this.sendAppointmentCanceledEmails(appointment).catch((err) =>
      console.error("Error avisándole al paciente del turno cancelado:", err)
    );

    if (!asProfessional)
      await this.sendAppointmentCanceledToProfessional(appointment, appointment.professional.email).catch((err) =>
        console.error("Error avisándole al profesional del horario liberado:", err)
      );

    // Después de todo lo demás: el horario ya quedó libre en la base, que es lo que el
    // aviso le promete a quien lo recibe.
    await this.waitlistService.onSlotFreed(appointment, asProfessional ? "professional" : "patient", options.notifyWaitlist === true);

    return appointment; // Not used for now
  }

  async createPatientAppointment(
    patientEmail: string,
    date: Date,
    initialHour: string,
    professionalEmail: string,
    officeId: number
  ): Promise<Partial<Appointment>> {
    await requireRule((p) => p.patientBooking, RULE_MESSAGES.patientBooking);

    const refreshed = await em.transactional(async (em) => {
      this.assertValidHour(initialHour, "La hora de inicio");
      this.assertBookableDate(date);

      // Una sesión abierta sobrevive unos minutos a la baja de la cuenta, así que la
      // comprobación va acá y no solo en quien deja entrar.
      assertPatientEnabled(await this.peopleService.findPersonByEmail(patientEmail, em));

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
      const w = await officeWords();
      throw forbidden(
        `Tu cuenta quedó deshabilitada y se dieron de baja ${w.los("turno")} que sacaste recién (${abuse.deleted}). ` +
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
        : this.sendAppointmentCreatedEmail(patientEmail, refreshed);

    await created.catch((err) => console.error("Error enviando email de creación de turno:", err));

    // Y del otro lado. Ninguno de los dos mails puede voltear el alta: el turno ya está
    // dado y hacerlo fallar acá dejaría a la persona creyendo que no lo tiene.
    await this.sendNewBookingToProfessional(refreshed).catch((err) =>
      console.error("Error avisándole al profesional del turno nuevo:", err)
    );

    // Si lo estaba esperando, ya lo tiene: sale de esa lista. No falla nunca.
    await this.waitlistService.onBooked(patientEmail, refreshed);

    // `state` lo lee el asistente para decir si el turno quedó confirmado o pendiente.
    const result = {
      numAppointment: refreshed.numAppointment,
      date: refreshed.date,
      initialHour: refreshed.initialHour,
      finalHour: refreshed.finalHour,
      state: refreshed.state,
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
    overbooked = false,
    /** La recepción: sin las reglas del profesional, con la suya. */
    byAdmin = false
  ): Promise<Partial<Appointment>> {
    if (byAdmin) {
      await requireRule((p) => p.adminBooking, RULE_MESSAGES.adminBooking);
    } else {
      await requireRule((p) => p.proCreate, RULE_MESSAGES.proCreate);
      if (overbooked) await requireRule((p) => p.proOverbook, RULE_MESSAGES.proOverbook);
    }

    const created = await em.transactional(async (em) => {
      this.assertValidHour(initialHour, "La hora de inicio");
      this.assertValidHour(finalHour, "La hora de fin");
      this.assertBookableDate(date);

      const w = await officeWords();
      if (initialHour >= finalHour) throw badRequest("La hora de inicio tiene que ser anterior a la de fin");
      if (!(value >= 0)) throw badRequest(`El valor ${w.del("turno")} tiene que ser un número mayor o igual a cero`);
      if (!idRoom) throw badRequest(`Tenés que elegir ${w.un("sala")} para ${w.el("turno")}`);
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

    // Para el paciente es exactamente lo mismo que si lo asignaran a un turno que ya
    // existía: un turno que él no pidió y que le aparece en la lista. Que se entere por
    // dos caminos distintos según cómo lo cargó el profesional no lo entiende nadie.
    if (patientEmail)
      await this.sendPatientAddedEmail(patientEmail, created.numAppointment as number).catch((err) =>
        console.error("Error avisándole al paciente del turno que le cargaron:", err)
      );

    return created;
  }

  async addPatientToAppointment(numAppointment: number, patientEmail: string, professionalEmail: string) {
    await requireRule((p) => p.proCreate, RULE_MESSAGES.proCreate);

    const appointment = await this.findUniqueProfessionalAppointment(professionalEmail, numAppointment);

    const w = await officeWords();
    if (appointment.patient)
      throw conflict(`${capital(w.ese("turno"))} ya tiene ${w.un("paciente")} asignad${w.o("paciente")}`);

    // Un paciente sin cuenta de otro profesional no existe para este: ver canSeePatient.
    const patient = await this.peopleService.findPersonByEmail(patientEmail);
    await assertCanSeePatient(patient, professionalEmail);
    assertPatientEnabled(patient);

    if (await this.checkPatientAppointmentOverlap(appointment.initialHour, appointment.finalHour, patientEmail, appointment.date))
      throw conflict(`${w.El("paciente")} ya tiene ${w.otro("turno")} que se superpone con ese horario`);

    appointment.patient = patient;

    await em.flush();

    await this.sendPatientAddedEmail(patientEmail, numAppointment).catch((err) =>
      console.error("Error avisándole al paciente del turno asignado:", err)
    );

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

  /** Vacío si el turno no tiene paciente, que es el caso de una franja reservada a mano. */
  private patientName(appointment: Appointment): string {
    const patient = appointment.patient as any;
    if (!patient?.name) return "";
    return `${patient.name} ${patient.surname ?? ""}`.trim();
  }

  /**
   * Las palabras del rubro de este consultorio, para los mails y los avisos. Ver
   * shared/vocabulary: con las de siempre, todo dice lo que decía.
   */
  private async words(): Promise<Words> {
    return words((await config()).vocabulary);
  }

  /**
   * Lo que un mail sabe del turno, ya escrito y en las palabras del consultorio.
   *
   * `to` es quién lo recibe: al paciente se le nombra el profesional y solo la hora de
   * inicio, al profesional el paciente, las dos horas y el consultorio. Ver factsFor.
   */
  private async mailData(appointment: Appointment, w: Words, to: "patient" | "professional" = "patient"): Promise<MailData> {
    // Con varias sucursales el mail dice en cuál es, y el recordatorio usa su dirección.
    const branch = (await config()).policies.multiBranch ? await branchOf(appointment.room) : null;
    const branchAddress = branch?.address ? [branch.address, branch.city].filter(Boolean).join(", ") : undefined;

    return {
      branchAddress,
      facts: factsFor(w, to, {
        branch: branch ? branch.name : undefined,
        date: this.formatDateLong(appointment.date as Date),
        start: hhmm(appointment.initialHour),
        end: hhmm(appointment.finalHour),
        professional: this.professionalName(appointment),
        patient: this.patientName(appointment),
        room: to === "professional" ? await roomLabel(appointment.room) : "",
      }),
      when: this.whenOf(appointment),
      agenda: this.agendaOf(appointment),
      patient: this.patientOf(appointment, w),
      professional: this.professionalName(appointment),
      url: (path) => this.appUrl(path),
      shortNoticeHours: (await config()).shortNoticeHours,
      canCancel: (await config()).policies.patientCancel,
      canBook: (await config()).policies.patientBooking,
    };
  }

  /* ============================================================
     Los avisos de la campanita.

     Van pegados al mail, uno al lado del otro, porque son el mismo hecho contado por dos
     lados: el que se entera por mail y el que se entera al entrar. Los textos de los dos
     salen de la misma función (ver appointmentMails), así no puede haber dos ideas
     distintas de qué es una novedad.

     Ninguno pregunta por las preferencias de mail. Apagar un mail es pedir que no
     interrumpan el correo; adentro de la aplicación el aviso no interrumpe nada, y es el
     único lugar donde la novedad queda esperando al que entra después.

     `notify` no falla nunca y no devuelve nada, así que estas llamadas no llevan `catch`
     ni cambian nada de lo que pasa alrededor.
     ============================================================ */

  /**
   * "martes 2 de septiembre a las 09:00", que es como se lee un turno en un renglón. Para
   * los avisos al paciente: sin la hora de fin, por lo mismo que en factsFor.
   */
  private whenOf(appointment: Appointment): string {
    return `${this.formatDateLong(appointment.date as Date)} a las ${hhmm(appointment.initialHour)}`;
  }

  /** "martes 2 de septiembre de 09:00 a 09:45": el mismo renglón, para el profesional. */
  private agendaOf(appointment: Appointment): string {
    return `${this.formatDateLong(appointment.date as Date)} de ${hhmm(appointment.initialHour)} a ${hhmm(appointment.finalHour)}`;
  }

  private patientOf(appointment: Appointment, w: Words): string {
    const patient = appointment.patient as any;
    return patient?.name ? `${patient.name} ${patient.surname ?? ""}`.trim() : w.Un("paciente");
  }

  /** Manda un mail ya armado. */
  private async deliver(to: string, mail: BuiltMail): Promise<void> {
    const message = await this.mailService.createMessage(to, mail.subject, mail.html);
    await this.mailService.sendMail(message);
  }

  private async sendAppointmentCreatedEmail(patientEmail: string, appointment: Appointment) {
    const w = await this.words();
    const mail = createdMail(w, await this.mailData(appointment, w));

    await this.notificationService.notify(patientEmail, {
      eventKey: `t${appointment.numAppointment}:pedido`,
      ...mail.notice,
      tone: "info",
      target: "appointments",
    });

    await this.deliver(patientEmail, mail);
  }

  /**
   * Que a un profesional le sacaron un turno.
   *
   * Es el único hecho del día a día que le llega de afuera y que hasta ahora no salía por
   * ningún lado más que la campana, y la campana pide tener la aplicación abierta. Un
   * pedido que nadie mira se vence solo a la hora del turno, así que quien no entra en el
   * medio se entera cuando ya no hay nada que contestar.
   */
  private async sendNewBookingToProfessional(appointment: Appointment) {
    if (!appointment.patient) return;

    const w = await this.words();
    const pending = appointment.state === "pending";
    const mail = newBookingMail(w, await this.mailData(appointment, w, "professional"), pending);

    await this.notificationService.notify(appointment.professional.email, {
      eventKey: `t${appointment.numAppointment}:${pending ? "pidio" : "saco"}`,
      ...mail.notice,
      tone: pending ? "warn" : "info",
      target: "appointments",
    });

    if (!wantsMail(appointment.professional, "new-booking")) return;
    await this.deliver(appointment.professional.email, mail);
  }

  /**
   * Que un paciente dio de baja un pedido que todavía no estaba contestado.
   *
   * Va al profesional porque el pedido se borra: desaparece de su lista sin dejar rastro,
   * y sin este aviso lo que ve es un pedido que estaba ayer y hoy no está.
   */
  private async sendRequestWithdrawnToProfessional(appointment: Appointment) {
    const w = await this.words();
    const mail = withdrawnMail(w, await this.mailData(appointment, w, "professional"));

    await this.notificationService.notify(appointment.professional.email, {
      eventKey: `t${appointment.numAppointment}:pedido-baja`,
      ...mail.notice,
      tone: "info",
      // El pedido se borra de la base: no queda ficha que abrir.
      target: null,
    });

    if (!wantsMail(appointment.professional, "request-withdrawn")) return;
    await this.deliver(appointment.professional.email, mail);
  }

  private async sendAppointmentUpdatedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const w = await this.words();
    const mail = updatedMail(w, await this.mailData(appointment, w));

    await this.notificationService.notify(appointment.patient.email, {
      eventKey: `t${appointment.numAppointment}:movido:${String(appointment.date as any).slice(0, 10)}${String(
        appointment.initialHour ?? ""
      ).slice(0, 5)}`,
      ...mail.notice,
      tone: "warn",
      target: "appointments",
    });

    await this.deliver(appointment.patient.email, mail);
  }

  private async sendAppointmentRejectedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const w = await this.words();
    const mail = rejectedMail(w, await this.mailData(appointment, w));

    await this.notificationService.notify(appointment.patient.email, {
      eventKey: `t${appointment.numAppointment}:rechazado`,
      ...mail.notice,
      tone: "warn",
      target: "booking",
    });

    await this.deliver(appointment.patient.email, mail);
  }

  private async sendAppointmentCanceledEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const w = await this.words();
    const mail = canceledMail(w, await this.mailData(appointment, w));

    await this.notificationService.notify(appointment.patient.email, {
      eventKey: `t${appointment.numAppointment}:cancelado`,
      ...mail.notice,
      tone: "warn",
      // El turno ya no está: se lo lleva a pedir otro, que es lo que le queda por hacer.
      target: "booking",
    });

    await this.deliver(appointment.patient.email, mail);
  }

  private async sendAppointmentCanceledToProfessional(appointment: Appointment, email: string) {
    // Con cuánta anticipación avisó. Es el mismo corte que marca la ficha del turno y que
    // cuenta el panel de comportamiento: por debajo de la baja tardía el horario ya no se
    // alcanza a ofrecer, y eso cambia lo que el profesional hace al leerlo.
    const aviso = noticeOf(appointment, (await config()).shortNoticeHours);
    const w = await this.words();
    const mail = slotFreedMail(w, await this.mailData(appointment, w, "professional"), aviso.short);

    await this.notificationService.notify(email, {
      eventKey: `t${appointment.numAppointment}:libre`,
      ...mail.notice,
      tone: aviso.short ? "warn" : "info",
      target: "appointments",
    });

    // El único mail que le llega al profesional por la actividad de todos los días, y el
    // único que puede apagar desde su configuración. Se pregunta acá, en el que manda, y
    // no en el que cancela: así el que cancela no tiene que acordarse de una preferencia
    // que no es suya.
    if (!wantsMail(appointment.professional, "slot-freed")) return;
    await this.deliver(email, mail);
  }

  /**
   * El mail de turno confirmado, para quien confirma desde afuera de esta clase.
   *
   * Existe por la confirmación en tanda, que vive en la configuración del profesional.
   * Es el mismo mail que manda `acceptAppointment` y tiene que seguir siéndolo.
   */
  async sendAcceptedMail(appointment: Appointment): Promise<void> {
    await this.sendAppointmentAcceptedEmails(appointment);
  }

  private async sendAppointmentAcceptedEmails(appointment: Appointment) {
    if (!appointment.patient) return;

    const w = await this.words();
    const mail = acceptedMail(w, await this.mailData(appointment, w), (await config()).visitAdvice);

    await this.notificationService.notify(appointment.patient.email, {
      eventKey: `t${appointment.numAppointment}:confirmado`,
      ...mail.notice,
      tone: "good",
      target: "appointments",
    });

    await this.deliver(appointment.patient.email, mail);
  }

  private async sendPatientAddedEmail(patientEmail: string, numAppointment: number) {
    // Se vuelve a leer el turno, con el profesional: quien llama tiene a mano el número y
    // poco más. Antes el mail salía con eso, el número del turno, que es un dato interno y
    // no le dice nada al paciente, y sin el día ni la hora. En un fork, por lo mismo que
    // roomLabel: el pedido que dio de alta el turno no tiene por qué enterarse.
    let appointment: Appointment | null = null;
    try {
      appointment = await em.fork().findOne(Appointment, { numAppointment }, { populate: ["professional"] });
    } catch (error) {
      console.error("No se pudo leer el turno para el aviso al paciente:", error);
    }

    const w = await this.words();
    const mail = addedMail(w, appointment ? await this.mailData(appointment, w) : null, (path) => this.appUrl(path));

    await this.notificationService.notify(patientEmail, {
      eventKey: `t${numAppointment}:alta`,
      ...mail.notice,
      tone: "good",
      target: "appointments",
    });

    await this.deliver(patientEmail, mail);
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
      timeZone: CLINIC_TIMEZONE,
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
  /**
   * Los turnos a los que hay que recordarles ahora.
   *
   * Sin horas cargadas en la configuración es el de la víspera, como siempre: todos los
   * turnos de mañana, sin importar la hora. Con horas, los que arrancan dentro de esas
   * horas. No son lo mismo —a un turno de mañana a las ocho de la noche la víspera le
   * escribe desde la medianoche— y por eso la víspera no se expresa con un número.
   *
   * La tarea corre una vez por hora, así que con horas el recordatorio sale entre N y N-1
   * horas antes. Y uno pedido con menos anticipación que eso sale en la próxima vuelta,
   * mientras el turno no haya empezado.
   */
  async getAppointmentsForReminder(now = new Date()): Promise<Appointment[]> {
    const hoursBefore = (await config()).reminderHoursBefore;

    if (hoursBefore === null) {
      const tomorrow = addDays(startOfDay(now), 1);
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

    // La fecha y la hora están en dos columnas, así que la base trae los días que pueden
    // entrar y la cuenta fina se hace acá.
    const until = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    const candidates = await em.find(
      Appointment,
      {
        date: { $gte: startOfDay(now), $lte: startOfDay(until) },
        state: "accepted",
        reminderSent: "not sent",
        patient: { $ne: null },
      },
      { populate: ["patient", "professional"] }
    );

    return candidates.filter((appointment) => {
      const start = startOfDay(appointment.date);
      const [hours, minutes] = String(appointment.initialHour).split(":").map(Number);
      start.setHours(hours, minutes || 0, 0, 0);
      return start > now && start <= until;
    });
  }

  /** "Hoy", "mañana" o la fecha del turno, para el recordatorio. */
  private reminderDayOf(appointment: Appointment, now = new Date()): ReminderDay {
    const day = startOfDay(appointment.date).getTime();
    if (day === startOfDay(now).getTime()) return "today";
    if (day === addDays(startOfDay(now), 1).getTime()) return "tomorrow";
    return { date: longDate(appointment.date) };
  }

  /**
   * El recordatorio, con el aviso de la campanita.
   *
   * Los dos botones del mail abren una página que pide un toque más para confirmar. No
   * contestan solos al abrirse porque los programas de correo abren los links por su cuenta
   * para revisarlos, y un "No puedo ir" que se contesta al abrirse cancelaría turnos que
   * nadie canceló. Si los links no se pudieron firmar, el mail sale sin la pregunta.
   */
  async sendReminderEmails(appointment: Appointment): Promise<void> {
    if (!appointment.patient) return;

    const rules = await config();
    const w = words(rules.vocabulary);
    const data = await this.mailData(appointment, w);
    const mail = reminderMail(w, data, {
      day: this.reminderDayOf(appointment),
      address: data.branchAddress ?? rules.address,
      advice: rules.visitAdvice,
      links: attendanceLinks(appointment),
    });

    await this.notificationService.notify(appointment.patient.email, {
      // La clave sigue diciendo "manana" aunque el recordatorio salga el mismo día: es la
      // marca de que este aviso ya se dio, y cambiarla haría que los turnos que ya lo
      // recibieron lo reciban de nuevo.
      eventKey: `t${appointment.numAppointment}:manana`,
      ...mail.notice,
      tone: "info",
      target: "appointments",
    });

    await this.deliver(appointment.patient.email, mail);
  }

  /**
   * El aviso de la víspera del profesional.
   *
   * El del paciente sale turno por turno, porque el paciente tiene uno. El profesional
   * tiene la agenda entera, así que lo suyo es un solo renglón con cuántos y a qué hora
   * empieza: catorce avisos separados no son un aviso, son la agenda otra vez.
   *
   * La clave lleva el día, y eso es lo que hace que se pueda llamar sin cuidado. El job
   * corre cada hora; de las veinticuatro corridas del día, la primera lo anota y las otras
   * veintitrés chocan contra la clave y no hacen nada.
   */
  async notifyTomorrowToProfessionals(): Promise<void> {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const tomorrow2359 = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000 - 1000);
    const iso = tomorrow.toISOString().slice(0, 10);

    const appointments = await em.find(
      Appointment,
      { date: { $gte: tomorrow, $lte: tomorrow2359 }, state: "accepted" },
      { populate: ["professional"], orderBy: { initialHour: "ASC" } }
    );

    // Agrupados por profesional, quedándose con el primero de cada uno. Vienen ordenados
    // por hora, así que el primero que aparece es el que abre el día.
    const byProfessional = new Map<string, { first: string; count: number }>();

    for (const appointment of appointments) {
      const email = appointment.professional.email;
      const found = byProfessional.get(email);

      if (found) found.count += 1;
      else byProfessional.set(email, { first: String(appointment.initialHour ?? "").slice(0, 5), count: 1 });
    }

    const w = await this.words();

    for (const [email, { first, count }] of byProfessional) {
      await this.notificationService.notify(email, {
        eventKey: `manana:${iso}`,
        ...tomorrowNotice(w, count, first),
        tone: "info",
        target: "appointments",
      });
    }
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
