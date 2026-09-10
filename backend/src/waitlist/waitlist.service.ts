import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { Vacation } from "../settings/vacation.entity.js";
import { WaitlistEntry, type WaitlistNotice } from "./waitlist.entity.js";
import { WaitlistUsage } from "./waitlistUsage.entity.js";
import { WaitlistStat } from "./waitlistStat.entity.js";
import { SecurityService } from "../security/security.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import MailService from "../config/mailer.js";
import { button, escapeHtml, factsCard, note, paragraph, title } from "../config/mailTemplate.js";
import { badRequest, conflict, forbidden, notFound } from "../shared/errors.js";
import { addDays, longDate, monthKey, startOfDay, startOfWeek, toISODate } from "../shared/dates.js";
import { WAITLIST_LIMITS, fits, freedInTime, parseDays, parseWaitlistRequest } from "./waitlist.rules.js";

const em = orm.em;

/**
 * Los estados en que un turno ocupa su horario.
 *
 * Es la misma lista que `ACTIVE_APPOINTMENT_STATES`, copiada a propósito: el servicio de
 * turnos importa este para avisar cuando se libera un horario, y si este importara aquel
 * los dos módulos quedarían esperándose al arrancar.
 */
const LIVE_STATES = ["pending", "accepted", "assisted", "missed"];

/** Cómo se llama cada día en la tabla de horarios, que los guarda sin tilde. */
const SCHEDULE_DAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

type Who = { email: string; name: string; surname: string };

/** Lo que ve el paciente de una lista en la que está. */
export interface WaitlistView {
  id: number;
  professional: Who;
  days: number[];
  fromHour: string;
  toHour: string;
  createdAt: Date;
  expiresAt: Date;
  noticesSent: number;
  notices: WaitlistNotice[];
}

/** Lo que ve el profesional de cada persona que lo espera. */
export interface WaitingPatient {
  id: number;
  patient: Who & { phoneNumber: string | null };
  days: number[];
  fromHour: string;
  toHour: string;
  createdAt: Date;
  expiresAt: Date;
  noticesSent: number;
}

export interface WaitlistStatus {
  /** Si este profesional trabaja con lista de espera. */
  enabled: boolean;
  /** Si su lista está llena. Solo cuenta para quien todavía no está adentro. */
  full: boolean;
  /** En la que ya está con este profesional, si está. */
  entry: WaitlistView | null;
  /** Todas las listas en que está ahora, con este profesional incluido. */
  active: Who[];
  /** Cuántas veces se anotó este mes. */
  monthUsed: number;
  limits: typeof WAITLIST_LIMITS;
}

function who(person: Person): Who {
  return { email: person.email, name: person.name, surname: person.surname };
}

function viewOf(entry: WaitlistEntry): WaitlistView {
  return {
    id: entry.id!,
    professional: who(entry.professional as Person),
    days: parseDays(entry.days),
    fromHour: entry.fromHour,
    toHour: entry.toHour,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    noticesSent: entry.noticesSent,
    notices: entry.notices ?? [],
  };
}

const hhmm = (hour: string) => String(hour ?? "").slice(0, 5);

/**
 * La lista de espera: anotarse, salir, y avisar cuando se libera un horario.
 *
 * El aviso es la parte que importa y la que más cuidado lleva. Sale solo si el horario de
 * verdad se puede volver a pedir —lo liberaron con más de un día, cae en un módulo, no es
 * un día de licencia, nadie lo ocupó y entra en las dos semanas que se pueden reservar—,
 * porque un aviso de algo que después no se puede tomar es peor que no avisar: la persona
 * entra corriendo y se encuentra con que no había nada.
 */
export class WaitlistService {
  private security = new SecurityService();
  private notifications = new NotificationService();
  private mail = new MailService();

  private async findProfessional(email: string): Promise<Person> {
    const professional = await em.findOne(Person, { email });
    if (!professional || professional.type !== "professional") throw notFound("Ese profesional no existe");
    return professional;
  }

  /** Las listas vigentes de un paciente. Las vencidas siguen en la tabla hasta la limpieza de la noche. */
  private activeOf(patientEmail: string) {
    return em.find(
      WaitlistEntry,
      { patient: { email: patientEmail }, expiresAt: { $gt: new Date() } },
      { populate: ["professional"], orderBy: { createdAt: "ASC" } }
    );
  }

  private waitingFor(professionalEmail: string) {
    return em.count(WaitlistEntry, { professional: { email: professionalEmail }, expiresAt: { $gt: new Date() } });
  }

  /** Lo que necesita la ventana del botón para dibujarse, antes de que la persona haga nada. */
  async status(patientEmail: string, professionalEmail: string): Promise<WaitlistStatus> {
    const professional = await this.findProfessional(professionalEmail);
    const mine = await this.activeOf(patientEmail);
    const waiting = await this.waitingFor(professional.email);
    const usage = await em.findOne(WaitlistUsage, { person: { email: patientEmail }, month: monthKey(new Date()) });

    const entry = mine.find((item) => item.professional.email === professional.email) ?? null;

    return {
      enabled: professional.waitlistEnabled !== false,
      full: !entry && waiting >= WAITLIST_LIMITS.maxPerProfessional,
      entry: entry ? viewOf(entry) : null,
      active: mine.map((item) => who(item.professional as Person)),
      monthUsed: usage?.created ?? 0,
      limits: WAITLIST_LIMITS,
    };
  }

  /**
   * Anota a alguien en la lista de un profesional.
   *
   * Los topes tienen consecuencias distintas, y el orden en que se miran es parte de eso:
   *
   * 1. Anotarse más de cinco veces en el mes cierra la cuenta. La pantalla apaga el botón
   *    al llegar a cinco y vuelve a preguntar cuántas quedan justo antes de mostrarlo, así
   *    que usándola no hay forma de llegar acá. Quien llega es alguien mandando pedidos a
   *    mano, que es exactamente lo que la regla vino a frenar.
   * 2. Estar en dos listas a la vez, o encontrar llena la del profesional, es un límite y
   *    nada más: se rechaza con el motivo y no pasa nada con la cuenta.
   *
   * Solo se cierra la cuenta de un paciente. Un profesional también se anota, porque
   * también se atiende, pero cerrarle la cuenta lo deja sin agenda: a él se le dice que no
   * y listo.
   */
  async subscribe(user: { email: string; type: string }, professionalEmail: string, body: any): Promise<WaitlistView> {
    if (user.type === "admin") throw forbidden("La cuenta de administrador no se anota en listas de espera");
    if (user.email === professionalEmail) throw badRequest("No te podés anotar en tu propia lista de espera");

    const request = parseWaitlistRequest(body);
    const professional = await this.findProfessional(professionalEmail);

    if (!professional.active || !professional.bookable) throw badRequest("Ese profesional no está tomando turnos. Elegí otro");
    if (professional.waitlistEnabled === false) throw conflict("Este profesional no trabaja con lista de espera", "WAITLIST_DISABLED");

    const patient = await em.findOne(Person, { email: user.email });
    if (!patient || !patient.active) throw forbidden("Tu cuenta no está habilitada");

    const now = new Date();
    const month = monthKey(now);
    let usage = await em.findOne(WaitlistUsage, { person: { email: patient.email }, month });

    if ((usage?.created ?? 0) >= WAITLIST_LIMITS.maxPerMonth) {
      if (patient.type === "client") {
        await this.security.lockForAbuse(
          patient.email,
          `Quiso anotarse en más de ${WAITLIST_LIMITS.maxPerMonth} listas de espera en el mismo mes`
        );
        // Lo que tenía anotado se va con la cuenta, igual que los turnos de una ráfaga: una
        // cuenta cerrada no tiene por qué seguir recibiendo avisos ni ocupando lugares.
        await em.nativeDelete(WaitlistEntry, { patient: { email: patient.email } });

        throw forbidden(
          "Tu cuenta quedó deshabilitada por anotarte en demasiadas listas de espera este mes. " +
            "Si fue un error, escribinos desde la pantalla de contacto.",
          "USER_DISABLED"
        );
      }

      throw conflict(`Este mes ya te anotaste ${WAITLIST_LIMITS.maxPerMonth} veces en listas de espera, que es el máximo`);
    }

    const mine = await this.activeOf(patient.email);

    if (mine.some((item) => item.professional.email === professional.email))
      throw conflict("Ya estás en la lista de espera de este profesional");

    if (mine.length >= WAITLIST_LIMITS.maxActive)
      throw conflict(
        `Ya estás en ${WAITLIST_LIMITS.maxActive} listas de espera, que es el máximo a la vez. Salí de una para anotarte en esta`
      );

    if ((await this.waitingFor(professional.email)) >= WAITLIST_LIMITS.maxPerProfessional)
      throw conflict("La lista de espera de este profesional está completa. Probá de nuevo en unos días");

    // Una vencida con este mismo profesional sigue en la tabla hasta la limpieza de la
    // noche, y la clave única no dejaría crear la nueva.
    await em.nativeDelete(WaitlistEntry, {
      patient: { email: patient.email },
      professional: { email: professional.email },
      expiresAt: { $lte: now },
    });

    const entry = em.create(WaitlistEntry, {
      patient,
      professional,
      days: request.days.join(","),
      fromHour: request.fromHour,
      toHour: request.toHour,
      createdAt: now,
      expiresAt: addDays(now, WAITLIST_LIMITS.lifetimeDays),
      noticesSent: 0,
      notices: [],
    });

    if (!usage) usage = em.create(WaitlistUsage, { person: patient, month, created: 0 });
    usage.created += 1;

    await em.flush();
    return viewOf(entry);
  }

  /** Salir de una lista. No devuelve el lugar del mes: el tope es de anotarse. */
  async unsubscribe(patientEmail: string, professionalEmail: string): Promise<void> {
    const removed = await em.nativeDelete(WaitlistEntry, {
      patient: { email: patientEmail },
      professional: { email: professionalEmail },
    });

    if (removed === 0) throw notFound("No estabas en esa lista de espera");
  }

  /** Quiénes esperan a este profesional, del que se anotó primero al último. */
  async forProfessional(professionalEmail: string): Promise<WaitingPatient[]> {
    const entries = await em.find(
      WaitlistEntry,
      { professional: { email: professionalEmail }, expiresAt: { $gt: new Date() } },
      { populate: ["patient"], orderBy: { createdAt: "ASC" } }
    );

    return entries.map((entry) => ({
      id: entry.id!,
      patient: { ...who(entry.patient as Person), phoneNumber: entry.patient.phoneNumber ?? null },
      days: parseDays(entry.days),
      fromHour: entry.fromHour,
      toHour: entry.toHour,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      noticesSent: entry.noticesSent,
    }));
  }

  /**
   * El profesional saca a alguien de su lista.
   *
   * Sin aviso a la persona, a propósito: no es una novedad sobre un turno sino una decisión
   * de la agenda de otro, y contársela no le da nada que hacer.
   */
  async removeByProfessional(professionalEmail: string, id: number): Promise<void> {
    const removed = await em.nativeDelete(WaitlistEntry, { id, professional: { email: professionalEmail } });
    if (removed === 0) throw notFound("Esa persona ya no estaba en tu lista de espera");
  }

  /**
   * Cuánta gente recibiría el aviso si este turno se diera de baja ahora.
   *
   * Lo pregunta la pantalla del profesional antes de cancelar, para dejarle elegir si les
   * avisa. En cero no se pregunta nada y la baja es la de siempre.
   */
  async matchesFor(numAppointment: number, professionalEmail: string): Promise<{ count: number }> {
    const appointment = await em.findOne(
      Appointment,
      { numAppointment, professional: { email: professionalEmail } },
      { populate: ["professional", "patient"] }
    );

    if (!appointment) throw notFound("Ese turno no existe o no es tuyo");
    if (!LIVE_STATES.includes(appointment.state)) return { count: 0 };
    if (!(await this.offerable(appointment))) return { count: 0 };

    return { count: (await this.matching(appointment)).length };
  }

  /**
   * Se liberó un horario: les avisa a todos los que lo esperaban.
   *
   * A todos a la vez y sin reservarle a nadie: el primero que lo pide se lo queda, y los
   * demás se encuentran con que ya no está, igual que con cualquier horario.
   *
   * Si lo bajó el profesional, avisa solo si él lo pidió. Puede estar cancelando porque ese
   * día no va a estar, y ahí ofrecer el horario sería mandar gente a una puerta cerrada.
   *
   * No falla nunca hacia afuera: corre al lado de una cancelación que ya está hecha, y un
   * aviso que no salió no puede hacer creer a nadie que el turno sigue en pie.
   */
  async onSlotFreed(appointment: Appointment, by: "patient" | "professional", notify = false): Promise<number> {
    try {
      if (by === "professional" && !notify) return 0;
      if (!(await this.offerable(appointment))) return 0;

      const matches = await this.matching(appointment);
      for (const entry of matches) await this.notifyOne(entry, appointment);

      await em.flush();
      return matches.length;
    } catch (error) {
      console.error("No se pudo avisar a la lista de espera:", error);
      return 0;
    }
  }

  /**
   * Sacó turno con el profesional que esperaba: sale de su lista, y se le cuenta por qué.
   *
   * Con cualquier turno de ese profesional, caiga o no en la franja que había pedido. La
   * lista es para conseguir turno con alguien y ya lo consiguió: seguir avisándole sería
   * ruido, y encima le ocuparía el lugar a otro. Si igual quiere esperar otro horario, se
   * vuelve a anotar, y el mail se lo dice.
   *
   * Solo la reserva que hace el propio paciente. Un turno que le carga el profesional no
   * lo saca: puede ser un control que no tiene nada que ver con el horario que espera.
   *
   * No falla nunca hacia afuera: corre después de una reserva que ya está hecha.
   */
  async onBooked(patientEmail: string, appointment: BookedAppointment) {
    try {
      const entry = await em.findOne(WaitlistEntry, {
        patient: { email: patientEmail },
        professional: { email: appointment.professional.email },
      });

      if (!entry) return;

      // Una vencida que seguía en la tabla se borra callada: para la persona ya no existía.
      const active = entry.expiresAt > new Date();

      em.remove(entry);
      await em.flush();

      if (active) await this.notifyLeftByBooking(patientEmail, entry, appointment);
    } catch (error) {
      console.error("No se pudo sacar de la lista de espera a quien consiguió turno:", error);
    }
  }

  /**
   * El admin le apagó la lista a un profesional: se vacía, y se les cuenta a los que
   * estaban. Enterarse por no recibir nunca más un aviso sería peor.
   */
  async closeForProfessional(professionalEmail: string): Promise<number> {
    const entries = await em.find(
      WaitlistEntry,
      { professional: { email: professionalEmail }, expiresAt: { $gt: new Date() } },
      { populate: ["patient", "professional"] }
    );

    if (entries.length > 0) {
      const professional = entries[0].professional;

      await this.notifications.notifyMany(
        entries.map((entry) => entry.patient.email),
        {
          eventKey: `espera-cerrada:${professionalEmail}:${Date.now()}`,
          title: "Se cerró una lista de espera",
          body: `${professional.name} ${professional.surname} dejó de trabajar con lista de espera, así que ya no te vamos a avisar de sus horarios.`,
          tone: "info",
          target: "booking",
        }
      );
    }

    await em.nativeDelete(WaitlistEntry, { professional: { email: professionalEmail } });
    return entries.length;
  }

  /** Borra las que ya vencieron. Leerlas ya las ignoraba; esto es para que la tabla no crezca. */
  async cleanupExpired(now = new Date()): Promise<number> {
    return em.nativeDelete(WaitlistEntry, { expiresAt: { $lte: now } });
  }

  /**
   * La foto de la noche: cuánta gente espera a cada profesional.
   *
   * Entran todos los profesionales activos, también los que no tienen a nadie, porque un
   * día con cero es un dato: sin él, el promedio del mes solo contaría los días con gente.
   */
  async snapshot(now = new Date()): Promise<number> {
    const professionals = await em.find(Person, { type: "professional", active: true });
    const entries = await em.find(WaitlistEntry, { expiresAt: { $gt: now } }, { populate: ["professional"] });

    const waiting = new Map<string, number>();
    for (const entry of entries) waiting.set(entry.professional.email, (waiting.get(entry.professional.email) ?? 0) + 1);

    const month = monthKey(now);
    const today = toISODate(now);

    for (const professional of professionals) {
      let stat = await em.findOne(WaitlistStat, { professional: { email: professional.email }, month });
      if (!stat) stat = em.create(WaitlistStat, { professional, month, days: 0, total: 0, lastDay: null });
      if (stat.lastDay === today) continue;

      stat.days += 1;
      stat.total += waiting.get(professional.email) ?? 0;
      stat.lastDay = today;
    }

    await em.flush();
    return professionals.length;
  }

  /** Para los números: cuántos esperan hoy y el promedio de cada mes que se midió. */
  async statsFor(professionalEmail: string): Promise<{ enabled: boolean; current: number; averages: Map<string, number> }> {
    const professional = await em.findOne(Person, { email: professionalEmail });
    const current = await this.waitingFor(professionalEmail);
    const rows = await em.find(WaitlistStat, { professional: { email: professionalEmail } });

    const averages = new Map<string, number>();
    for (const row of rows) if (row.days > 0) averages.set(row.month, Math.round((row.total / row.days) * 10) / 10);

    return { enabled: professional?.waitlistEnabled !== false, current, averages };
  }

  /* ------------------------------------------------------------------ */

  /** Si el horario de este turno se le puede ofrecer a otro. Ver el comentario de la clase. */
  private async offerable(appointment: Appointment, now = new Date()): Promise<boolean> {
    if (appointment.overbooked) return false;
    if (!freedInTime(appointment, now)) return false;

    const professional = appointment.professional as Person;
    if (!professional?.active || professional.bookable === false || professional.waitlistEnabled === false) return false;

    // Se puede pedir turno esta semana y la que viene. Más allá, el aviso mandaría a una
    // agenda que todavía no muestra ese día.
    const day = startOfDay(appointment.date);
    if (day > addDays(startOfWeek(now), 13)) return false;

    const iso = toISODate(day);
    const start = hhmm(appointment.initialHour);
    const end = hhmm(appointment.finalHour);

    const vacations = await em.find(Vacation, { professional: { email: professional.email } });
    if (vacations.some((vacation) => toISODate(startOfDay(vacation.fromDate)) <= iso && iso <= toISODate(startOfDay(vacation.toDate))))
      return false;

    // Que siga cayendo en un módulo suyo. El turno se dio adentro de uno, pero el módulo
    // pudo haberse borrado después, y sin módulo el horario no se puede volver a pedir.
    const modules = await em.find(Schedule, { person: { email: professional.email }, day: SCHEDULE_DAYS[day.getDay()] });
    if (!modules.some((module) => hhmm(module.initialHour) <= start && end <= hhmm(module.finalHour))) return false;

    // `day` y no la fecha del turno: vuelve de la base como medianoche UTC, y consultada así
    // la base busca en el día anterior y nunca encuentra lo que se cruza.
    const taken = await em.findOne(Appointment, {
      professional: { email: professional.email },
      date: day,
      initialHour: { $lt: end },
      finalHour: { $gt: start },
      state: { $in: LIVE_STATES },
      numAppointment: { $ne: appointment.numAppointment },
    });

    return !taken;
  }

  /** Los que esperan justo este horario y todavía lo pueden tomar. */
  private async matching(appointment: Appointment): Promise<WaitlistEntry[]> {
    const entries = await em.find(
      WaitlistEntry,
      { professional: { email: appointment.professional.email }, expiresAt: { $gt: new Date() } },
      { populate: ["patient"], orderBy: { createdAt: "ASC" } }
    );

    const start = hhmm(appointment.initialHour);
    const end = hhmm(appointment.finalHour);
    const day = startOfDay(appointment.date);
    const result: WaitlistEntry[] = [];

    for (const entry of entries) {
      if (!entry.patient.active) continue;
      // El que acaba de darlo de baja no lo está esperando.
      if (appointment.patient && entry.patient.email === appointment.patient.email) continue;
      if (!fits(entry, appointment)) continue;

      // Si a esa hora ya tiene otro turno, avisarle es mandarle algo que no puede tomar.
      const busy = await em.findOne(Appointment, {
        patient: { email: entry.patient.email },
        date: day,
        initialHour: { $lt: end },
        finalHour: { $gt: start },
        state: { $in: LIVE_STATES },
      });

      if (!busy) result.push(entry);
    }

    return result;
  }

  private async notifyOne(entry: WaitlistEntry, appointment: Appointment): Promise<void> {
    const professional = appointment.professional as Person;
    const name = `${professional.name} ${professional.surname}`.trim();
    const start = hhmm(appointment.initialHour);
    const end = hhmm(appointment.finalHour);
    const when = `${longDate(appointment.date)} a las ${start}`;
    const last = entry.noticesSent + 1 >= WAITLIST_LIMITS.maxNotices;

    await this.notifications.notify(entry.patient.email, {
      eventKey: `espera:${entry.id}:t${appointment.numAppointment}`,
      title: "Se liberó un horario",
      body: `Con ${name}, ${when}. Se lo queda el primero que lo reserva.`,
      tone: "good",
      target: "booking",
    });

    const url = `${process.env.BASE_URL ?? ""}/Appointment?profesional=${encodeURIComponent(professional.email)}`;

    const html = [
      title("Se liberó un horario"),
      paragraph(`Estás en la lista de espera de <strong>${escapeHtml(name)}</strong> y se liberó un turno que te sirve.`),
      factsCard("El horario", [
        { label: "Fecha", value: longDate(appointment.date) },
        { label: "Hora", value: `${start} a ${end}` },
        { label: "Profesional", value: name },
      ]),
      paragraph("Les avisamos a todas las personas que esperan este horario, así que se lo queda el primero que lo reserva."),
      button("Reservarlo", url),
      note(
        last
          ? `Con este aviso ya te mandamos los ${WAITLIST_LIMITS.maxNotices} que corresponden, así que saliste de la lista de espera. Si todavía buscás turno, podés volver a anotarte.`
          : `Seguís en la lista hasta el ${longDate(entry.expiresAt)}, o hasta recibir ${WAITLIST_LIMITS.maxNotices} avisos.`
      ),
    ].join("");

    const message = await this.mail.createMessage(entry.patient.email, "Se liberó un horario", html);
    await this.mail.sendMail(message);

    entry.noticesSent += 1;
    entry.notices = [
      ...(entry.notices ?? []),
      { date: toISODate(startOfDay(appointment.date)), initialHour: start, at: new Date().toISOString() },
    ];

    if (entry.noticesSent >= WAITLIST_LIMITS.maxNotices) em.remove(entry);
  }

  /** El aviso de que salió de la lista porque sacó turno. Ver `onBooked`. */
  private async notifyLeftByBooking(patientEmail: string, entry: WaitlistEntry, appointment: BookedAppointment): Promise<void> {
    const professional = appointment.professional;
    const name = `${professional.name ?? ""} ${professional.surname ?? ""}`.trim() || "el profesional";
    const start = hhmm(appointment.initialHour);
    // Un pedido que el profesional todavía no confirmó no es un turno hecho, y el mail no
    // puede decir que lo es.
    const pending = appointment.state === "pending";

    await this.notifications.notify(patientEmail, {
      eventKey: `espera-fuera:${entry.id}`,
      title: "Saliste de una lista de espera",
      body: `Como ${pending ? "pediste" : "sacaste"} turno con ${name}, ya no te vamos a avisar de sus horarios libres.`,
      tone: "info",
      target: "booking",
    });

    const html = [
      title("Saliste de la lista de espera"),
      paragraph(
        `${pending ? "Pediste" : "Sacaste"} un turno con <strong>${escapeHtml(name)}</strong>, así que te sacamos de su lista de espera. ` +
          "Ya no te vamos a mandar avisos de sus horarios libres."
      ),
      factsCard(pending ? "Tu pedido" : "Tu turno", [
        { label: "Fecha", value: longDate(appointment.date) },
        { label: "Hora", value: `${start} a ${hhmm(appointment.finalHour)}` },
        { label: "Profesional", value: name },
      ]),
      note(
        pending
          ? "Si el profesional no confirma el pedido o preferís esperar otro horario, podés volver a anotarte desde sus horarios."
          : "Si preferís esperar otro horario, podés volver a anotarte desde sus horarios."
      ),
    ].join("");

    const message = await this.mail.createMessage(patientEmail, "Saliste de la lista de espera", html);
    await this.mail.sendMail(message);
  }
}

/** Lo que `onBooked` necesita del turno recién sacado. */
type BookedAppointment = {
  date: Date | string;
  initialHour: string;
  finalHour: string;
  state?: string;
  professional: { email: string; name?: string; surname?: string };
};
