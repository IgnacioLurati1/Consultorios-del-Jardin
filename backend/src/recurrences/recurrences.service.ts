import type { FilterQuery } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { Recurrence, type RecurrenceFrequency } from "./recurrences.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { AppointmentService, ACTIVE_APPOINTMENT_STATES } from "../appointments/appointments.service.js";
import { RoomService } from "../rooms/rooms.service.js";
import { PeopleService } from "../people/people.service.js";
import { badRequest, conflict, notFound } from "../shared/errors.js";
import { addDays, startOfDay } from "../shared/dates.js";

const em = orm.em;

/**
 * Hasta dónde adelante se dejan creados los turnos de una repetición.
 *
 * Son cuatro semanas a propósito: el paciente solo puede sacar turno dentro de los
 * próximos catorce días, así que cualquier franja que él llegue a ver ya está ocupada
 * por el turno repetido. No hace falta ningún chequeo extra en el pedido de turno.
 */
const HORIZON_DAYS = 28;

const FREQUENCIES: RecurrenceFrequency[] = ["weekly", "biweekly"];

/** Cada cuántos días cae el siguiente turno. */
const stepOf = (frequency: RecurrenceFrequency): number => (frequency === "weekly" ? 7 : 14);

export function describeFrequency(frequency: RecurrenceFrequency): string {
  return frequency === "weekly" ? "todas las semanas" : "cada dos semanas";
}

/**
 * Interpreta la fecha de corte que llega de afuera.
 *
 * Vacío, null o cadena vacía significan "sin fecha de corte": es la opción por defecto
 * y la que hay que poder elegir sin escribir nada. Una fecha anterior al primer turno
 * no es una repetición corta, es un error de carga.
 */
function parseEndDate(value: Date | string | null | undefined, startDate: Date): Date | null {
  if (value === undefined || value === null || value === "") return null;

  const parsed = startOfDay(value);
  if (Number.isNaN(parsed.getTime())) throw badRequest("La fecha de fin no es válida");
  if (parsed < startDate) throw badRequest("La fecha de fin tiene que ser posterior al primer turno");

  return parsed;
}

export class RecurrenceService {
  private appointmentService = new AppointmentService();
  private roomService = new RoomService();
  private peopleService = new PeopleService();

  /**
   * Marca un turno existente como repetible y deja creados los que entran en el horizonte.
   * El turno original queda igual: solo se le anota de qué repetición forma parte.
   */
  async createFromAppointment(
    numAppointment: number,
    professionalEmail: string,
    frequency: RecurrenceFrequency,
    /** Hasta cuándo repetir. Sin esto la repetición no tiene fecha de corte. */
    endDate?: Date | string | null
  ) {
    if (!FREQUENCIES.includes(frequency)) throw badRequest("La repetición tiene que ser semanal o quincenal");

    const appointment = await em.findOne(
      Appointment,
      {
        numAppointment,
        state: { $in: ACTIVE_APPOINTMENT_STATES },
        professional: { email: professionalEmail },
      },
      { populate: ["room", "patient", "professional", "recurrence"] }
    );

    if (!appointment) throw notFound("Ese turno no existe, ya fue cancelado o no es tuyo");

    // Frenar una repetición no le borra el puntero al turno: la configuración queda como
    // registro de lo que pasó y los turnos que generó siguen apuntándole. Así que lo que
    // impide volver a repetir no es que haya una, sino que esa siga andando. Sin este
    // matiz, un turno que se repitió una vez no se podía volver a repetir nunca.
    if (appointment.recurrence?.active) throw conflict("Ese turno ya se está repitiendo");

    const recurrence = em.create(Recurrence, {
      professional: appointment.professional,
      patient: appointment.patient ?? null,
      room: appointment.room,
      initialHour: appointment.initialHour,
      finalHour: appointment.finalHour,
      value: appointment.value,
      frequency,
      overbooked: appointment.overbooked,
      startDate: startOfDay(appointment.date),
      lastGeneratedDate: startOfDay(appointment.date),
      endDate: parseEndDate(endDate, startOfDay(appointment.date)),
      active: true,
      stoppedAt: null,
    });

    appointment.recurrence = recurrence;
    await em.flush();

    const { created, skipped } = await this.generate(recurrence);
    return { recurrence, created, skipped };
  }

  /**
   * Crea los turnos que faltan hasta el horizonte. Se puede llamar todos los días: solo
   * agrega lo que todavía no existe.
   *
   * Si una fecha ya está ocupada (el profesional puso otra cosa ahí, o el paciente sacó
   * turno con otro), se saltea esa vuelta y se sigue: la repetición no pisa nada.
   */
  async generate(recurrence: Recurrence): Promise<{ created: number; skipped: number }> {
    if (!recurrence.active) return { created: 0, skipped: 0 };

    const step = stepOf(recurrence.frequency);
    const today = startOfDay(new Date());
    const start = startOfDay(recurrence.startDate);

    // El horizonte se cuenta desde el turno que la originó mientras ese turno esté en el
    // futuro, y desde hoy una vez que pasó. Así una repetición que arranca dentro de tres
    // semanas igual nace con sus cuatro turnos, y después se va corriendo sola.
    const horizon = addDays(start > today ? start : today, HORIZON_DAYS);
    // La fecha de corte manda sobre el horizonte: nunca se genera más allá de ella.
    const end = recurrence.endDate ? startOfDay(recurrence.endDate) : null;
    const target = end && end < horizon ? end : horizon;

    let cursor = startOfDay(recurrence.lastGeneratedDate);
    let created = 0;
    let skipped = 0;

    // El tope es por las dudas: si algo dejara el cursor muy atrás, el for no se cuelga.
    for (let guard = 0; guard < 60; guard++) {
      const next = addDays(cursor, step);
      if (next > target) break;

      cursor = next;
      recurrence.lastGeneratedDate = next;

      if (next < today) continue; // una repetición vieja se pone al día sin crear pasado

      if (await this.slotIsTaken(recurrence, next)) {
        skipped++;
        continue;
      }

      em.create(Appointment, {
        date: next,
        initialHour: recurrence.initialHour,
        finalHour: recurrence.finalHour,
        professional: recurrence.professional,
        patient: recurrence.patient ?? null,
        room: recurrence.room,
        value: recurrence.value,
        // Nace confirmado, igual que cualquier turno que carga el profesional.
        state: "accepted",
        observations: null,
        reminderSent: "not sent",
        overbooked: recurrence.overbooked,
        origin: "professional",
        recurrence,
      });

      created++;
    }

    // Si ya no queda nada por crear antes del corte, la repetición se apaga sola: así el
    // job de todos los días deja de mirarla y en la pantalla figura como terminada.
    if (end && addDays(cursor, step) > end) {
      recurrence.active = false;
      recurrence.stoppedAt = new Date();
    }

    await em.flush();
    return { created, skipped };
  }

  /** ¿Hay algo del profesional (o del paciente) pisando esa franja ese día? */
  private async slotIsTaken(recurrence: Recurrence, date: Date): Promise<boolean> {
    const professionalBusy = await this.appointmentService.checkProfessionalAppointmentOverlap(
      recurrence.initialHour,
      recurrence.finalHour,
      recurrence.professional.email,
      date
    );

    if (professionalBusy) return true;
    if (!recurrence.patient) return false;

    const patientBusy = await this.appointmentService.checkPatientAppointmentOverlap(
      recurrence.initialHour,
      recurrence.finalHour,
      recurrence.patient.email,
      date
    );

    return !!patientBusy;
  }

  /** Pone al día todas las repeticiones activas. Lo usa el job de cada día. */
  async generatePending(): Promise<{ recurrences: number; created: number }> {
    const recurrences = await em.find(Recurrence, { active: true }, { populate: ["professional", "patient", "room"] });

    let created = 0;
    for (const recurrence of recurrences) {
      try {
        const result = await this.generate(recurrence);
        created += result.created;
      } catch (error) {
        console.error(`[recurrencias] no se pudo generar la repetición ${recurrence.idRecurrence}:`, error);
      }
    }

    return { recurrences: recurrences.length, created };
  }

  /** Las repeticiones activas del profesional, con los próximos turnos que ya generó. */
  async findForProfessional(professionalEmail: string) {
    const recurrences = await em.find(
      Recurrence,
      { professional: { email: professionalEmail }, active: true },
      { populate: ["patient", "room"], orderBy: { initialHour: "ASC" } }
    );

    const today = startOfDay(new Date());

    return Promise.all(
      recurrences.map(async (recurrence) => {
        const where: FilterQuery<Appointment> = {
          recurrence: { idRecurrence: recurrence.idRecurrence },
          state: { $in: ACTIVE_APPOINTMENT_STATES },
          date: { $gte: today },
        };

        const upcoming = await em.find(Appointment, where, { orderBy: { date: "ASC" }, limit: 6 });

        return {
          idRecurrence: recurrence.idRecurrence,
          frequency: recurrence.frequency,
          initialHour: recurrence.initialHour,
          finalHour: recurrence.finalHour,
          value: recurrence.value,
          overbooked: recurrence.overbooked,
          startDate: recurrence.startDate,
          endDate: recurrence.endDate ?? null,
          patient: recurrence.patient
            ? { email: recurrence.patient.email, name: recurrence.patient.name, surname: recurrence.patient.surname }
            : null,
          room: { idRoom: recurrence.room.idRoom, description: recurrence.room.description },
          upcoming: upcoming.map((appointment) => ({
            numAppointment: appointment.numAppointment,
            date: appointment.date,
          })),
        };
      })
    );
  }

  private async findOwn(idRecurrence: number, professionalEmail: string): Promise<Recurrence> {
    const recurrence = await em.findOne(
      Recurrence,
      { idRecurrence, professional: { email: professionalEmail } },
      { populate: ["professional", "patient", "room"] }
    );

    if (!recurrence) throw notFound("Esa repetición no existe o no es tuya");
    return recurrence;
  }

  /**
   * Cambia la configuración. Solo afecta a los turnos que falta generar: los que ya
   * están creados quedan tal cual, y se editan o cancelan uno por uno como cualquier otro.
   */
  async update(
    idRecurrence: number,
    professionalEmail: string,
    data: {
      frequency?: RecurrenceFrequency;
      value?: number;
      idRoom?: number;
      patientEmail?: string | null;
      endDate?: Date | string | null;
    }
  ) {
    const recurrence = await this.findOwn(idRecurrence, professionalEmail);

    // Una repetición que se apagó sola al llegar a su fecha de corte se puede reabrir
    // corriendo esa fecha: es lo que va a querer hacer quien puso "hasta fin de agosto"
    // y en agosto decide seguir. La que se frenó a mano no vuelve por acá.
    const finished = !recurrence.active && !!recurrence.endDate;
    if (!recurrence.active && !finished) throw badRequest("Esa repetición está frenada: no queda nada por generar");

    if (data.frequency !== undefined) {
      if (!FREQUENCIES.includes(data.frequency)) throw badRequest("La repetición tiene que ser semanal o quincenal");
      recurrence.frequency = data.frequency;
    }

    if (data.value !== undefined) {
      if (data.value < 0) throw badRequest("El valor del turno no puede ser negativo");
      recurrence.value = data.value;
    }

    if (data.idRoom !== undefined) {
      const room = await this.roomService.findRoomById(data.idRoom);
      if (!room.active) throw badRequest("El consultorio que elegiste está dado de baja");
      recurrence.room = room;
    }

    if (data.patientEmail !== undefined) {
      recurrence.patient = data.patientEmail ? await this.peopleService.findPersonByEmail(data.patientEmail) : null;
    }

    if (data.endDate !== undefined) {
      // Adelantar el corte no borra turnos ya creados: la repetición deja de generar de
      // acá en adelante, y lo que sobre se cancela a mano como cualquier otro turno.
      recurrence.endDate = parseEndDate(data.endDate, startOfDay(recurrence.startDate));

      const today = startOfDay(new Date());
      const stillRuns = !recurrence.endDate || recurrence.endDate >= today;

      if (finished && stillRuns) {
        recurrence.active = true;
        recurrence.stoppedAt = null;
      }
    }

    await em.flush();

    // Correr el corte para adelante tiene que volver a llenar el horizonte en el momento,
    // sin esperar a que pase el job de la madrugada.
    if (recurrence.active && (data.endDate !== undefined || data.frequency !== undefined)) await this.generate(recurrence);

    return recurrence;
  }

  /**
   * Frena la generación. Los turnos ya creados siguen en pie: si el profesional no los
   * quiere, los cancela desde la lista de turnos como a cualquier otro.
   */
  async stop(idRecurrence: number, professionalEmail: string) {
    const recurrence = await this.findOwn(idRecurrence, professionalEmail);

    if (!recurrence.active) throw badRequest("Esa repetición ya estaba frenada");

    recurrence.active = false;
    recurrence.stoppedAt = new Date();
    await em.flush();

    return recurrence;
  }
}
