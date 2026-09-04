import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { Vacation } from "./vacation.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { DEBT_FILTER, pendingAmount } from "../appointments/appointments.service.js";
import { Recurrence } from "../recurrences/recurrences.entity.js";
import { badRequest, notFound } from "../shared/errors.js";
import { startOfDay, toISODate } from "../shared/dates.js";
import { professionalMailSettings, setMailPreference } from "../people/mailPreferences.js";

const em = orm.em;

export type AutoMark = "assisted" | "missed";
export type AutoMarkWhen = "appointment" | "day";
/** El cobro automatico se decide con el mismo criterio que el cierre. */
export type AutoPayWhen = AutoMarkWhen;
export type DeleteScope = "future" | "all";

export interface ProfessionalSettings {
  autoAccept: boolean;
  autoMark: AutoMark | null;
  autoMarkWhen: AutoMarkWhen;
  /** Dar por cobrado el turno que ya paso, sin marcarlo a mano. */
  autoPay: boolean;
  autoPayWhen: AutoPayWhen;
  /** Cuántos pedidos están esperando respuesta ahora mismo. */
  pending: number;
  /** Los avisos por mail que se pueden apagar, con el estado de cada uno. */
  mails: Array<{ key: string; label: string; description: string; enabled: boolean }>;
  vacations: Array<{ id: number; fromDate: string; toDate: string; reason: string | null; current: boolean }>;
}

/**
 * La configuración con la que un profesional decide cuánto trabajo administrativo hace
 * a mano.
 *
 * Todo lo de acá es del profesional sobre lo suyo: sus turnos, sus pacientes, su
 * agenda. Ninguna de estas operaciones mira ni toca lo de otro, y el email del dueño
 * sale del token, nunca del body.
 */
export class SettingsService {
  private async professional(email: string): Promise<Person> {
    const person = await em.findOne(Person, { email });

    if (!person) throw notFound("No encontramos tu usuario");
    if (person.type !== "professional") throw badRequest("Esta configuración es solo para profesionales");

    return person;
  }

  async forProfessional(email: string): Promise<ProfessionalSettings> {
    const person = await this.professional(email);

    const vacations = await em.find(Vacation, { professional: { email } }, { orderBy: { fromDate: "asc" } });
    const pending = await em.count(Appointment, { professional: { email }, state: "pending" });
    const today = startOfDay(new Date());

    return {
      autoAccept: person.autoAccept,
      autoMark: (person.autoMark as AutoMark) ?? null,
      autoMarkWhen: person.autoMarkWhen,
      autoPay: person.autoPay,
      autoPayWhen: person.autoPayWhen,
      pending,
      mails: professionalMailSettings(person),
      vacations: vacations.map((vacation) => ({
        id: vacation.id!,
        fromDate: toISODate(startOfDay(vacation.fromDate)),
        toDate: toISODate(startOfDay(vacation.toDate)),
        reason: vacation.reason ?? null,
        current: startOfDay(vacation.fromDate) <= today && today <= startOfDay(vacation.toDate),
      })),
    };
  }

  async update(
    email: string,
    data: {
      autoAccept?: boolean;
      autoMark?: AutoMark | null;
      autoMarkWhen?: AutoMarkWhen;
      autoPay?: boolean;
      autoPayWhen?: AutoPayWhen;
      mails?: Record<string, boolean>;
    }
  ): Promise<ProfessionalSettings> {
    const person = await this.professional(email);

    if (data.autoAccept !== undefined) person.autoAccept = !!data.autoAccept;

    if (data.autoMark !== undefined) {
      if (data.autoMark !== null && data.autoMark !== "assisted" && data.autoMark !== "missed")
        throw badRequest("El cierre automático solo puede dejar el turno como que vino o como que no vino");

      // La marca se sella al prender y se borra al apagar, así volver a prenderla más
      // adelante tampoco arrastra lo que pasó mientras estuvo apagada.
      if (data.autoMark && !person.autoMark) person.autoMarkSince = new Date();
      if (!data.autoMark) person.autoMarkSince = null;

      person.autoMark = data.autoMark;
    }

    if (data.autoMarkWhen !== undefined) {
      if (data.autoMarkWhen !== "appointment" && data.autoMarkWhen !== "day")
        throw badRequest("El cierre automático corre al terminar el turno o al terminar el día");

      person.autoMarkWhen = data.autoMarkWhen;
    }

    if (data.autoPay !== undefined) {
      // Igual que el cierre: se sella al prender y se borra al apagar, asi prenderlo de
      // nuevo mas adelante no da por cobrado lo que paso mientras estuvo apagado.
      if (data.autoPay && !person.autoPay) person.autoPaySince = new Date();
      if (!data.autoPay) person.autoPaySince = null;

      person.autoPay = data.autoPay;
    }

    if (data.autoPayWhen !== undefined) {
      if (data.autoPayWhen !== "appointment" && data.autoPayWhen !== "day")
        throw badRequest("El cobro automatico corre al terminar el turno o al terminar el dia");

      person.autoPayWhen = data.autoPayWhen;
    }

    // De a un aviso por vez, sin pisar los demás: la pantalla manda solo el switch que
    // se tocó, y una clave desconocida corta acá en vez de guardarse como basura.
    for (const [key, enabled] of Object.entries(data.mails ?? {})) setMailPreference(person, key, !!enabled);

    await em.flush();
    return this.forProfessional(email);
  }

  /**
   * Acepta de una todos los pedidos que quedaron esperando.
   *
   * Va aparte de prender la confirmación automática porque son dos decisiones: una vale
   * de acá en adelante y la otra se lleva puestos los pedidos que ya están en la lista.
   * Quien prende el automático puede querer revisar a mano los que venían de antes.
   */
  async acceptPending(email: string): Promise<number> {
    await this.professional(email);

    const pending = await em.find(Appointment, { professional: { email }, state: "pending" });

    for (const appointment of pending) appointment.state = "accepted";

    await em.flush();
    return pending.length;
  }

  /**
   * Da por cobrado todo lo que quedo sin saldar.
   *
   * Es el hermano de confirmar los pedidos de una: la misma idea, del otro lado del
   * mostrador. El profesional que cobra en efectivo y no anota turno por turno termina con
   * una lista larga de "sin cobrar" que no describe nada, y saldarla de a uno son cuarenta
   * clicks.
   *
   * Toca exactamente lo mismo que muestra la lista: turnos ya atendidos, con paciente, sin
   * cobrar o cobrados a medias. Los que no tienen paciente quedan afuera porque tampoco
   * cuentan como deuda en ningun lado, y saldar algo que no figura seria mover plata que
   * nadie estaba mirando.
   *
   * Al pago parcial se le borra el monto: "pagado" quiere decir que entro el valor entero,
   * y dejar los $3000 de un pago a medias en un turno marcado como saldado deja un dato que
   * despues hay que explicar en cada pantalla.
   */
  async settleUnpaid(email: string): Promise<{ settled: number; amount: number }> {
    await this.professional(email);

    const unpaid = await em.find(Appointment, { professional: { email }, patient: { $ne: null }, ...DEBT_FILTER });

    let amount = 0;

    for (const appointment of unpaid) {
      amount += pendingAmount(appointment);
      appointment.paymentState = "paid";
      appointment.paidAmount = null;
    }

    await em.flush();

    return { settled: unpaid.length, amount };
  }

  async addVacation(email: string, fromDate: string, toDate: string, reason?: string | null): Promise<Vacation> {
    const professional = await this.professional(email);

    if (!fromDate || !toDate) throw badRequest("Elegí desde y hasta qué día no vas a atender");

    const from = startOfDay(fromDate);
    const to = startOfDay(toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest("Las fechas no son válidas");
    if (to < from) throw badRequest("La fecha de vuelta tiene que ser posterior a la de salida");

    // Solapar dos licencias no rompe nada (el chequeo es "¿hay alguna que cubra este
    // día?"), pero deja dos renglones diciendo lo mismo y hace confuso borrar la correcta.
    const overlapping = await em.findOne(Vacation, {
      professional: { email },
      fromDate: { $lte: to },
      toDate: { $gte: from },
    });

    if (overlapping) throw badRequest("Ya tenés cargado un período que se pisa con esas fechas");

    const vacation = em.create(Vacation, {
      professional,
      fromDate: from,
      toDate: to,
      reason: reason?.trim() || null,
    });

    await em.flush();
    return vacation;
  }

  async removeVacation(email: string, id: number): Promise<void> {
    const vacation = await em.findOne(Vacation, { id, professional: { email } });

    if (!vacation) throw notFound("Ese período no existe o no es tuyo");

    await em.removeAndFlush(vacation);
  }

  /**
   * Los días que un profesional no atiende, como claves "2026-09-14".
   *
   * Devuelve un Set y no las filas porque quien pregunta lo hace adentro de un bucle por
   * día: la búsqueda de horarios libres recorre doce días hábiles y sería una consulta
   * por cada uno.
   */
  async vacationDays(email: string): Promise<Set<string>> {
    const vacations = await em.find(Vacation, { professional: { email } });
    const days = new Set<string>();

    for (const vacation of vacations) {
      const cursor = startOfDay(vacation.fromDate);
      const last = startOfDay(vacation.toDate);

      while (cursor <= last) {
        days.add(toISODate(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return days;
  }

  /** Emails de los que hoy están de licencia. Los saca de la búsqueda del paciente. */
  async onVacationToday(): Promise<string[]> {
    const today = startOfDay(new Date());

    const vacations = await em.find(
      Vacation,
      { fromDate: { $lte: today }, toDate: { $gte: today } },
      { populate: ["professional"] }
    );

    return vacations.map((vacation) => vacation.professional.email);
  }

  /**
   * Borra los turnos que un profesional tiene con un paciente suyo.
   *
   * Es definitivo: el turno se va de la base con sus observaciones. Por eso el alcance
   * viaja explícito desde la pantalla en vez de tener un valor por defecto acá.
   *
   * Frena de paso las repeticiones con ese paciente. Sin eso el trabajo se deshace solo:
   * la tarea que genera los turnos repetibles vuelve a crear los que se acaban de borrar.
   */
  async deletePatientAppointments(professionalEmail: string, patientEmail: string, scope: DeleteScope) {
    await this.professional(professionalEmail);

    if (scope !== "future" && scope !== "all") throw badRequest("No sabemos qué turnos hay que borrar");

    const patient = await em.findOne(Person, { email: patientEmail });
    if (!patient) throw notFound("Ese paciente no existe");

    const mine = { professional: { email: professionalEmail }, patient: { email: patientEmail } };
    const onlyFuture = scope === "future" ? { date: { $gte: startOfDay(new Date()) } } : {};

    const appointments = await em.find(Appointment, { ...mine, ...onlyFuture });

    const recurrences = await em.find(Recurrence, {
      professional: { email: professionalEmail },
      patient: { email: patientEmail },
      active: true,
    });

    for (const recurrence of recurrences) {
      recurrence.active = false;
      recurrence.stoppedAt = new Date();
    }

    await em.flush();

    if (appointments.length > 0) await em.nativeDelete(Appointment, { numAppointment: { $in: appointments.map((a) => a.numAppointment!) } });

    return { deleted: appointments.length, stoppedRecurrences: recurrences.length };
  }
}
