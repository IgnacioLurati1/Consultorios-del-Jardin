import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { RentSettings } from "./rentSettings.entity.js";
import { RoomBlockPrice } from "./roomBlockPrice.entity.js";
import { RentRate } from "./rentRate.entity.js";
import { RentExtra } from "./rentExtra.entity.js";
import { RentCharge } from "./rentCharge.entity.js";
import { badRequest, notFound } from "../shared/errors.js";
import { monthLabel, parseISODate, toISODate, toLocalDate } from "../shared/dates.js";
import { buildXlsx } from "../shared/xlsx.js";
import {
  BLOCKS,
  clampDueDay,
  compoundAdjust,
  computeCharge,
  dueDate,
  extraKey,
  freeBlocks,
  isLate,
  isMonthKey,
  monthKeyOf,
  paymentStatus,
  PRICE_KEYS,
  PRICED,
  raise,
  shiftMonth,
  toMinutes,
  usesOf,
  type PriceKey,
  type ChargeBreakdown,
  type ExtraPrices,
  type PaymentStatus,
  type RoomPrices,
  type ScheduleSlot,
} from "./rent.rules.js";

const em = orm.em;

/**
 * El cobro del alquiler a los profesionales.
 *
 * Tres cosas distintas que conviene no mezclar:
 *
 * - **La regla** (`RentRate`): cómo se calcula la cuota de alguien desde un mes en
 *   adelante. Un monto fijo, o sus bloques a los precios de cada consultorio.
 * - **La cuota** (`RentCharge`): lo que le toca pagar un mes puntual, ya calculado. Se
 *   crea al empezar el mes y a partir de ahí queda quieta, así un mes que pasó sigue
 *   diciendo lo que se cobró aunque después cambien la agenda o los precios.
 * - **El pago**, que va en la misma cuota: cuánto pagó y qué día.
 *
 * El mes que corre se puede recalcular (cambiar la cuota, aplicar un aumento desde este
 * mes); los que ya pasaron solo se corrigen a mano, uno por uno. El que viene todavía no
 * tiene cuotas guardadas: se muestra lo que saldría con las reglas de hoy.
 *
 * Todo esto es solo para el administrador. Lo controla la ruta, no el servicio.
 */

type Kind = "fixed" | "blocks";

interface Computed {
  amount: number;
  kind: Kind;
  blocks: number | null;
  breakdown: ChargeBreakdown | null;
}

/** Lo que hace falta para calcular cuotas, cargado de una vez para todos. */
interface Context {
  rates: Map<string, RentRate[]>;
  slots: Map<string, ScheduleSlot[]>;
  extras: Map<string, ExtraPrices>;
  pricesAt: (month: string) => RoomPrices;
}

export interface RentRow {
  email: string;
  name: string;
  surname: string;
  speciality: string | null;
  active: boolean;
  amount: number | null;
  kind: Kind | null;
  /** Todavía no hay cuota guardada: es lo que saldría con las reglas de hoy. */
  projected: boolean;
  blocks: number | null;
  paidAmount: number;
  paidOn: string | null;
  pending: number;
  status: PaymentStatus;
  late: boolean;
  warnings: string[];
  breakdown: ChargeBreakdown | null;
  /** Si tiene horarios cargados. Null en los meses pasados, donde no se mira la agenda. */
  hasSchedule: boolean | null;
}

export interface RentMonthSummary {
  /** Suma de las cuotas. */
  due: number;
  /** Lo que se pagó de esas cuotas. */
  collected: number;
  pending: number;
  /** Cuántas cuotas quedan con saldo. */
  pendingCount: number;
  count: number;
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Pagó",
  partial: "Pago parcial",
  unpaid: "No pagó",
  none: "Sin cuota",
};

/** Hasta mil millones: más que eso es un dedo apoyado sobre el cero. */
const MAX_MONEY = 1_000_000_000;

function labelOf(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return monthLabel(new Date(year, number - 1, 1));
}

function bySurname(a: { surname: string; name: string }, b: { surname: string; name: string }) {
  return a.surname.localeCompare(b.surname, "es") || a.name.localeCompare(b.name, "es");
}

/** La regla vigente en un mes: la más nueva que ya empezó. Las filas vienen ordenadas. */
function effective<T extends { fromMonth: string }>(rows: T[] | undefined, month: string): T | null {
  let found: T | null = null;
  for (const row of rows ?? []) {
    if (row.fromMonth > month) break;
    found = row;
  }
  return found;
}

function parseBreakdown(value: string | null | undefined): ChargeBreakdown | null {
  if (!value) return null;
  try {
    // Las cuotas guardadas antes del precio por día no tienen la lista.
    const parsed = JSON.parse(value) as ChargeBreakdown;
    return { ...parsed, days: parsed.days ?? [] };
  } catch {
    return null;
  }
}

function money(value: unknown, what: string): number {
  const number = Number(value);
  if (value === "" || value === null || !Number.isFinite(number) || !Number.isInteger(number) || number < 0 || number > MAX_MONEY)
    throw badRequest(`${what} tiene que ser un monto en pesos, sin centavos`);
  return number;
}

function isDuplicate(error: any): boolean {
  return error?.code === "ER_DUP_ENTRY" || (typeof error?.message === "string" && error.message.includes("Duplicate entry"));
}

export class RentService {
  /* ============================================================
     Lectura de datos
     ============================================================ */

  async settings(): Promise<RentSettings> {
    const found = await em.findOne(RentSettings, { id: 1 });
    if (found) return found;

    em.create(RentSettings, { id: 1, dueDay: 10 });

    try {
      await em.flush();
    } catch (error) {
      // Dos pedidos a la vez la crean los dos: el segundo choca y se queda con la del primero.
      if (!isDuplicate(error)) throw error;
      em.clear();
    }

    return em.findOneOrFail(RentSettings, { id: 1 });
  }

  private activeProfessionals(): Promise<Person[]> {
    return em.find(Person, { type: "professional", active: true });
  }

  private async professional(email: string): Promise<Person> {
    const person = await em.findOne(Person, { email });
    if (!person || person.type !== "professional") throw notFound("Ese profesional no existe");
    return person;
  }

  private async context(emails?: string[]): Promise<Context> {
    const onlyThese = emails ? { $in: emails } : undefined;

    const rateRows = await em.find(RentRate, onlyThese ? { professional: { email: onlyThese } } : {}, {
      orderBy: { fromMonth: "asc" },
    });
    const schedules = await em.find(Schedule, onlyThese ? { person: { email: onlyThese } } : {}, { populate: ["room"] });
    const extraRows = await em.find(RentExtra, onlyThese ? { professional: { email: onlyThese } } : {});
    const priceRows = await em.find(RoomBlockPrice, {}, { orderBy: { fromMonth: "asc" } });

    const rates = new Map<string, RentRate[]>();
    for (const rate of rateRows) {
      const email = rate.professional.email;
      if (!rates.has(email)) rates.set(email, []);
      rates.get(email)!.push(rate);
    }

    const slots = new Map<string, ScheduleSlot[]>();
    for (const schedule of schedules) {
      const email = schedule.person.email;
      if (!slots.has(email)) slots.set(email, []);
      slots.get(email)!.push({
        day: schedule.day,
        initialHour: schedule.initialHour.slice(0, 5),
        finalHour: schedule.finalHour.slice(0, 5),
        roomId: schedule.room.idRoom!,
        room: schedule.room.description,
      });
    }

    const extras = new Map<string, ExtraPrices>();
    for (const extra of extraRows) {
      const email = extra.professional.email;
      if (!extras.has(email)) extras.set(email, new Map());
      extras.get(email)!.set(extraKey(extra.day, extra.initialHour), extra.price);
    }

    const cache = new Map<string, RoomPrices>();
    const pricesAt = (month: string): RoomPrices => {
      if (cache.has(month)) return cache.get(month)!;

      const prices: RoomPrices = new Map();
      for (const row of priceRows) {
        if (row.fromMonth > month) break;
        const roomId = row.room.idRoom!;
        if (!prices.has(roomId)) prices.set(roomId, {});
        prices.get(roomId)![row.block as PriceKey] = row.price ?? null;
      }

      cache.set(month, prices);
      return prices;
    };

    return { rates, slots, extras, pricesAt };
  }

  /** La cuota que le corresponde a alguien en un mes, según su regla. Null si no tiene. */
  private compute(ctx: Context, email: string, month: string): Computed | null {
    const rate = effective(ctx.rates.get(email), month);
    if (!rate) return null;

    if (rate.kind === "fixed") return { amount: rate.amount ?? 0, kind: "fixed", blocks: null, breakdown: null };

    const breakdown = computeCharge(
      ctx.slots.get(email) ?? [],
      ctx.pricesAt(month),
      ctx.extras.get(email) ?? new Map(),
      month,
      rate.adjust ?? 0
    );

    return {
      amount: breakdown.amount,
      kind: "blocks",
      blocks: usesOf(breakdown),
      breakdown,
    };
  }

  private fill(charge: RentCharge, computed: Computed) {
    charge.amount = computed.amount;
    charge.kind = computed.kind;
    charge.blocks = computed.blocks;
    charge.breakdown = computed.breakdown ? JSON.stringify(computed.breakdown) : null;
  }

  private newCharge(person: Person, month: string, computed: Computed): RentCharge {
    return em.create(RentCharge, {
      professional: person,
      month,
      amount: computed.amount,
      kind: computed.kind,
      blocks: computed.blocks,
      breakdown: computed.breakdown ? JSON.stringify(computed.breakdown) : null,
      paidAmount: 0,
      paidOn: null,
      updatedAt: new Date(),
    });
  }

  private assertViewable(month: unknown, current: string): asserts month is string {
    if (!isMonthKey(month)) throw badRequest("Ese mes no existe");
    if (month > shiftMonth(current, 1)) throw badRequest("Solo se puede mirar hasta el mes que viene");
  }

  /** Los cambios de regla rigen desde este mes o desde el que viene: el pasado no se recalcula. */
  private assertFrom(month: unknown, current: string): asserts month is string {
    if (month !== current && month !== shiftMonth(current, 1))
      throw badRequest("Los cambios rigen desde este mes o desde el que viene");
  }

  /* ============================================================
     Las cuotas del mes
     ============================================================ */

  /**
   * Crea las cuotas del mes que falten, con la regla de cada uno.
   *
   * La corre el job todos los días y también quien mira el mes en curso: la primera vez
   * que se lo mira después del día 1, las cuotas quedan fijadas con la agenda de ese
   * momento. Solo crea; lo que ya existe no se toca.
   */
  async ensureMonth(month: string = monthKeyOf()): Promise<number> {
    const professionals = await this.activeProfessionals();
    const existing = new Set((await em.find(RentCharge, { month })).map((charge) => charge.professional.email));
    const missing = professionals.filter((person) => !existing.has(person.email));
    if (missing.length === 0) return 0;

    const ctx = await this.context(missing.map((person) => person.email));
    let created = 0;

    for (const person of missing) {
      const computed = this.compute(ctx, person.email, month);
      if (!computed) continue;
      this.newCharge(person, month, computed);
      created++;
    }

    if (created === 0) return 0;

    try {
      await em.flush();
    } catch (error) {
      // El job y una pantalla abierta pueden crear la misma cuota a la vez. La clave única
      // frena la segunda; lo que quedó a medio guardar se descarta y la próxima vuelta
      // completa lo que falte.
      if (!isDuplicate(error)) throw error;
      em.clear();
      return 0;
    }

    return created;
  }

  /**
   * Vuelve a calcular las cuotas guardadas desde un mes, después de cambiar una regla.
   *
   * Nunca antes del mes en curso: lo que ya pasó se cobró como se cobró. Lo pagado se
   * conserva, y si la cuota sube, la diferencia queda como saldo.
   */
  private async refresh(emails: string[] | null, fromMonth: string): Promise<void> {
    const current = monthKeyOf();
    const start = fromMonth > current ? fromMonth : current;

    const charges = await em.find(RentCharge, {
      month: { $gte: start },
      ...(emails ? { professional: { email: { $in: emails } } } : {}),
    });

    if (charges.length > 0) {
      const ctx = await this.context(emails ?? undefined);
      for (const charge of charges) {
        const computed = this.compute(ctx, charge.professional.email, charge.month);
        if (computed) this.fill(charge, computed);
      }
      await em.flush();
    }

    if (start === current) await this.ensureMonth(current);
  }

  /** Lo que se muestra de un mes: una fila por profesional y los totales. */
  async month(month: unknown) {
    const current = monthKeyOf();
    this.assertViewable(month, current);

    if (month === current) await this.ensureMonth(month);

    const settings = await this.settings();
    const charges = await em.find(RentCharge, { month }, { populate: ["professional"] });

    const people = new Map<string, Person>();
    for (const charge of charges) people.set(charge.professional.email, charge.professional);

    // Del mes en curso en adelante aparecen todos los habilitados, tengan cuota o no: es
    // desde donde se le pone la cuota a alguien que todavía no tiene.
    const live = month >= current;
    if (live) for (const person of await this.activeProfessionals()) people.set(person.email, person);

    const ctx = live ? await this.context([...people.keys()]) : null;
    const chargeOf = new Map(charges.map((charge) => [charge.professional.email, charge]));
    const due = dueDate(month, settings.dueDay);
    const today = toISODate(new Date());

    const rows: RentRow[] = [...people.values()]
      .map((person) => {
        const charge = chargeOf.get(person.email);
        const projected = !charge && ctx ? this.compute(ctx, person.email, month) : null;
        const amount = charge ? charge.amount : projected?.amount ?? null;
        const paid = charge?.paidAmount ?? 0;
        const breakdown = charge ? parseBreakdown(charge.breakdown) : projected?.breakdown ?? null;

        return {
          email: person.email,
          name: person.name,
          surname: person.surname,
          speciality: person.speciality ?? null,
          active: person.active,
          amount,
          kind: (charge?.kind as Kind) ?? projected?.kind ?? null,
          projected: !charge,
          blocks: charge ? charge.blocks ?? null : projected?.blocks ?? null,
          paidAmount: paid,
          paidOn: charge?.paidOn ?? null,
          pending: amount === null ? 0 : Math.max(0, amount - paid),
          status: paymentStatus(amount, paid),
          late: isLate(amount, paid, charge?.paidOn ?? null, due, today),
          warnings: breakdown?.missing ?? [],
          breakdown,
          hasSchedule: ctx ? (ctx.slots.get(person.email)?.length ?? 0) > 0 : null,
        };
      })
      .sort(bySurname);

    // La cuota más vieja, para saber hasta dónde se puede ir para atrás. `find` y no
    // `findOne`: el ORM no deja pedir uno solo sin condición.
    const [first] = await em.find(RentCharge, {}, { orderBy: { month: "asc" }, limit: 1 });

    return {
      month,
      label: labelOf(month),
      current,
      next: shiftMonth(current, 1),
      firstMonth: first && first.month < current ? first.month : current,
      dueDay: settings.dueDay,
      dueDate: due,
      rows,
      totals: {
        due: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
        collected: rows.reduce((sum, row) => sum + row.paidAmount, 0),
        pending: rows.reduce((sum, row) => sum + row.pending, 0),
        paid: rows.filter((row) => row.status === "paid").length,
        partial: rows.filter((row) => row.status === "partial").length,
        unpaid: rows.filter((row) => row.status === "unpaid").length,
        late: rows.filter((row) => row.late).length,
        withoutAmount: rows.filter((row) => row.amount === null).length,
      },
    };
  }

  /**
   * Escribe la cuota de alguien a mano.
   *
   * Desde el mes en curso en adelante queda como su regla (se mantiene igual los meses
   * que siguen). En un mes que ya pasó es una corrección de ese mes y nada más.
   */
  async setAmount(email: string, month: unknown, amount: unknown): Promise<void> {
    const person = await this.professional(email);
    const current = monthKeyOf();
    this.assertViewable(month, current);
    const value = money(amount, "La cuota");

    if (month >= current) {
      await this.upsertRate(person, month, { kind: "fixed", amount: value, adjust: 0 });
      await em.flush();
      await this.refresh([email], month);
      return;
    }

    const charge = await em.findOne(RentCharge, { professional: { email }, month });

    if (charge) {
      this.fill(charge, { amount: value, kind: "fixed", blocks: null, breakdown: null });
    } else {
      this.newCharge(person, month, { amount: value, kind: "fixed", blocks: null, breakdown: null });
    }

    await em.flush();
  }

  /**
   * Registra el pago de una cuota: pagó, pagó una parte, o no pagó.
   *
   * La fecha es la del pago, no la de hoy: se carga muchas veces después. Por eso llega
   * desde la pantalla (que propone hoy) y lo único que se controla es que no sea futura.
   */
  async setPayment(email: string, month: unknown, data: { status?: unknown; paidAmount?: unknown; paidOn?: unknown }) {
    const person = await this.professional(email);
    const current = monthKeyOf();
    this.assertViewable(month, current);

    let charge = await em.findOne(RentCharge, { professional: { email }, month });

    // El mes que viene todavía no tiene cuotas guardadas: pagar por adelantado la crea.
    if (!charge && month >= current) {
      const computed = this.compute(await this.context([email]), email, month);
      if (computed) charge = this.newCharge(person, month, computed);
    }

    if (!charge) throw badRequest("Falta la cuota de ese mes");
    if (charge.amount <= 0) throw badRequest("La cuota de ese mes está en cero");

    const today = toISODate(new Date());

    if (data.status === "unpaid") {
      charge.paidAmount = 0;
      charge.paidOn = null;
    } else if (data.status === "paid" || data.status === "partial") {
      const given = data.paidOn ? parseISODate(String(data.paidOn)) : null;
      if (data.paidOn && !given) throw badRequest("La fecha de pago no es válida");

      const day = given ? toISODate(given) : today;
      if (day > today) throw badRequest("La fecha de pago no puede ser posterior a hoy");

      if (data.status === "paid") {
        charge.paidAmount = charge.amount;
      } else {
        const value = money(data.paidAmount, "Lo pagado");
        if (value <= 0) throw badRequest("Falta el monto pagado");
        if (value >= charge.amount) throw badRequest("Un pago parcial tiene que ser menor que la cuota");
        charge.paidAmount = value;
      }

      charge.paidOn = day;
    } else {
      throw badRequest("Falta indicar si pagó");
    }

    await em.flush();
  }

  private async upsertRate(person: Person, fromMonth: string, data: { kind: Kind; amount: number | null; adjust: number }) {
    const rate = await em.findOne(RentRate, { professional: { email: person.email }, fromMonth });

    if (rate) {
      rate.kind = data.kind;
      rate.amount = data.amount;
      rate.adjust = data.adjust;
      return;
    }

    em.create(RentRate, { professional: person, fromMonth, ...data, createdAt: new Date() });
  }

  /* ============================================================
     Calcular con los bloques
     ============================================================ */

  /**
   * Lo que saldría cada cuota calculada con los bloques, sin guardar nada.
   *
   * Es la previa del botón "Calcular": deja ver cuánto le toca a cada uno, qué tramos sin
   * módulo necesitan un valor a mano y quiénes comparten un horario, antes de pisar las
   * cuotas de todos.
   */
  async calculationPreview(fromMonth: unknown) {
    const current = monthKeyOf();
    this.assertFrom(fromMonth, current);

    const professionals = (await this.activeProfessionals()).sort(bySurname);
    const ctx = await this.context(professionals.map((person) => person.email));
    const prices = ctx.pricesAt(fromMonth);
    const saved = new Map(
      (await em.find(RentCharge, { month: fromMonth })).map((charge) => [charge.professional.email, charge.amount])
    );

    const withSchedule = professionals.filter((person) => (ctx.slots.get(person.email)?.length ?? 0) > 0);

    const rows = withSchedule.map((person) => ({
      person,
      breakdown: computeCharge(ctx.slots.get(person.email) ?? [], prices, ctx.extras.get(person.email) ?? new Map(), fromMonth),
    }));

    // Quién más usa el consultorio a la misma hora. Cada uno paga su módulo entero, así que
    // un horario compartido se cobra dos veces: está bien que se vea antes de aplicar. Se
    // mira el horario y no el módulo, porque dos módulos de la mañana pueden caer en ratos
    // distintos del día.
    const uses: { roomId: number; day: string; from: number; to: number; name: string }[] = [];
    for (const { person, breakdown } of rows) {
      const name = `${person.name} ${person.surname}`;
      for (const line of [...breakdown.blocks, ...breakdown.days]) {
        uses.push({
          roomId: line.roomId,
          day: line.day,
          from: toMinutes(line.from ?? "00:00"),
          to: toMinutes(line.to ?? "00:00"),
          name,
        });
      }
    }

    const sharedWith = (line: { roomId: number; day: string; from?: string; to?: string }, me: string) => {
      const from = toMinutes(line.from ?? "00:00");
      const to = toMinutes(line.to ?? "00:00");
      const others = uses.filter(
        (use) => use.name !== me && use.roomId === line.roomId && use.day === line.day && use.from < to && use.to > from
      );
      return [...new Set(others.map((use) => use.name))];
    };

    return {
      fromMonth,
      label: labelOf(fromMonth),
      blocks: BLOCKS,
      rows: rows.map(({ person, breakdown }) => {
        const me = `${person.name} ${person.surname}`;
        return {
          email: person.email,
          name: person.name,
          surname: person.surname,
          speciality: person.speciality ?? null,
          before: saved.get(person.email) ?? this.compute(ctx, person.email, fromMonth)?.amount ?? null,
          amount: breakdown.amount,
          blocks: usesOf(breakdown),
          breakdown: {
            ...breakdown,
            blocks: breakdown.blocks.map((line) => ({ ...line, sharedWith: sharedWith(line, me) })),
            days: breakdown.days.map((line) => ({ ...line, sharedWith: sharedWith(line, me) })),
          },
        };
      }),
      withoutSchedule: professionals
        .filter((person) => !withSchedule.includes(person))
        .map((person) => ({ email: person.email, name: person.name, surname: person.surname })),
    };
  }

  /**
   * Pasa a calcular con los bloques la cuota de los elegidos, desde un mes.
   *
   * Los valores a mano de las franjas fuera de bloque llegan en la misma tanda: son parte
   * de la misma decisión, y guardarlos por separado dejaba cuotas calculadas sin ellos.
   */
  async applyCalculation(data: { fromMonth?: unknown; emails?: unknown; extras?: unknown }) {
    const current = monthKeyOf();
    this.assertFrom(data.fromMonth, current);
    const fromMonth = data.fromMonth;

    const professionals = await this.activeProfessionals();
    const ctx = await this.context(professionals.map((person) => person.email));
    const eligible = new Map(
      professionals.filter((person) => (ctx.slots.get(person.email)?.length ?? 0) > 0).map((person) => [person.email, person])
    );

    const emails = Array.isArray(data.emails) ? [...new Set(data.emails.map(String))] : [];
    if (emails.length === 0) throw badRequest("Falta elegir a quién calcularle la cuota");
    for (const email of emails) if (!eligible.has(email)) throw badRequest("Solo se calcula a profesionales habilitados y con horarios");

    const extras = Array.isArray(data.extras) ? data.extras : [];
    for (const raw of extras) {
      const email = String(raw?.email ?? "");
      const day = String(raw?.day ?? "");
      const initialHour = String(raw?.initialHour ?? "").slice(0, 5);
      const person = eligible.get(email);

      const exists = (ctx.slots.get(email) ?? []).some((slot) => slot.day === day && slot.initialHour === initialHour);
      if (!person || !exists) throw badRequest("Uno de los valores a mano es de un horario que ya no existe");

      const saved = await em.findOne(RentExtra, { professional: { email }, day, initialHour });

      if (raw?.price === null || raw?.price === "" || raw?.price === undefined) {
        if (saved) em.remove(saved);
        continue;
      }

      const price = money(raw.price, "El valor a mano");
      if (saved) saved.price = price;
      else em.create(RentExtra, { professional: person, day, initialHour, price });
    }

    for (const email of emails) await this.upsertRate(eligible.get(email)!, fromMonth, { kind: "blocks", amount: null, adjust: 0 });

    await em.flush();
    await this.refresh(emails, fromMonth);

    return { updated: emails.length };
  }

  /**
   * Un aumento en porcentaje, para todos o para algunos, desde un mes.
   *
   * A la cuota fija se le suma el porcentaje. A la que sale de los bloques hay dos formas
   * de subirla, y cuál corresponde depende de a quiénes se sube:
   *
   * - A todos, con `prices`: suben los precios de los bloques de todos los consultorios, y
   *   las cuotas suben con ellos. Es lo que hace que un profesional que llegue después ya
   *   entre con el precio nuevo.
   * - A algunos: los precios no se tocan (subirían también los de los demás) y a cada
   *   elegido se le suma el aumento como un ajuste propio.
   */
  async applyIncrease(data: { percent?: unknown; fromMonth?: unknown; emails?: unknown; prices?: unknown }) {
    const current = monthKeyOf();
    this.assertFrom(data.fromMonth, current);
    const fromMonth = data.fromMonth;

    const percent = Math.round(Number(data.percent) * 100) / 100;
    if (!Number.isFinite(percent) || percent <= 0 || percent > 300) throw badRequest("El aumento tiene que ser un porcentaje mayor a cero");

    const professionals = await this.activeProfessionals();
    const byEmail = new Map(professionals.map((person) => [person.email, person]));

    const emails = Array.isArray(data.emails) ? [...new Set(data.emails.map(String))] : [];
    if (emails.length === 0) throw badRequest("Falta elegir a quién aplicarle el aumento");
    for (const email of emails) if (!byEmail.has(email)) throw badRequest("Solo se aplica a profesionales habilitados");

    const everyone = professionals.every((person) => emails.includes(person.email));
    const prices = data.prices === true;
    if (prices && !everyone) throw badRequest("Los precios de los consultorios suben solo con un aumento para todos");

    const ctx = await this.context(emails);
    const skipped: string[] = [];
    let raised = 0;

    for (const email of emails) {
      const person = byEmail.get(email)!;
      const rate = effective(ctx.rates.get(email), fromMonth);

      if (!rate) {
        skipped.push(`${person.name} ${person.surname}`);
        continue;
      }

      if (rate.kind === "fixed") {
        await this.upsertRate(person, fromMonth, { kind: "fixed", amount: raise(rate.amount ?? 0, percent), adjust: 0 });
      } else if (!prices) {
        await this.upsertRate(person, fromMonth, { kind: "blocks", amount: null, adjust: compoundAdjust(rate.adjust ?? 0, percent) });
      }

      raised++;
    }

    let pricesChanged = 0;
    if (prices) {
      const now = ctx.pricesAt(fromMonth);
      const rooms = await em.find(Room, { idRoom: { $in: [...now.keys()] } });
      const roomById = new Map(rooms.map((room) => [room.idRoom!, room]));

      for (const [roomId, blocks] of now) {
        const room = roomById.get(roomId);
        if (!room) continue;
        for (const key of PRICE_KEYS) {
          const price = blocks[key];
          if (price === null || price === undefined) continue;
          await this.upsertPrice(room, key, fromMonth, raise(price, percent));
          pricesChanged++;
        }
      }
    }

    await em.flush();
    await this.refresh(prices ? null : emails, fromMonth);

    return { raised, skipped, prices: pricesChanged };
  }

  /* ============================================================
     Precios de los bloques
     ============================================================ */

  async roomPrices(month?: unknown) {
    const current = monthKeyOf();
    const target = month ?? current;
    this.assertViewable(target, current);

    const rooms = (await em.find(Room, { active: true }, { populate: ["office"] }))
      .filter((room) => room.office?.active !== false)
      .sort(
        (a, b) =>
          a.office.description.localeCompare(b.office.description, "es") ||
          a.description.localeCompare(b.description, "es", { numeric: true })
      );

    const ctx = await this.context([]);
    const now = ctx.pricesAt(target);
    const next = ctx.pricesAt(shiftMonth(target, 1));

    return {
      month: target,
      label: labelOf(target),
      // Acá va también el día: es lo que arma las columnas de precios.
      blocks: PRICED,
      rooms: rooms.map((room) => ({
        idRoom: room.idRoom!,
        room: room.description,
        office: room.office.description,
        prices: Object.fromEntries(PRICE_KEYS.map((key) => [key, now.get(room.idRoom!)?.[key] ?? null])),
        // Lo que ya quedó programado para el mes siguiente, si cambia.
        next: Object.fromEntries(PRICE_KEYS.map((key) => [key, next.get(room.idRoom!)?.[key] ?? null])),
      })),
    };
  }

  private async upsertPrice(room: Room, block: PriceKey, fromMonth: string, price: number | null) {
    const row = await em.findOne(RoomBlockPrice, { room: { idRoom: room.idRoom }, block, fromMonth });
    if (row) row.price = price;
    else em.create(RoomBlockPrice, { room, block, fromMonth, price, createdAt: new Date() });
  }

  async setRoomPrices(data: { fromMonth?: unknown; prices?: unknown }) {
    const current = monthKeyOf();
    this.assertFrom(data.fromMonth, current);
    const fromMonth = data.fromMonth;

    const changes = Array.isArray(data.prices) ? data.prices : [];
    if (changes.length === 0) throw badRequest("No hay precios para guardar");

    const ids = [...new Set(changes.map((change: any) => Number(change?.idRoom)))];
    const rooms = new Map((await em.find(Room, { idRoom: { $in: ids } })).map((room) => [room.idRoom!, room]));

    for (const change of changes) {
      const room = rooms.get(Number(change?.idRoom));
      if (!room) throw notFound("Uno de los consultorios ya no existe");
      if (!PRICE_KEYS.includes(change?.block)) throw badRequest("Ese bloque no existe");

      const price = change.price === null || change.price === "" ? null : money(change.price, "El precio");
      await this.upsertPrice(room, change.block, fromMonth, price);
    }

    await em.flush();
    await this.refresh(null, fromMonth);

    return this.roomPrices(fromMonth);
  }

  async setDueDay(day: unknown) {
    const value = Number(day);
    if (!Number.isInteger(value) || value < 1 || value > 28) throw badRequest("El vencimiento tiene que ser un día del 1 al 28");

    const settings = await this.settings();
    settings.dueDay = clampDueDay(value);
    await em.flush();

    return { dueDay: settings.dueDay };
  }

  /* ============================================================
     Planilla
     ============================================================ */

  async exportMonth(month: unknown): Promise<{ filename: string; buffer: Buffer }> {
    const view = await this.month(month);
    const settings = await this.settings();
    const today = toISODate(new Date());

    const history = (await em.find(RentCharge, {}, { populate: ["professional"] })).sort(
      (a, b) => b.month.localeCompare(a.month) || bySurname(a.professional, b.professional)
    );

    const buffer = buildXlsx([
      {
        name: `Cuotas ${view.label}`,
        columns: [
          { header: "Profesional", width: 28 },
          { header: "Especialidad", width: 18 },
          { header: "Forma de cálculo", width: 16 },
          { header: "Bloques en el mes", width: 16 },
          { header: "Cuota", width: 14, money: true },
          { header: "Pagado", width: 14, money: true },
          { header: "Saldo", width: 14, money: true },
          { header: "Estado", width: 14 },
          { header: "Fecha de pago", width: 14 },
          { header: "Fuera de término", width: 16 },
          { header: "Observaciones", width: 50 },
        ],
        rows: view.rows.map((row) => [
          `${row.surname}, ${row.name}`,
          row.speciality,
          row.kind === "blocks" ? "Por bloques" : row.kind === "fixed" ? "Fija" : "",
          row.blocks,
          row.amount,
          row.paidAmount,
          row.pending,
          STATUS_LABEL[row.status],
          row.paidOn ? toLocalDate(row.paidOn) : "",
          row.late ? "Sí" : "",
          [row.projected && row.amount !== null ? "Estimada, todavía sin cuota guardada" : "", ...row.warnings]
            .filter(Boolean)
            .join(". "),
        ]),
      },
      {
        name: "Histórico",
        columns: [
          { header: "Mes", width: 16 },
          { header: "Profesional", width: 28 },
          { header: "Cuota", width: 14, money: true },
          { header: "Pagado", width: 14, money: true },
          { header: "Saldo", width: 14, money: true },
          { header: "Estado", width: 14 },
          { header: "Fecha de pago", width: 14 },
          { header: "Fuera de término", width: 16 },
        ],
        rows: history.map((charge) => [
          labelOf(charge.month),
          `${charge.professional.surname}, ${charge.professional.name}`,
          charge.amount,
          charge.paidAmount,
          Math.max(0, charge.amount - charge.paidAmount),
          STATUS_LABEL[paymentStatus(charge.amount, charge.paidAmount)],
          charge.paidOn ? toLocalDate(charge.paidOn) : "",
          isLate(charge.amount, charge.paidAmount, charge.paidOn ?? null, dueDate(charge.month, settings.dueDay), today) ? "Sí" : "",
        ]),
      },
    ]);

    return { filename: `alquileres-${view.month}.xlsx`, buffer };
  }

  /* ============================================================
     Para los números
     ============================================================ */

  /** Cuotas, cobrado y pendiente de cada mes pedido. Un mes sin cuotas viene en cero. */
  async officeSummary(months: string[]): Promise<Map<string, RentMonthSummary>> {
    const summary = new Map<string, RentMonthSummary>();
    for (const month of months) summary.set(month, { due: 0, collected: 0, pending: 0, pendingCount: 0, count: 0 });

    const charges = await em.find(RentCharge, { month: { $in: months } });

    for (const charge of charges) {
      const entry = summary.get(charge.month)!;
      const pending = Math.max(0, charge.amount - charge.paidAmount);

      entry.due += charge.amount;
      entry.collected += charge.paidAmount;
      entry.pending += pending;
      entry.count++;
      if (pending > 0) entry.pendingCount++;
    }

    return summary;
  }

  /**
   * Cómo paga un profesional, para el administrador que mira sus números.
   *
   * Se miran los últimos doce meses y el que corre. Un mes cuenta cuando ya se sabe si se
   * pagó a tiempo: pagado, o con el vencimiento ya pasado.
   */
  async professionalSummary(email: string) {
    const current = monthKeyOf();
    const settings = await this.settings();
    const today = toISODate(new Date());

    const charges = await em.find(
      RentCharge,
      { professional: { email }, month: { $gte: shiftMonth(current, -12), $lte: current } },
      { orderBy: { month: "asc" } }
    );

    const judged = charges.filter((charge) => {
      const status = paymentStatus(charge.amount, charge.paidAmount);
      return status !== "none" && (status === "paid" || today > dueDate(charge.month, settings.dueDay));
    });

    const late = judged.filter((charge) =>
      isLate(charge.amount, charge.paidAmount, charge.paidOn ?? null, dueDate(charge.month, settings.dueDay), today)
    );

    const paidDays = charges
      .filter((charge) => paymentStatus(charge.amount, charge.paidAmount) === "paid" && charge.paidOn?.startsWith(charge.month))
      .map((charge) => Number(charge.paidOn!.slice(8, 10)));

    return {
      dueDay: settings.dueDay,
      months: judged.length,
      late: late.length,
      lastLate: late.length ? labelOf(late[late.length - 1].month) : null,
      owed: charges.reduce((sum, charge) => sum + Math.max(0, charge.amount - charge.paidAmount), 0),
      averagePaidDay: paidDays.length ? Math.round(paidDays.reduce((sum, day) => sum + day, 0) / paidDays.length) : null,
    };
  }

  /**
   * Los bloques que nadie usa y cuánto dejarían alquilados, a los precios del mes.
   *
   * Recorre toda la agenda de todos los consultorios. Se calcula solo cuando el
   * administrador lo pide, nunca al abrir los números.
   */
  async freeBlocksReport(month?: unknown) {
    const current = monthKeyOf();
    const target = month ?? current;
    this.assertFrom(target, current);

    const rooms = (await em.find(Room, { active: true }, { populate: ["office"] })).filter((room) => room.office?.active !== false);

    // Los horarios de un profesional deshabilitado siguen ocupando la sala (ver la agenda),
    // así que acá entran todos.
    const ctx = await this.context();
    const slots = [...ctx.slots.values()].flat();

    const report = freeBlocks(
      rooms.map((room) => ({ roomId: room.idRoom!, room: room.description, office: room.office.description })),
      slots,
      ctx.pricesAt(target),
      target
    ).sort((a, b) => a.office.localeCompare(b.office, "es") || a.room.localeCompare(b.room, "es", { numeric: true }));

    return {
      month: target,
      label: labelOf(target),
      blocks: BLOCKS,
      rooms: report,
      totals: {
        free: report.reduce((sum, room) => sum + room.free.length, 0),
        times: report.reduce((sum, room) => sum + room.free.reduce((acc, block) => acc + block.times, 0), 0),
        potential: report.reduce((sum, room) => sum + room.potential, 0),
        unpriced: report.reduce((sum, room) => sum + room.unpriced, 0),
      },
    };
  }

  /**
   * Cuánto más entraría si el alquiler sube, en porcentaje o en pesos por bloque.
   *
   * En porcentaje se aplica sobre las cuotas del mes, sean fijas o por bloques. En pesos se
   * suma a cada vez que se usa un bloque, así que cuenta los bloques de la agenda de todos
   * los habilitados. Aparte va lo mismo para los bloques libres, si se llenaran.
   */
  async increaseSimulation(query: { month?: unknown; mode?: unknown; value?: unknown }) {
    const current = monthKeyOf();
    const target = query.month ?? current;
    this.assertFrom(target, current);

    const mode = query.mode === "amount" ? "amount" : query.mode === "percent" ? "percent" : null;
    if (!mode) throw badRequest("Falta elegir si el aumento es en porcentaje o en pesos");

    const value = Number(query.value);
    if (!Number.isFinite(value) || value <= 0 || value > MAX_MONEY) throw badRequest("El aumento tiene que ser mayor a cero");

    const view = await this.month(target);
    const monthly = view.rows.filter((row) => row.active).reduce((sum, row) => sum + (row.amount ?? 0), 0);

    const professionals = await this.activeProfessionals();
    const ctx = await this.context(professionals.map((person) => person.email));
    const prices = ctx.pricesAt(target);

    const times = professionals.reduce((sum, person) => {
      const breakdown = computeCharge(ctx.slots.get(person.email) ?? [], prices, new Map(), target);
      return sum + usesOf(breakdown);
    }, 0);

    const added = mode === "percent" ? Math.round((monthly * value) / 100) : Math.round(times * value);

    const free = await this.freeBlocksReport(target);
    const freeAfter =
      mode === "percent" ? Math.round(free.totals.potential * (1 + value / 100)) : free.totals.potential + Math.round(free.totals.times * value);

    return {
      month: target,
      label: labelOf(target),
      mode,
      value,
      monthly,
      times,
      added,
      projected: monthly + added,
      yearly: added * 12,
      free: { blocks: free.totals.free, times: free.totals.times, potential: free.totals.potential, after: freeAfter },
    };
  }
}
