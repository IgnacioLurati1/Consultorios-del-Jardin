import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Person } from "../people/people.entity.js";
import { SensitiveHit } from "./sensitiveHit.entity.js";
import { classify, type WatchedAction } from "./sensitiveEndpoints.js";
import { startOfDay } from "../shared/dates.js";
import MailService from "../config/mailer.js";
import { escapeHtml, factsCard, note, paragraph, title, warning } from "../config/mailTemplate.js";

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

/**
 * Cuántos puntos de actividad delicada son demasiados, y en qué ventana.
 *
 * Todo lo que sigue está calibrado alrededor de una sola idea: esto no se puede disparar
 * usando la aplicación. Un falso positivo deja a alguien afuera de su cuenta hasta que
 * otra persona lo revise, así que el listón está donde ninguna persona llega y un script
 * pasa sin despeinarse. Tres cosas lo sostienen:
 *
 * 1. Se cuentan **operaciones distintas**, no requests. Entrar tres veces a la misma
 *    pantalla es una sola operación repetida, y así navegar no suma. Esto además hace
 *    inofensivo que React monte los efectos dos veces en desarrollo y que el cliente
 *    reintente una request al renovar el token.
 * 2. Se cuentan solo las de la lista corta de sensitiveEndpoints.ts, que deja afuera todo
 *    lo que un administrador abre seguido.
 * 3. Lo que apunta a la propia persona no cuenta nunca.
 *
 * Con eso, los números quedan así:
 *
 * - Un administrador llega a 30 puntos tocando destructivamente **diez cuentas
 *   distintas** en un minuto: borrar, deshabilitar o editar a diez personas diferentes en
 *   sesenta segundos, a seis segundos cada una, no lo hace nadie pensando lo que hace.
 * - Un profesional llega a 40 puntos abriendo **cuarenta historias clínicas distintas**
 *   en un minuto. Su trabajo toca datos de pacientes todo el día, así que el umbral es
 *   ancho a propósito; cuarenta en un minuto ya no es leer, es copiar.
 * - Un paciente no toca ninguno de estos endpoints en ningún momento de su uso normal:
 *   se recorrió la aplicación entera con una cuenta de paciente y no registró un solo
 *   punto, porque los datos que pide son siempre los propios y esos no cuentan. Cinco
 *   puntos son cinco operaciones distintas: margen de sobra para una pantalla vieja que
 *   quedó abierta con la sesión de otro, y poco para dejar sondear.
 */
const INTRUSION_WINDOW_SECONDS = 60;

const BURST_POINTS: Record<string, number> = {
  admin: 30,
  professional: 40,
  client: 5,
};

/** Para un tipo de cuenta que no conocemos, el criterio más estricto. */
const BURST_FALLBACK = 5;

/**
 * Lo mismo, pero de madrugada, donde el listón baja.
 *
 * De cero a seis de la mañana el consultorio está cerrado: no hay nadie dando de baja
 * cuentas ni revisando fichas, y a esa hora la misma actividad significa otra cosa aunque
 * sea menos. Acá la ventana no es un minuto sino toda la madrugada acumulada.
 *
 * Los profesionales quedan afuera de esta regla a propósito: atienden y cargan sus cosas
 * a cualquier hora, y no es asunto del sistema opinar sobre eso.
 */
const NIGHT_FROM_HOUR = 0;
const NIGHT_TO_HOUR = 6;

const NIGHT_POINTS: Record<string, number> = {
  admin: 15,
  client: 6,
};

const NIGHT_FALLBACK = 6;

/** Lo que se decidió sobre una request vigilada. */
export interface AccessVerdict {
  locked: boolean;
  reason: string;
}

/** Una cuenta dada de baja por parecer intervenida, con lo que hizo antes de caer. */
export interface CompromisedAccount {
  email: string;
  name: string;
  surname: string;
  type: string;
  /** Falso salvo el caso del último administrador, que se marca pero no se cierra. */
  active: boolean;
  bannedAt: Date | null;
  reason: string | null;
  /** Lo que tocó en la hora previa a la baja, de lo más nuevo a lo más viejo. */
  trail: { at: Date; label: string; method: string; path: string; status: number | null }[];
}

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
  private mailService = new MailService();

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

  // ==========================================================================
  //  Cuentas que parecen estar en manos de otro
  // ==========================================================================

  /**
   * Anota un toque a un endpoint administrativo y decide si la cuenta sigue habilitada.
   *
   * Corre en el camino de cada request vigilada, así que primero anota y después mide:
   * si el proceso se cae en el medio, lo que ya pasó quedó escrito igual. La cuenta se
   * mide contra dos ventanas —el último minuto y la madrugada en curso— y le alcanza con
   * pasarse en una.
   *
   * Devuelve el veredicto para que quien llama pueda cortar esa misma request. Cortarla
   * no es imprescindible (deshabilitada la cuenta, la siguiente ya rebota sola) pero sí
   * correcto: la que hizo saltar la regla es tan parte del ataque como las anteriores.
   */
  async reviewSensitiveAccess(
    email: string,
    role: string,
    request: { method: string; path: string },
    action: WatchedAction
  ): Promise<{ hit: SensitiveHit; verdict: AccessVerdict | null }> {
    const fork = em.fork();
    const now = new Date();

    const hit = fork.create(SensitiveHit, {
      email,
      role,
      method: request.method,
      path: request.path,
      label: action.label,
      weight: action.weight,
      status: null,
      at: now,
    });

    await fork.persistAndFlush(hit);

    // Se traen los de hoy y se cuentan las dos ventanas en memoria: son pocos registros
    // (solo lo administrativo entra acá) y así se hace una consulta en vez de dos.
    const rows = await fork.find(SensitiveHit, { email, at: { $gte: startOfDay(now) } });

    // Se cuenta una vez por operación distinta. Repetir la misma es navegar, reintentar
    // o que React montara el efecto dos veces; ninguna de las tres es un ataque, y todas
    // pasan seguido. Lo que dibuja a alguien revolviendo el sistema es la variedad.
    const points = (from: Date) => {
      const distinct = new Map<string, number>();

      for (const row of rows) {
        if (row.at < from) continue;
        const key = `${row.method} ${row.path}`;
        if (!distinct.has(key)) distinct.set(key, row.weight);
      }

      return Array.from(distinct.values()).reduce((total, weight) => total + weight, 0);
    };

    const burstLimit = BURST_POINTS[role] ?? BURST_FALLBACK;
    const burst = points(new Date(now.getTime() - INTRUSION_WINDOW_SECONDS * 1000));

    if (burst >= burstLimit) {
      const reason =
        "Actividad sobre cuentas y datos ajenos a una velocidad que no es de una persona: " +
        burst +
        " puntos en operaciones distintas dentro de un minuto (el límite para " +
        describeRole(role) +
        " es " +
        burstLimit +
        ")";

      return { hit, verdict: await this.lockForCompromise(email, reason) };
    }

    // Los profesionales no tienen regla de madrugada: atienden a la hora que sea.
    const nightLimit = role === "professional" ? null : NIGHT_POINTS[role] ?? NIGHT_FALLBACK;
    const hour = now.getHours();

    if (nightLimit !== null && hour >= NIGHT_FROM_HOUR && hour < NIGHT_TO_HOUR) {
      const night = points(startOfDay(now));

      if (night >= nightLimit) {
        const reason =
          "Actividad sobre cuentas y datos ajenos de madrugada, con el consultorio cerrado: " +
          night +
          " puntos en operaciones distintas desde las 00:00 (el límite para " +
          describeRole(role) +
          " es " +
          nightLimit +
          ")";

        return { hit, verdict: await this.lockForCompromise(email, reason) };
      }
    }

    return { hit, verdict: null };
  }

  /** Completa con qué contestó el servidor. Sirve para revisar el caso, no para decidir. */
  async recordOutcome(id: number | undefined, status: number): Promise<void> {
    if (!id) return;

    const fork = em.fork();
    const row = await fork.findOne(SensitiveHit, { id });
    if (!row) return;

    row.status = status;
    await fork.flush();
  }

  /**
   * Da de baja una cuenta por parecer intervenida.
   *
   * No borra ni deshace nada de lo que hizo: corta el acceso y deja el rastro escrito.
   * Deshacer es una decisión con consecuencias que tiene que tomar una persona mirando
   * qué se tocó, y el sistema no está en condiciones de tomarla solo.
   *
   * Hay una excepción y es importante: si la cuenta es el último administrador activo,
   * no se la deshabilita. Un falso positivo ahí deja el sistema sin nadie que pueda
   * volver a habilitar a nadie —ni a sí misma, porque una cuenta caída no puede pedir
   * nada— y el remedio termina siendo peor que la enfermedad. En ese caso queda marcada
   * y gritando en el panel, pero sigue pudiendo entrar.
   */
  async lockForCompromise(email: string, reason: string): Promise<AccessVerdict> {
    const fork = em.fork();
    const person = await fork.findOne(Person, { email });

    if (!person) return { locked: false, reason };

    // Ya estaba dada de baja por esto mismo: no se pisa el motivo original, que es el que
    // cuenta lo que pasó primero, ni se manda el mail dos veces.
    if (!person.active && person.banKind === "compromise") {
      return { locked: true, reason: person.banReason ?? reason };
    }

    const lastAdminStanding = person.type === "admin" && (await fork.count(Person, { type: "admin", active: true })) <= 1;

    person.banKind = "compromise";
    person.banReason = reason;
    person.bannedAt = new Date();
    person.clearedBy = null;
    person.clearedAt = null;

    if (lastAdminStanding) {
      await fork.flush();

      console.error(
        "SEGURIDAD: " +
          email +
          " disparó la regla de intrusión (" +
          reason +
          "), pero es el único administrador activo y deshabilitarlo dejaría el sistema sin nadie " +
          "que pueda revertirlo. Queda marcado y habilitado."
      );

      void this.warnOwner(person, reason, false);
      return { locked: false, reason };
    }

    person.active = false;
    person.bannedBy = "system";
    await fork.flush();

    console.error("SEGURIDAD: cuenta deshabilitada por posible intrusión: " + email + " (" + reason + ")");

    void this.warnOwner(person, reason, true);
    return { locked: true, reason };
  }

  /**
   * Le avisa por mail a la persona dueña de la cuenta.
   *
   * Es la única vía que queda: la cuenta está cerrada, así que no hay forma de contarle
   * nada adentro de la aplicación. El mail no lleva ningún enlace para "recuperar" ni
   * "reactivar", a propósito: si la casilla también está comprometida, un botón así le
   * sirve a quien entró y no a quien tiene que enterarse. La única salida es hablar con
   * un administrador, que es una persona y puede verificar quién está del otro lado.
   *
   * Se manda sin esperar y sin romper nada si falla: la cuenta ya quedó cerrada, que es
   * lo que protege. Que el aviso no salga es malo, pero no cambia lo que hay que hacer.
   */
  private async warnOwner(person: Person, reason: string, locked: boolean): Promise<void> {
    try {
      const when = (person.bannedAt ?? new Date()).toLocaleString("es-AR", {
        dateStyle: "long",
        timeStyle: "short",
      });

      const html =
        title(locked ? "Cerramos tu cuenta por seguridad" : "Actividad rara en tu cuenta") +
        paragraph(
          "Hola " +
            escapeHtml(person.name) +
            ". Detectamos en tu cuenta una actividad que no se parece a la de una persona usando el sistema, " +
            "y puede significar que alguien más consiguió tu contraseña."
        ) +
        factsCard("Qué detectamos", [
          { label: "Cuándo", value: when },
          { label: "Qué pasó", value: reason },
          { label: "Tu cuenta", value: person.email },
        ]) +
        (locked
          ? warning(
              "Por precaución cerramos el acceso. <strong>No vas a poder entrar hasta que un administrador " +
                "revise el caso.</strong>"
            )
          : warning(
              "No cerramos el acceso porque sos la única cuenta de administración activa, pero la actividad quedó " +
                "registrada. <strong>Revisala cuanto antes.</strong>"
            )) +
        paragraph(
          "Si fuiste vos y sabés a qué corresponde, igual conviene revisarlo. Si no reconocés esta actividad, " +
            "cambiá la contraseña de tu correo antes que nada."
        ) +
        note(
          "Para volver a habilitar la cuenta tenés que hablar con un administrador del consultorio. " +
            "No te vamos a pedir nunca la contraseña por mail, ni por este ni por ninguno."
        );

      const message = await this.mailService.createMessage(
        person.email,
        locked ? "Cerramos tu cuenta por seguridad" : "Actividad rara en tu cuenta",
        html
      );

      await this.mailService.sendMail(message);
    } catch (error) {
      console.error("No se pudo avisarle a " + person.email + " del cierre de su cuenta:", error);
    }
  }

  /**
   * Las cuentas caídas por posible intrusión, con lo que hicieron antes de caer.
   *
   * El rastro es la parte que importa. Saber que una cuenta se cayó no le sirve a nadie
   * si no se puede ver qué llegó a tocar: es la diferencia entre "alguien entró" y
   * "alguien entró, se bajó el padrón y no borró nada".
   */
  async compromisedAccounts(): Promise<CompromisedAccount[]> {
    const people = await em.find(Person, { banKind: "compromise" }, { orderBy: { bannedAt: "DESC" } });
    if (people.length === 0) return [];

    const rows = await em.find(
      SensitiveHit,
      { email: { $in: people.map((person) => person.email) } },
      { orderBy: { at: "DESC" } }
    );

    return people.map((person) => {
      // La hora previa a la caída. Más atrás que eso ya es uso normal de la cuenta, y
      // mezclarlo con el ataque hace más difícil ver dónde empezó.
      const since = person.bannedAt ? new Date(person.bannedAt.getTime() - 60 * 60 * 1000) : null;

      return {
        email: person.email,
        name: person.name,
        surname: person.surname,
        type: person.type,
        active: person.active,
        bannedAt: person.bannedAt ?? null,
        reason: person.banReason ?? null,
        trail: rows
          .filter((row) => row.email === person.email && (!since || row.at >= since))
          .slice(0, 40)
          .map((row) => ({
            at: row.at,
            label: row.label,
            method: row.method,
            path: row.path,
            status: row.status ?? null,
          })),
      };
    });
  }

  /** Lo que se vigila y con qué números, para poder contarlo en pantalla. */
  intrusionRules() {
    return {
      burstSeconds: INTRUSION_WINDOW_SECONDS,
      burst: BURST_POINTS,
      burstFallback: BURST_FALLBACK,
      night: NIGHT_POINTS,
      nightFallback: NIGHT_FALLBACK,
      nightFrom: NIGHT_FROM_HOUR,
      nightTo: NIGHT_TO_HOUR,
    };
  }
}

/** Cómo se nombra un tipo de cuenta dentro de un motivo escrito para una persona. */
function describeRole(role: string): string {
  if (role === "admin") return "un administrador";
  if (role === "professional") return "un profesional";
  if (role === "client") return "un paciente";
  return "esa clase de cuenta";
}

export { classify };
