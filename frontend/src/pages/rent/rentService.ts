import api from "../../axios";

/**
 * El cobro del alquiler a los profesionales. Solo lo usa el administrador.
 *
 * Las reglas viven en el backend (rent.rules.ts). Acá están los tipos de lo que llega y
 * un par de cuentas chicas para mostrar una previa mientras se escribe, que después el
 * servidor vuelve a hacer al guardar.
 */

export type BlockKey = "morning" | "afternoon";
/** Lo que tiene precio: los dos bloques y el día entero, de 9 a 20 de corrido. */
export type PriceKey = BlockKey | "day";
export type PaymentStatus = "paid" | "partial" | "unpaid" | "none";
export type RentKind = "fixed" | "blocks";

export interface Block {
  key: PriceKey;
  label: string;
  from: string;
  to: string;
}

export interface BlockLine {
  roomId: number;
  room: string;
  day: string;
  block: BlockKey;
  times: number;
  price: number | null;
  subtotal: number;
  /** Solo en la previa de "Calcular": quién más usa ese bloque. */
  sharedWith?: string[];
}

/** Un día entero de 9 a 20 de corrido, cobrado con el precio del día. */
export interface DayLine {
  roomId: number;
  room: string;
  day: string;
  times: number;
  price: number;
  subtotal: number;
  /** Solo en la previa de "Calcular": quién más usa el consultorio ese día. */
  sharedWith?: string[];
}

export interface OutsideLine {
  roomId: number;
  room: string;
  day: string;
  initialHour: string;
  finalHour: string;
  parts: { from: string; to: string }[];
  times: number;
  price: number | null;
  subtotal: number;
}

export interface Breakdown {
  blocks: BlockLine[];
  /** Opcional: las cuotas guardadas antes del precio por día no lo tienen. */
  days?: DayLine[];
  outside: OutsideLine[];
  base: number;
  /** Aumento propio, en centésimos de punto: 1000 es un 10%. */
  adjust: number;
  amount: number;
  missing: string[];
}

export interface RentRow {
  email: string;
  name: string;
  surname: string;
  speciality: string | null;
  active: boolean;
  amount: number | null;
  kind: RentKind | null;
  /** Todavía no hay cuota guardada: es lo que saldría con las reglas de hoy. */
  projected: boolean;
  blocks: number | null;
  paidAmount: number;
  paidOn: string | null;
  pending: number;
  status: PaymentStatus;
  late: boolean;
  warnings: string[];
  breakdown: Breakdown | null;
  hasSchedule: boolean | null;
}

export interface RentMonth {
  month: string;
  label: string;
  current: string;
  next: string;
  firstMonth: string;
  dueDay: number;
  dueDate: string;
  rows: RentRow[];
  totals: {
    due: number;
    collected: number;
    pending: number;
    paid: number;
    partial: number;
    unpaid: number;
    late: number;
    withoutAmount: number;
  };
}

export interface RoomPrice {
  idRoom: number;
  room: string;
  office: string;
  prices: Partial<Record<PriceKey, number | null>>;
  /** Lo que ya quedó programado para el mes siguiente. */
  next: Partial<Record<PriceKey, number | null>>;
}

export interface RoomPrices {
  month: string;
  label: string;
  blocks: Block[];
  rooms: RoomPrice[];
}

export interface PreviewRow {
  email: string;
  name: string;
  surname: string;
  speciality: string | null;
  before: number | null;
  amount: number;
  blocks: number;
  breakdown: Breakdown;
}

export interface CalculationPreview {
  fromMonth: string;
  label: string;
  blocks: Block[];
  rows: PreviewRow[];
  withoutSchedule: { email: string; name: string; surname: string }[];
}

export interface FreeBlock {
  day: string;
  block: BlockKey;
  times: number;
  price: number | null;
  subtotal: number;
}

export interface FreeBlocksReport {
  month: string;
  label: string;
  blocks: Block[];
  rooms: { roomId: number; room: string; office: string; free: FreeBlock[]; occupied: number; potential: number; unpriced: number }[];
  totals: { free: number; times: number; potential: number; unpriced: number };
}

export interface IncreaseSimulation {
  month: string;
  label: string;
  mode: "percent" | "amount";
  value: number;
  /** Las cuotas del mes, hoy. */
  monthly: number;
  /** Cuántos bloques se usan en el mes. */
  times: number;
  added: number;
  projected: number;
  yearly: number;
  free: { blocks: number; times: number; potential: number; after: number };
}

export interface Payment {
  status: "paid" | "partial" | "unpaid";
  paidAmount?: number;
  paidOn?: string;
}

interface RequestError {
  response?: { data?: unknown };
  message?: string;
}

function unwrap(err: RequestError): never {
  const body = err.response?.data as { message?: string } | undefined;
  throw new Error(body?.message || err.message);
}

/** El mensaje de un error, para mostrarlo tal cual. */
export function errorText(problem: unknown): string {
  return problem instanceof Error ? problem.message : String(problem);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Todo lo de alquileres contesta `{ data }`. */
type Envelope<T> = { data: T };
const data = <T,>(response: { data: Envelope<T> }): T => response.data.data;
const person = (email: string) => encodeURIComponent(email);

export function findRentMonth(month: string): Promise<RentMonth> {
  return api.get<Envelope<RentMonth>>(`/rent/month/${month}`).then(data).catch(unwrap);
}

export function setRentAmount(month: string, email: string, amount: number): Promise<RentMonth> {
  return api.put<Envelope<RentMonth>>(`/rent/charges/${month}/${person(email)}/amount`, { amount }).then(data).catch(unwrap);
}

export function setRentPayment(month: string, email: string, payment: Payment): Promise<RentMonth> {
  return api.put<Envelope<RentMonth>>(`/rent/charges/${month}/${person(email)}/payment`, payment).then(data).catch(unwrap);
}

export function findRoomPrices(month?: string): Promise<RoomPrices> {
  return api
    .get<Envelope<RoomPrices>>("/rent/prices", { params: month ? { month } : {} })
    .then(data)
    .catch(unwrap);
}

export function saveRoomPrices(fromMonth: string, prices: { idRoom: number; block: PriceKey; price: number | null }[]): Promise<RoomPrices> {
  return api.put<Envelope<RoomPrices>>("/rent/prices", { fromMonth, prices }).then(data).catch(unwrap);
}

export function saveDueDay(dueDay: number): Promise<{ dueDay: number }> {
  return api.put<Envelope<{ dueDay: number }>>("/rent/settings", { dueDay }).then(data).catch(unwrap);
}

export function previewCalculation(from: string): Promise<CalculationPreview> {
  return api.get<Envelope<CalculationPreview>>("/rent/calculate", { params: { from } }).then(data).catch(unwrap);
}

export function applyCalculation(body: {
  fromMonth: string;
  emails: string[];
  extras: { email: string; day: string; initialHour: string; price: number | null }[];
}): Promise<{ updated: number }> {
  return api.post<Envelope<{ updated: number }>>("/rent/calculate", body).then(data).catch(unwrap);
}

export function applyIncrease(body: {
  percent: number;
  fromMonth: string;
  emails: string[];
  prices: boolean;
}): Promise<{ raised: number; skipped: string[]; prices: number }> {
  return api
    .post<Envelope<{ raised: number; skipped: string[]; prices: number }>>("/rent/increase", body)
    .then(data)
    .catch(unwrap);
}

export function findFreeBlocks(month: string): Promise<FreeBlocksReport> {
  return api.get<Envelope<FreeBlocksReport>>("/rent/potential/free-blocks", { params: { month } }).then(data).catch(unwrap);
}

export function simulateIncrease(month: string, mode: "percent" | "amount", value: number): Promise<IncreaseSimulation> {
  return api
    .get<Envelope<IncreaseSimulation>>("/rent/potential/increase", { params: { month, mode, value } })
    .then(data)
    .catch(unwrap);
}

/**
 * Baja la planilla del mes. Se pide con la sesión puesta y se guarda a mano: un enlace
 * directo al servidor no lleva el token (ver downloadCalendar en importService.ts).
 */
export async function downloadRentExcel(month: string): Promise<void> {
  try {
    const response = await api.get(`/rent/month/${month}/export`, { responseType: "blob" });

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alquileres-${month}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // El error llega como blob, igual que el archivo: hay que leerlo para mostrar lo que
    // dice el servidor en vez de un "Request failed" genérico.
    const body = (err as RequestError).response?.data;
    if (body instanceof Blob) {
      try {
        throw new Error(JSON.parse(await body.text()).message);
      } catch (parsed) {
        if (parsed instanceof Error && parsed.message) throw parsed;
      }
    }
    unwrap(err as RequestError);
  }
}

/* ============================================================
   Cómo se escribe
   ============================================================ */

export const DAY_LABEL: Record<string, string> = {
  lunes: "lunes",
  martes: "martes",
  miercoles: "miércoles",
  jueves: "jueves",
  viernes: "viernes",
  sabado: "sábado",
  domingo: "domingo",
};

export const BLOCK_LABEL: Record<PriceKey, string> = { morning: "Mañana", afternoon: "Tarde", day: "Día" };

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: "Pagó",
  partial: "Pagó una parte",
  unpaid: "Sin pagar",
  none: "Sin cuota",
};

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-09". */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, months: number): string {
  const [year, number] = month.split("-").map(Number);
  return monthKeyOf(new Date(year, number - 1 + months, 1));
}

/** "septiembre 2026". */
export function monthName(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return `${MONTH_NAMES[number - 1]} ${year}`;
}

/** Hoy, como lo espera un input de fecha. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "2026-09-14" → "14/09/2026". Solo reordena el texto: no pasa por Date. */
export function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** Un monto escrito en un campo, o null si no es un número entero de pesos. */
export function parseMoney(value: string): number | null {
  const clean = value.trim();
  if (!clean) return null;
  const number = Number(clean);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function formatAdjust(adjust: number): string {
  const percent = adjust / 100;
  return `${percent > 0 ? "+" : ""}${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}
