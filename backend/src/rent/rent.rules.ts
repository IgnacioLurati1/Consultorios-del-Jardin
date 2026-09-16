/**
 * Las reglas del alquiler, sin base de datos de por medio.
 *
 * Están aparte del servicio para poder probarlas solas: qué bloques ocupa un horario,
 * cuántas veces cae un día en un mes, cuánto sale una cuota y si se pagó a tiempo. El
 * servicio junta los datos y le pregunta a esto; esto no sabe de dónde salieron.
 *
 * Cómo se cobra, tal como lo definió el consultorio:
 *
 * - El alquiler es por consultorio y por bloque. Cada consultorio tiene dos bloques, la
 *   mañana de 9 a 13 y la tarde de 14 a 20, y cada bloque de cada consultorio tiene su
 *   propio precio.
 * - Se paga el bloque entero. Quien atiende los lunes de 9 a 11 en un consultorio usa la
 *   mañana de ese consultorio los lunes, y paga esa mañana completa por cada lunes del mes.
 * - Los meses se cuentan de verdad: un mes con cinco lunes cobra cinco mañanas.
 * - Las vacaciones no descuentan nada. El horario es del profesional aunque no venga, y
 *   si no lo paga lo pierde.
 * - Lo que queda fuera de los dos bloques (de 13 a 14, antes de las 9, después de las 20)
 *   no tiene precio: el administrador le pone un valor a mano, y hasta entonces la cuota
 *   sale sin esa parte y con el aviso de que falta.
 * - También se alquila el día entero, de 9 a 20 de corrido, con su propio precio. Solo
 *   cuenta si el consultorio se usa sin cortes de 9 a 20 (la hora de 13 a 14 incluida):
 *   con un hueco en el medio son bloques. El día reemplaza a la mañana, a la tarde y al
 *   valor a mano de 13 a 14. Un consultorio sin precio del día se cobra por bloques.
 */

export type BlockKey = "morning" | "afternoon";

/** Lo que tiene precio en un consultorio: los dos bloques y el día entero. */
export type PriceKey = BlockKey | "day";

export interface Block {
  key: BlockKey;
  label: string;
  from: string;
  to: string;
}

export const BLOCKS: Block[] = [
  { key: "morning", label: "Mañana", from: "09:00", to: "13:00" },
  { key: "afternoon", label: "Tarde", from: "14:00", to: "20:00" },
];

export const BLOCK_KEYS: BlockKey[] = BLOCKS.map((block) => block.key);

/**
 * El día entero. No es un bloque más de la grilla: se superpone con los dos, así que
 * no entra en BLOCKS, que es lo que se usa para ver qué ocupa un horario.
 */
export const DAY: { key: "day"; label: string; from: string; to: string } = {
  key: "day",
  label: "Día",
  from: "09:00",
  to: "20:00",
};

/** Lo que se muestra y se carga en los precios: mañana, tarde y día. */
export const PRICED = [...BLOCKS, DAY];

export const PRICE_KEYS: PriceKey[] = PRICED.map((item) => item.key);

/** Los días en que abre el consultorio. Son los que se revisan buscando bloques libres. */
export const OPEN_DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes"];

/** Cómo guarda la agenda los días: en minúscula y sin tilde. */
const DAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

/** Cómo se escriben esos mismos días en pantalla. */
export const DAY_LABEL: Record<string, string> = {
  domingo: "domingo",
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábado",
};

export function toMinutes(hour: string): number {
  const [h, m] = String(hour).split(":").map(Number);
  return h * 60 + (m || 0);
}

function toHour(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Los bloques que toca un horario. Tocar un minuto alcanza: se paga el bloque entero. */
export function blocksOf(initialHour: string, finalHour: string): BlockKey[] {
  const start = toMinutes(initialHour);
  const end = toMinutes(finalHour);

  return BLOCKS.filter((block) => start < toMinutes(block.to) && end > toMinutes(block.from)).map((block) => block.key);
}

/**
 * Los pedazos de un horario que no caen en ningún bloque.
 *
 * De 12 a 15 devuelve la hora de 13 a 14; de 8 a 10, la de 8 a 9. Son los que no tienen
 * precio y el administrador valoriza a mano.
 */
export function outsideParts(initialHour: string, finalHour: string): { from: string; to: string }[] {
  const start = toMinutes(initialHour);
  const end = toMinutes(finalHour);
  const parts: [number, number][] = [];

  let cursor = start;

  for (const block of BLOCKS) {
    const from = toMinutes(block.from);
    const to = toMinutes(block.to);

    if (to <= cursor) continue;
    if (from >= end) break;
    if (from > cursor) parts.push([cursor, from]);

    cursor = Math.max(cursor, to);
    if (cursor >= end) break;
  }

  if (cursor < end) parts.push([cursor, end]);

  return parts.map(([from, to]) => ({ from: toHour(from), to: toHour(to) }));
}

/* ============================================================
   Meses
   ============================================================ */

/** "2026-09". Es la clave con la que se guarda cada cuota, y se ordena comparando texto. */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, months: number): string {
  const [year, number] = month.split("-").map(Number);
  return monthKeyOf(new Date(year, number - 1 + months, 1));
}

/** Los meses de `from` a `to`, los dos incluidos. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

/** Cuántas veces cae un día de la semana en un mes. Es lo que multiplica cada bloque. */
export function weekdayCount(month: string, day: string): number {
  const target = DAY_INDEX[day];
  if (target === undefined) return 0;

  const [year, number] = month.split("-").map(Number);
  const days = new Date(year, number, 0).getDate();
  const first = new Date(year, number - 1, 1).getDay();

  let count = 0;
  for (let date = 1; date <= days; date++) if ((first + date - 1) % 7 === target) count++;

  return count;
}

/* ============================================================
   La cuota
   ============================================================ */

/** Un horario de la agenda, con lo justo para cobrarlo. */
export interface ScheduleSlot {
  day: string;
  initialHour: string;
  finalHour: string;
  roomId: number;
  room: string;
}

/** El precio de cada bloque (y del día) de cada consultorio. Uno que falta no tiene precio. */
export type RoomPrices = Map<number, Partial<Record<PriceKey, number | null>>>;

/** El valor a mano de la parte fuera de bloque de un horario, por día y hora de inicio. */
export type ExtraPrices = Map<string, number>;

export function extraKey(day: string, initialHour: string): string {
  return `${day}|${initialHour.slice(0, 5)}`;
}

export interface BlockLine {
  roomId: number;
  room: string;
  day: string;
  block: BlockKey;
  /** Cuántas veces cae ese día en el mes. */
  times: number;
  price: number | null;
  subtotal: number;
}

/** Un día entero de 9 a 20 en un consultorio, cobrado con el precio del día. */
export interface DayLine {
  roomId: number;
  room: string;
  day: string;
  times: number;
  price: number;
  subtotal: number;
}

export interface OutsideLine {
  roomId: number;
  room: string;
  day: string;
  /** El horario entero al que pertenece. Es lo que identifica el valor a mano. */
  initialHour: string;
  finalHour: string;
  parts: { from: string; to: string }[];
  times: number;
  price: number | null;
  subtotal: number;
}

export interface ChargeBreakdown {
  blocks: BlockLine[];
  /**
   * Va aparte de `blocks` y no como un bloque más: las cuotas guardadas y las versiones
   * de la app que ya están instaladas no conocen el día, y una línea que no saben
   * nombrar les rompería el detalle. Así la ignoran y el total sigue siendo el correcto.
   */
  days: DayLine[];
  outside: OutsideLine[];
  /** La suma antes del ajuste. */
  base: number;
  /** Ajuste propio del profesional, en centésimos de punto: 1000 es un 10% más. */
  adjust: number;
  amount: number;
  /** Lo que no se pudo cobrar porque falta un precio. Dicho como se muestra. */
  missing: string[];
}

/**
 * Si los horarios de un mismo consultorio y un mismo día cubren de 9 a 20 sin cortes.
 * Horarios pegados (de 9 a 13 y de 13 a 20) también son de corrido.
 */
export function coversWholeDay(slots: { initialHour: string; finalHour: string }[]): boolean {
  const sorted = [...slots].sort((a, b) => toMinutes(a.initialHour) - toMinutes(b.initialHour));
  let cursor = toMinutes(DAY.from);

  for (const slot of sorted) {
    if (toMinutes(slot.initialHour) > cursor) break;
    cursor = Math.max(cursor, toMinutes(slot.finalHour));
  }

  return cursor >= toMinutes(DAY.to);
}

/**
 * La cuota de un mes a partir de la agenda.
 *
 * Un mismo bloque se cobra una sola vez por día aunque el profesional tenga dos horarios
 * adentro (de 9 a 10 y de 11 a 12 en el mismo consultorio siguen siendo una mañana).
 *
 * Si ese día ocupa el consultorio de 9 a 20 de corrido y el consultorio tiene precio del
 * día, se cobra el día en lugar de los bloques. Lo que quede antes de las 9 o después de
 * las 20 sigue siendo fuera de bloque.
 */
export function computeCharge(
  slots: ScheduleSlot[],
  prices: RoomPrices,
  extras: ExtraPrices,
  month: string,
  adjust = 0
): ChargeBreakdown {
  const blocks = new Map<string, BlockLine>();
  const days: DayLine[] = [];
  const outside: OutsideLine[] = [];
  const missing: string[] = [];

  // Qué días de qué consultorio van enteros.
  const grouped = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const id = `${slot.roomId}|${slot.day}`;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(slot);
  }

  const wholeDays = new Set<string>();
  for (const [id, group] of grouped) {
    const first = group[0];
    const price = prices.get(first.roomId)?.day ?? null;
    if (price === null || !coversWholeDay(group)) continue;

    wholeDays.add(id);
    const times = weekdayCount(month, first.day);
    days.push({ roomId: first.roomId, room: first.room, day: first.day, times, price, subtotal: price * times });
  }

  for (const slot of slots) {
    const times = weekdayCount(month, slot.day);
    const whole = wholeDays.has(`${slot.roomId}|${slot.day}`);

    for (const key of whole ? [] : blocksOf(slot.initialHour, slot.finalHour)) {
      const id = `${slot.roomId}|${slot.day}|${key}`;
      if (blocks.has(id)) continue;

      const price = prices.get(slot.roomId)?.[key] ?? null;
      blocks.set(id, {
        roomId: slot.roomId,
        room: slot.room,
        day: slot.day,
        block: key,
        times,
        price,
        subtotal: (price ?? 0) * times,
      });
    }

    // Con el día entero, de 13 a 14 ya está pago: queda solo lo de antes o después.
    const parts = outsideParts(slot.initialHour, slot.finalHour).filter(
      (part) => !whole || part.to <= DAY.from || part.from >= DAY.to
    );
    if (parts.length > 0) {
      const price = extras.get(extraKey(slot.day, slot.initialHour)) ?? null;
      outside.push({
        roomId: slot.roomId,
        room: slot.room,
        day: slot.day,
        initialHour: slot.initialHour.slice(0, 5),
        finalHour: slot.finalHour.slice(0, 5),
        parts,
        times,
        price,
        subtotal: (price ?? 0) * times,
      });

      if (price === null) {
        const franjas = parts.map((part) => `de ${part.from} a ${part.to}`).join(" y ");
        missing.push(`Falta el valor del ${DAY_LABEL[slot.day] ?? slot.day} ${franjas}`);
      }
    }
  }

  const lines = Array.from(blocks.values()).sort(byRoomDayBlock);

  // Un aviso por bloque sin precio y no uno por día: si la mañana de un consultorio no
  // tiene precio, falta para todos los días a la vez.
  const unpriced = new Set<string>();
  for (const line of lines) {
    if (line.price !== null) continue;
    const label = BLOCKS.find((block) => block.key === line.block)!.label.toLowerCase();
    unpriced.add(`Falta el precio de la ${label} de ${line.room}`);
  }

  const base =
    lines.reduce((sum, line) => sum + line.subtotal, 0) +
    days.reduce((sum, line) => sum + line.subtotal, 0) +
    outside.reduce((sum, line) => sum + line.subtotal, 0);

  return {
    blocks: lines,
    days: days.sort(byRoomDayBlock),
    outside: outside.sort(byRoomDayBlock),
    base,
    adjust,
    amount: applyAdjust(base, adjust),
    missing: [...unpriced, ...missing],
  };
}

const DAY_ORDER = (day: string) => (DAY_INDEX[day] ?? 7) === 0 ? 7 : DAY_INDEX[day] ?? 8;

function byRoomDayBlock(a: { room: string; day: string; block?: string }, b: { room: string; day: string; block?: string }) {
  return (
    a.room.localeCompare(b.room, "es", { numeric: true }) ||
    DAY_ORDER(a.day) - DAY_ORDER(b.day) ||
    String(a.block ?? "").localeCompare(String(b.block ?? ""))
  );
}

/**
 * Los bloques que se usan en el mes. Un día entero cuenta como sus dos bloques: es lo que
 * ocupa, y así "bloques en el mes" y el aumento en pesos por bloque siguen diciendo lo mismo.
 */
export function usesOf(breakdown: Pick<ChargeBreakdown, "blocks" | "days">): number {
  return (
    breakdown.blocks.reduce((sum, line) => sum + line.times, 0) +
    (breakdown.days ?? []).reduce((sum, line) => sum + line.times * BLOCKS.length, 0)
  );
}

/** Pesos enteros: en un alquiler los centavos no existen. */
export function applyAdjust(amount: number, adjust: number): number {
  return Math.round(amount * (1 + adjust / 10000));
}

/** Un aumento arriba de otro. Diez y diez no son veinte: son veintiuno. */
export function compoundAdjust(adjust: number, percent: number): number {
  return Math.round(((1 + adjust / 10000) * (1 + percent / 100) - 1) * 10000);
}

export function raise(amount: number, percent: number): number {
  return Math.round(amount * (1 + percent / 100));
}

/* ============================================================
   Bloques libres
   ============================================================ */

export interface RoomInfo {
  roomId: number;
  room: string;
  office: string;
}

export interface FreeBlock {
  day: string;
  block: BlockKey;
  times: number;
  price: number | null;
  subtotal: number;
}

/**
 * Los bloques que nadie usa, consultorio por consultorio.
 *
 * Un bloque con un solo horario adentro ya está alquilado entero, así que no cuenta como
 * libre aunque le sobren horas: esas horas no se pueden alquilar sueltas.
 */
export function freeBlocks(rooms: RoomInfo[], slots: ScheduleSlot[], prices: RoomPrices, month: string) {
  const taken = new Set<string>();
  for (const slot of slots) {
    for (const key of blocksOf(slot.initialHour, slot.finalHour)) taken.add(`${slot.roomId}|${slot.day}|${key}`);
  }

  return rooms.map((room) => {
    const free: FreeBlock[] = [];
    let occupied = 0;

    for (const day of OPEN_DAYS) {
      for (const key of BLOCK_KEYS) {
        if (taken.has(`${room.roomId}|${day}|${key}`)) {
          occupied++;
          continue;
        }

        const times = weekdayCount(month, day);
        const price = prices.get(room.roomId)?.[key] ?? null;
        free.push({ day, block: key, times, price, subtotal: (price ?? 0) * times });
      }
    }

    return {
      ...room,
      free,
      occupied,
      potential: free.reduce((sum, block) => sum + block.subtotal, 0),
      unpriced: free.filter((block) => block.price === null).length,
    };
  });
}

/* ============================================================
   El pago
   ============================================================ */

export type PaymentStatus = "paid" | "partial" | "unpaid" | "none";

/** El estado sale de las cifras: si la cuota sube después de pagar, pasa sola a parcial. */
export function paymentStatus(amount: number | null, paid: number): PaymentStatus {
  if (amount === null || amount <= 0) return "none";
  if (paid >= amount) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

/** El día en que vence la cuota: el mismo mes, el día que diga la configuración. */
export function dueDate(month: string, dueDay: number): string {
  return `${month}-${String(clampDueDay(dueDay)).padStart(2, "0")}`;
}

/** Hasta el 28: un vencimiento el 31 no existe en la mitad de los meses. */
export function clampDueDay(day: number): number {
  return Math.min(28, Math.max(1, Math.round(day) || 10));
}

/**
 * Si la cuota se pagó (o se está pagando) tarde.
 *
 * Pagada entera, cuenta la fecha del pago. Sin pagar o a medias, cuenta hoy: quien debe
 * la cuota pasado el vencimiento ya está pagando tarde, aunque todavía no haya pagado.
 * Las fechas van como "AAAA-MM-DD", que se comparan bien como texto.
 */
export function isLate(amount: number | null, paid: number, paidOn: string | null, due: string, today: string): boolean {
  const status = paymentStatus(amount, paid);
  if (status === "none") return false;
  if (status === "paid") return !!paidOn && paidOn > due;
  return today > due;
}
