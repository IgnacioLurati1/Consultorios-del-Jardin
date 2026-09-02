import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Person } from "../people/people.entity.js";
import { startOfDay } from "../shared/dates.js";

const em = orm.em;

/**
 * Cuántos turnos seguidos son demasiados, y en cuánto tiempo.
 *
 * El primer límite mira el ritmo: seis turnos en un minuto no los saca alguien que está
 * eligiendo horario, los saca un script. El segundo mira el volumen del día, que atrapa
 * al que va más despacio para no llamar la atención pero igual llena la agenda.
 *
 * Los dos cuentan solo lo que sacó el paciente por su cuenta: los turnos que carga un
 * profesional a mano no son comportamiento del paciente y no tienen por qué contarle.
 */
const BURST_SECONDS = 60;
const BURST_LIMIT = 5;
const DAILY_LIMIT = 10;

/**
 * A partir de cuándo un paciente que falta seguido pasa a estar marcado.
 *
 * El mínimo de inasistencias existe porque sin él una sola falta sobre un solo turno da
 * 0% de asistencia, y eso no dice nada de nadie. Con tres ya hay una costumbre para
 * mirar, que es todo lo que la marca pretende: mirar.
 */
const SUSPICION_MIN_MISSED = 3;
const SUSPICION_RATE = 0.5;

export interface FlaggedPatient {
  email: string;
  name: string;
  surname: string;
  assisted: number;
  missed: number;
  /** Turnos cerrados: los que se sabe si la persona vino o no. */
  closed: number;
  /** Proporción de asistencia sobre los cerrados, de 0 a 1. */
  rate: number;
}

export interface BannedPatient {
  email: string;
  name: string;
  surname: string;
  bannedAt: Date | null;
  reason: string | null;
}

export interface BehaviourReport {
  /** Cuentas que el sistema deshabilitó solo. */
  banned: BannedPatient[];
  /** Cuentas sanas pero que faltan más de lo que vienen. */
  suspicious: FlaggedPatient[];
  /** Pacientes con al menos un turno cerrado: el universo sobre el que se mide. */
  measured: number;
  rules: {
    burstLimit: number;
    burstSeconds: number;
    dailyLimit: number;
    minMissed: number;
    ratePercent: number;
  };
}

export class SecurityService {
  /**
   * Mira cómo viene sacando turnos un paciente y, si se pasó, le deshabilita la cuenta y
   * le borra la tanda.
   *
   * Se llama después de crear el turno, con el turno nuevo ya contando: la pregunta es
   * si con este último se pasó, no si estaba por pasarse.
   *
   * Lo que se borra es exactamente lo que hizo saltar la regla —la ráfaga del minuto, o
   * los turnos del día— y nada de lo anterior. Es la parte más importante del control:
   * deshabilitar la cuenta sin sacar los turnos deja al profesional con la agenda llena
   * de horarios que nadie va a ocupar y con los pacientes reales sin poder sacar turno,
   * que es justo el daño que el bot venía a hacer.
   *
   * Devuelve qué pasó, o null si no pasó nada.
   */
  async reviewBookingRate(patientEmail: string): Promise<{ reason: string; deleted: number } | null> {
    const patient = await em.findOne(Person, { email: patientEmail });

    // Un profesional sacando turno para sí mismo, o alguien ya deshabilitado, no entran:
    // el control es sobre pacientes sacando turnos, y sobre cuentas que siguen en pie.
    if (!patient || patient.type !== "client" || !patient.active) return null;

    const now = new Date();
    const mine = { patient: { email: patientEmail }, origin: "patient" as const };
    const burstFrom = new Date(now.getTime() - BURST_SECONDS * 1000);
    const dayFrom = startOfDay(now);

    const [burst, today] = await Promise.all([
      em.count(Appointment, { ...mine, createdAt: { $gte: burstFrom } }),
      em.count(Appointment, { ...mine, createdAt: { $gte: dayFrom } }),
    ]);

    // El orden importa: si saltaron las dos, la ráfaga es la más específica y la que
    // describe mejor lo que pasó, pero lo que se borra sigue siendo el día entero.
    const triggered =
      burst > BURST_LIMIT
        ? { reason: `Sacó ${burst} turnos en menos de un minuto`, since: today >= DAILY_LIMIT ? dayFrom : burstFrom }
        : today >= DAILY_LIMIT
          ? { reason: `Sacó ${today} turnos en el mismo día`, since: dayFrom }
          : null;

    if (!triggered) return null;

    patient.active = false;
    patient.bannedBy = "system";
    patient.bannedAt = now;
    patient.banReason = triggered.reason;
    await em.flush();

    const deleted = await em.nativeDelete(Appointment, { ...mine, createdAt: { $gte: triggered.since } });

    console.warn(`Cuenta deshabilitada por el sistema: ${patientEmail} (${triggered.reason}), ${deleted} turnos borrados`);
    return { reason: triggered.reason, deleted };
  }

  /**
   * Quiénes vienen faltando y quiénes quedaron deshabilitados solos.
   *
   * Faltar seguido no tiene consecuencia automática y no se le muestra a nadie más que
   * al admin: la misma cifra la produce un paciente que reserva y no va, y un
   * profesional que no está cargando las asistencias. Sin saber cuál de las dos es, la
   * única lectura honesta es "esto merece una mirada".
   */
  async behaviourReport(): Promise<BehaviourReport> {
    const closed = await em.find(
      Appointment,
      { state: { $in: ["assisted", "missed"] }, patient: { $ne: null } },
      { populate: ["patient"], fields: ["state", "patient"] }
    );

    const tally = new Map<string, { person: Person; assisted: number; missed: number }>();

    for (const appointment of closed) {
      const patient = appointment.patient;
      if (!patient) continue;

      const entry = tally.get(patient.email) ?? { person: patient, assisted: 0, missed: 0 };
      if (appointment.state === "assisted") entry.assisted += 1;
      else entry.missed += 1;
      tally.set(patient.email, entry);
    }

    const suspicious: FlaggedPatient[] = [];

    for (const [email, { person, assisted, missed }] of tally) {
      const total = assisted + missed;
      const rate = assisted / total;

      if (missed < SUSPICION_MIN_MISSED || rate >= SUSPICION_RATE) continue;

      suspicious.push({
        email,
        name: person.name,
        surname: person.surname,
        assisted,
        missed,
        closed: total,
        rate,
      });
    }

    // Primero el que peor viene: es el orden en que alguien querría revisarlos.
    suspicious.sort((a, b) => a.rate - b.rate || b.missed - a.missed);

    const bannedRows = await em.find(Person, { bannedBy: "system" }, { orderBy: { bannedAt: "DESC" } });

    return {
      banned: bannedRows.map((person) => ({
        email: person.email,
        name: person.name,
        surname: person.surname,
        bannedAt: person.bannedAt ?? null,
        reason: person.banReason ?? null,
      })),
      suspicious,
      measured: tally.size,
      rules: {
        burstLimit: BURST_LIMIT,
        burstSeconds: BURST_SECONDS,
        dailyLimit: DAILY_LIMIT,
        minMissed: SUSPICION_MIN_MISSED,
        ratePercent: Math.round(SUSPICION_RATE * 100),
      },
    };
  }

  /** Solo los emails marcados. Lo usa el listado de usuarios, que ya tiene a la gente. */
  async suspiciousEmails(): Promise<FlaggedPatient[]> {
    return (await this.behaviourReport()).suspicious;
  }
}
