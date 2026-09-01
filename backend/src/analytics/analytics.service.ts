import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Person } from "../people/people.entity.js";
import { AssistantUsage } from "../assistant/assistant.entity.js";
import { toolLabels } from "../assistant/assistant.tools.js";
import { badRequest, notFound } from "../shared/errors.js";
import { addDays, addMonths, dayName, endOfMonth, monthKey, monthLabel, startOfDay, startOfMonth, toISODate } from "../shared/dates.js";

const em = orm.em;

/** Cuántos meses cerrados entran en los gráficos. */
const MONTHS_BACK = 12;

/**
 * Los turnos se traen crudos y se agrupan en memoria en vez de resolver cada métrica
 * con su propio SQL. Son doce meses de un solo consultorio: la diferencia de tiempo es
 * nula y así todas las métricas salen del mismo recorte de datos, que es lo que hace
 * que los números cierren entre sí.
 */
interface Row {
  date: Date;
  value: number;
  state: string;
  overbooked: boolean;
  origin: string | null;
  patientEmail: string | null;
  professionalEmail: string;
}

/** Cancelar escribe un ISO timestamp en `state`, así que un estado que no está acá es cancelado. */
const LIVE_STATES = ["pending", "accepted", "assisted", "missed"];
const isCancelled = (state: string) => !LIVE_STATES.includes(state);

/**
 * Métricas de un recorte de turnos. Todas salen de las mismas filas, así que "asistidos +
 * no vinieron + agendados" siempre suma lo mismo que el total sin cancelar.
 */
export interface Metrics {
  /** Turnos que no se cancelaron. */
  appointments: number;
  assisted: number;
  missed: number;
  cancelled: number;
  overbooked: number;
  /** Plata de los turnos ya marcados como asistidos. */
  billed: number;
  /** Plata de los turnos que siguen en pie pero todavía no se cerraron. */
  scheduled: number;
  /** Pacientes distintos con al menos un turno sin cancelar. */
  patients: number;
  /** Turnos que sacó el paciente desde la app. */
  fromApp: number;
  /** Turnos que cargó el profesional a mano. */
  fromProfessional: number;
  /** Turnos anteriores a la columna `origin`: no se pueden clasificar. */
  unknownOrigin: number;
}

function emptyMetrics(): Metrics {
  return {
    appointments: 0,
    assisted: 0,
    missed: 0,
    cancelled: 0,
    overbooked: 0,
    billed: 0,
    scheduled: 0,
    patients: 0,
    fromApp: 0,
    fromProfessional: 0,
    unknownOrigin: 0,
  };
}

function summarize(rows: Row[]): Metrics {
  const metrics = emptyMetrics();
  const patients = new Set<string>();

  for (const row of rows) {
    if (isCancelled(row.state)) {
      metrics.cancelled++;
      continue;
    }

    metrics.appointments++;
    if (row.patientEmail) patients.add(row.patientEmail);
    if (row.overbooked) metrics.overbooked++;

    if (row.origin === "patient") metrics.fromApp++;
    else if (row.origin === "professional") metrics.fromProfessional++;
    else metrics.unknownOrigin++;

    if (row.state === "assisted") {
      metrics.assisted++;
      metrics.billed += row.value ?? 0;
    } else if (row.state === "missed") {
      metrics.missed++;
    } else {
      metrics.scheduled += row.value ?? 0;
    }
  }

  metrics.patients = patients.size;
  return metrics;
}

/**
 * El mismo recorte, sin la plata.
 *
 * Lo que factura un profesional es suyo. El admin necesita ver su actividad —cuántos
 * turnos da, cuántos se le caen, cuántos sobreturnos— y para eso no hace falta el
 * dinero. El total del consultorio sí queda: ahí la plata es del consultorio y no de
 * nadie en particular.
 */
function withoutBilling<T extends Metrics>(metrics: T): Omit<T, "billed" | "scheduled"> {
  const { billed, scheduled, ...rest } = metrics;
  return rest;
}

/** Promedio de turnos por día y qué día de la semana carga más. Solo mira turnos vivos. */
function loadByDay(rows: Row[]): { averagePerDay: number; busiestDay: string | null; busiestDayAverage: number } {
  const perDate = new Map<string, number>();
  const perWeekday = new Map<string, { total: number; days: Set<string> }>();

  for (const row of rows) {
    if (isCancelled(row.state)) continue;

    const day = startOfDay(row.date);
    const key = day.toDateString();
    perDate.set(key, (perDate.get(key) ?? 0) + 1);

    const weekday = dayName(day);
    if (!perWeekday.has(weekday)) perWeekday.set(weekday, { total: 0, days: new Set() });
    const bucket = perWeekday.get(weekday)!;
    bucket.total++;
    bucket.days.add(key);
  }

  // El promedio se cuenta sobre los días que efectivamente se atendió: dividir por los
  // días del calendario metería los domingos y las vacaciones y no diría nada.
  const workedDays = perDate.size;
  const total = Array.from(perDate.values()).reduce((sum, n) => sum + n, 0);

  let busiestDay: string | null = null;
  let busiestDayAverage = 0;

  for (const [weekday, bucket] of perWeekday) {
    const average = bucket.total / bucket.days.size;
    if (average > busiestDayAverage) {
      busiestDayAverage = average;
      busiestDay = weekday;
    }
  }

  return {
    averagePerDay: workedDays === 0 ? 0 : Number((total / workedDays).toFixed(2)),
    busiestDay,
    busiestDayAverage: Number(busiestDayAverage.toFixed(2)),
  };
}

/**
 * Los meses que se pueden mirar en tarjetas: el que está corriendo y el anterior.
 *
 * El anterior está porque el primero de mes uno todavía quiere ver (y exportar) cómo
 * cerró el mes que acaba de terminar, y ese ya no es "el mes en curso".
 */
function recentMonths(): { key: string; label: string; from: Date; to: Date; inProgress: boolean }[] {
  const thisMonth = startOfMonth(new Date());

  return [0, 1].map((back) => {
    const from = addMonths(thisMonth, -back);
    return { key: monthKey(from), label: monthLabel(from), from, to: endOfMonth(from), inProgress: back === 0 };
  });
}

/** Los meses cerrados que entran en los gráficos, del más viejo al más nuevo. */
function closedMonths(): { key: string; label: string; from: Date; to: Date }[] {
  const thisMonth = startOfMonth(new Date());
  const months = [];

  for (let back = MONTHS_BACK; back >= 1; back--) {
    const from = addMonths(thisMonth, -back);
    months.push({ key: monthKey(from), label: monthLabel(from), from, to: endOfMonth(from) });
  }

  return months;
}

export class AnalyticsService {
  /** Turnos de un rango, con lo justo para calcular las métricas. */
  private async loadRows(from: Date, to: Date, professionalEmail?: string): Promise<Row[]> {
    const appointments = await em.find(
      Appointment,
      {
        date: { $gte: from, $lte: to },
        ...(professionalEmail ? { professional: { email: professionalEmail } } : {}),
      },
      { populate: ["patient", "professional"], orderBy: { date: "ASC" } }
    );

    return appointments.map((appointment) => ({
      date: appointment.date,
      value: appointment.value ?? 0,
      state: appointment.state,
      overbooked: !!appointment.overbooked,
      origin: appointment.origin ?? null,
      patientEmail: appointment.patient?.email ?? null,
      professionalEmail: appointment.professional.email,
    }));
  }

  private async assertProfessional(email: string): Promise<Person> {
    const person = await em.findOne(Person, { email });
    if (!person) throw notFound("Ese profesional no existe");
    if (person.type !== "professional") throw badRequest("Esa persona no es un profesional");
    return person;
  }

  /**
   * Analytics de un profesional.
   *
   * El mes en curso viene aparte de los gráficos a propósito: un mes a medio andar
   * dibuja siempre una caída al final que no significa nada.
   *
   * `billing` en false devuelve lo mismo sin las dos cifras de plata: es como lo mira
   * el admin, que controla la agenda del equipo pero no lo que cobra cada uno.
   */
  async forProfessional(professionalEmail: string, { billing = true }: { billing?: boolean } = {}) {
    const professional = await this.assertProfessional(professionalEmail);

    const months = closedMonths();
    const currentFrom = startOfMonth(new Date());
    const currentTo = endOfMonth(currentFrom);

    const rows = await this.loadRows(months[0].from, currentTo, professionalEmail);
    const byMonth = new Map<string, Row[]>();
    for (const row of rows) {
      const key = monthKey(startOfDay(row.date));
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(row);
    }

    const closed = rows.filter((row) => startOfDay(row.date) < currentFrom);

    const report = {
      professional: {
        email: professional.email,
        name: professional.name,
        surname: professional.surname,
        speciality: professional.speciality ?? null,
      },
      recent: recentMonths().map((month) => {
        const subset = byMonth.get(month.key) ?? [];
        return {
          key: month.key,
          label: month.label,
          inProgress: month.inProgress,
          ...summarize(subset),
          ...loadByDay(subset),
        };
      }),
      // Acumulado de los meses cerrados: es el número que se lee "en general".
      total: {
        months: months.length,
        ...summarize(closed),
        ...loadByDay(closed),
      },
      months: months.map((month) => ({
        key: month.key,
        label: month.label,
        ...summarize(byMonth.get(month.key) ?? []),
      })),
    };

    // Se saca acá y no en la pantalla: si viaja en la respuesta, está publicado.
    if (billing) return report;

    return {
      ...report,
      recent: report.recent.map(withoutBilling),
      total: withoutBilling(report.total),
      months: report.months.map(withoutBilling),
    };
  }

  /**
   * Analytics del consultorio entero. Cada métrica viene además dividida por la
   * cantidad de profesionales activos, para poder leer cuánto mueve sumar o sacar uno.
   */
  async forOffice() {
    const professionals = await em.find(Person, { type: "professional", active: true });
    const headcount = professionals.length;

    const months = closedMonths();
    const currentFrom = startOfMonth(new Date());
    const currentTo = endOfMonth(currentFrom);

    const rows = await this.loadRows(months[0].from, currentTo);
    const byMonth = new Map<string, Row[]>();
    for (const row of rows) {
      const key = monthKey(startOfDay(row.date));
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(row);
    }

    const closed = rows.filter((row) => startOfDay(row.date) < currentFrom);

    const nameOf = new Map(professionals.map((p) => [p.email, `${p.surname}, ${p.name}`]));

    /** Quién dio más sobreturnos en el recorte. */
    const topOverbooker = (subset: Row[]) => {
      const counts = new Map<string, number>();
      for (const row of subset) {
        if (isCancelled(row.state) || !row.overbooked) continue;
        counts.set(row.professionalEmail, (counts.get(row.professionalEmail) ?? 0) + 1);
      }

      let email: string | null = null;
      let count = 0;
      for (const [key, total] of counts) {
        if (total > count) {
          count = total;
          email = key;
        }
      }

      return email ? { email, name: nameOf.get(email) ?? email, count } : null;
    };

    /** Pacientes que se atendieron con más de un profesional distinto. */
    const sharedPatients = (subset: Row[]) => {
      const seen = new Map<string, Set<string>>();
      for (const row of subset) {
        if (isCancelled(row.state) || !row.patientEmail) continue;
        if (!seen.has(row.patientEmail)) seen.set(row.patientEmail, new Set());
        seen.get(row.patientEmail)!.add(row.professionalEmail);
      }
      return Array.from(seen.values()).filter((set) => set.size > 1).length;
    };

    const describe = (subset: Row[]) => ({
      ...summarize(subset),
      ...loadByDay(subset),
      sharedPatients: sharedPatients(subset),
      topOverbooker: topOverbooker(subset),
    });

    return {
      headcount,
      // Va acá y no en su propio endpoint porque se lee en la misma pantalla: pedir dos
      // veces para dibujar una sola vista solo agrega un estado de carga más.
      channels: await this.accessChannels(),
      professionals: professionals
        .map((p) => ({ email: p.email, name: p.name, surname: p.surname, speciality: p.speciality ?? null }))
        .sort((a, b) => a.surname.localeCompare(b.surname)),
      recent: recentMonths().map((month) => ({
        key: month.key,
        label: month.label,
        inProgress: month.inProgress,
        ...describe(byMonth.get(month.key) ?? []),
      })),
      total: { months: months.length, ...describe(closed) },
      months: months.map((month) => {
        const subset = byMonth.get(month.key) ?? [];
        return {
          key: month.key,
          label: month.label,
          ...summarize(subset),
          sharedPatients: sharedPatients(subset),
        };
      }),
    };
  }

  /**
   * Por dónde entra la gente: la app, la página, o las dos.
   *
   * Cada persona tiene una marca por canal, que se escribe al iniciar sesión y al
   * renovar el token. Son dos campos y no uno con "el último canal" justamente para
   * poder contar a los que usan los dos: con un solo campo, el que alterna caería
   * siempre del lado de la última vez y las dos cifras darían menos de lo que son.
   *
   * "Sin registro" no quiere decir que la persona no entre nunca. Quiere decir que no
   * volvió a entrar desde que el sistema empezó a anotarlo, y por eso va `desde`: sin
   * saber desde cuándo se mide, los números no se pueden leer.
   */
  async accessChannels() {
    // Los anónimos los carga un profesional y no tienen contraseña: no pueden entrar,
    // así que contarlos como "sin registro" ensuciaría el número sin decir nada.
    const people = await em.find(Person, { anonymous: false, active: true });
    const accounts = people.filter((person) => !!person.password);

    let since: Date | null = null;
    const roles = new Map<string, { role: string; onlyApp: number; onlyWeb: number; both: number; unknown: number }>();

    let onlyApp = 0;
    let onlyWeb = 0;
    let both = 0;
    let unknown = 0;

    for (const person of accounts) {
      const app = person.lastAppAccess ?? null;
      const web = person.lastWebAccess ?? null;

      for (const mark of [app, web]) {
        if (mark && (!since || mark < since)) since = mark;
      }

      const bucket = app && web ? "both" : app ? "onlyApp" : web ? "onlyWeb" : "unknown";

      if (bucket === "both") both++;
      else if (bucket === "onlyApp") onlyApp++;
      else if (bucket === "onlyWeb") onlyWeb++;
      else unknown++;

      if (!roles.has(person.type)) roles.set(person.type, { role: person.type, onlyApp: 0, onlyWeb: 0, both: 0, unknown: 0 });
      roles.get(person.type)![bucket]++;
    }

    return {
      accounts: accounts.length,
      /** Personas que entraron por lo menos una vez desde que se mide. */
      withAccess: accounts.length - unknown,
      onlyApp,
      onlyWeb,
      both,
      unknown,
      /** Totales por canal, contando dos veces a quien usa los dos. Es lo que se lee como "cuántos usan la app". */
      app: onlyApp + both,
      web: onlyWeb + both,
      since,
      byRole: Array.from(roles.values()).sort((a, b) => a.role.localeCompare(b.role)),
    };
  }

  /**
   * Sobreturnos de una semana, abiertos por profesional.
   *
   * El panel muestra quién dio más sobreturnos en el mes, que sirve para mirar la
   * tendencia. Esto contesta otra pregunta, la que se hace un lunes: quién los está
   * dando ahora y en qué turnos, para poder preguntarle por qué.
   *
   * La semana arranca el lunes, que es como se lee una agenda acá.
   */
  async overbookingByWeek(weeksAgo = 0) {
    const today = startOfDay(new Date());
    // getDay() devuelve 0 para domingo: el domingo pertenece a la semana que termina.
    const daysFromMonday = (today.getDay() + 6) % 7;
    const from = addDays(today, -daysFromMonday - weeksAgo * 7);
    const to = addDays(from, 6);

    const appointments = await em.find(
      Appointment,
      { date: { $gte: from, $lte: to }, overbooked: true },
      { populate: ["professional", "patient"], orderBy: { date: "ASC", initialHour: "ASC" } }
    );

    const live = appointments.filter((appointment) => !isCancelled(appointment.state));

    const byProfessional = new Map<string, { email: string; name: string; speciality: string | null; count: number; appointments: any[] }>();

    for (const appointment of live) {
      const professional = appointment.professional;
      if (!byProfessional.has(professional.email)) {
        byProfessional.set(professional.email, {
          email: professional.email,
          name: `${professional.name} ${professional.surname}`,
          speciality: professional.speciality ?? null,
          count: 0,
          appointments: [],
        });
      }
      const entry = byProfessional.get(professional.email)!;
      entry.count += 1;
      entry.appointments.push({
        numAppointment: appointment.numAppointment,
        date: toISODate(startOfDay(appointment.date)),
        day: dayName(startOfDay(appointment.date)),
        initialHour: appointment.initialHour.slice(0, 5),
        finalHour: appointment.finalHour.slice(0, 5),
        state: appointment.state,
      });
    }

    return {
      from: toISODate(from),
      to: toISODate(to),
      total: live.length,
      cancelled: appointments.length - live.length,
      professionals: Array.from(byProfessional.values()).sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Lo que consumió el asistente.
   *
   * Se mide en tokens porque es lo que factura el proveedor del modelo. Un mensaje puede
   * dar varias vueltas contra el modelo, así que el promedio por consulta es más útil
   * que el total pelado para saber si una función sale cara.
   *
   * Las herramientas se cuentan de las filas: cuál se usa más dice qué le sirve a la
   * gente del asistente, que no siempre es lo que uno supone cuando lo programa.
   */
  async assistantUsage() {
    const monthFrom = startOfMonth(new Date());

    const rows = await em.find(AssistantUsage, {}, { orderBy: { createdAt: "ASC" } });
    const thisMonth = rows.filter((row) => row.createdAt >= monthFrom);

    const sum = (subset: AssistantUsage[]) => ({
      consultas: subset.length,
      llamadasAlModelo: subset.reduce((total, row) => total + row.calls, 0),
      tokens: subset.reduce((total, row) => total + row.totalTokens, 0),
      tokensDeEntrada: subset.reduce((total, row) => total + row.promptTokens, 0),
      tokensDeSalida: subset.reduce((total, row) => total + row.completionTokens, 0),
      tokensPorConsulta: subset.length
        ? Math.round(subset.reduce((total, row) => total + row.totalTokens, 0) / subset.length)
        : 0,
    });

    /** Ranking de herramientas. `confirm_action` no cuenta: es la segunda mitad de otra. */
    const rankTools = (subset: AssistantUsage[]) => {
      const counts = new Map<string, number>();
      for (const row of subset) {
        let used: string[] = [];
        try {
          used = JSON.parse(row.tools ?? "[]");
        } catch {
          used = [];
        }
        for (const name of used) {
          if (name === "confirm_action") continue;
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
      }
      const labels = toolLabels();
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, label: labels[name] ?? name, count }))
        .sort((a, b) => b.count - a.count);
    };

    const byRole = (subset: AssistantUsage[]) => {
      const counts = new Map<string, { consultas: number; tokens: number }>();
      for (const row of subset) {
        const entry = counts.get(row.role) ?? { consultas: 0, tokens: 0 };
        entry.consultas += 1;
        entry.tokens += row.totalTokens;
        counts.set(row.role, entry);
      }
      return Array.from(counts.entries()).map(([role, data]) => ({ role, ...data }));
    };

    const ranking = rankTools(rows);

    return {
      mesEnCurso: sum(thisMonth),
      historico: sum(rows),
      desde: rows.length ? rows[0].createdAt : null,
      porRol: byRole(rows),
      herramientas: ranking,
      masUsada: ranking[0] ?? null,
      personasDistintas: new Set(rows.map((row) => row.email)).size,
    };
  }
}
