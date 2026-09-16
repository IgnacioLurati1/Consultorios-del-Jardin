import api from "./client";

/**
 * El cobro del alquiler a los profesionales. Solo lo usa el administrador, igual que en
 * la página, y habla con las mismas rutas.
 *
 * Las reglas viven en el backend (rent.rules.ts). La planilla de Excel queda para la
 * página: en el teléfono no hay dónde abrirla con comodidad.
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

export interface Payment {
  status: "paid" | "partial" | "unpaid";
  paidAmount?: number;
  paidOn?: string;
}

/** Todo lo de alquileres contesta `{ data }`. */
type Envelope<T> = { data: T };
const data = <T,>(response: { data: Envelope<T> }): T => response.data.data;
const person = (email: string) => encodeURIComponent(email);

export function findRentMonth(month: string): Promise<RentMonth> {
  return api.get<Envelope<RentMonth>>(`/rent/month/${month}`).then(data);
}

export function setRentAmount(month: string, email: string, amount: number): Promise<RentMonth> {
  return api.put<Envelope<RentMonth>>(`/rent/charges/${month}/${person(email)}/amount`, { amount }).then(data);
}

export function setRentPayment(month: string, email: string, payment: Payment): Promise<RentMonth> {
  return api.put<Envelope<RentMonth>>(`/rent/charges/${month}/${person(email)}/payment`, payment).then(data);
}

export function findRoomPrices(month?: string): Promise<RoomPrices> {
  return api.get<Envelope<RoomPrices>>("/rent/prices", { params: month ? { month } : {} }).then(data);
}

export function saveRoomPrices(
  fromMonth: string,
  prices: { idRoom: number; block: PriceKey; price: number | null }[]
): Promise<RoomPrices> {
  return api.put<Envelope<RoomPrices>>("/rent/prices", { fromMonth, prices }).then(data);
}

export function saveDueDay(dueDay: number): Promise<{ dueDay: number }> {
  return api.put<Envelope<{ dueDay: number }>>("/rent/settings", { dueDay }).then(data);
}

export function previewCalculation(from: string): Promise<CalculationPreview> {
  return api.get<Envelope<CalculationPreview>>("/rent/calculate", { params: { from } }).then(data);
}

export function applyCalculation(body: {
  fromMonth: string;
  emails: string[];
  extras: { email: string; day: string; initialHour: string; price: number | null }[];
}): Promise<{ updated: number }> {
  return api.post<Envelope<{ updated: number }>>("/rent/calculate", body).then(data);
}

export function applyIncrease(body: {
  percent: number;
  fromMonth: string;
  emails: string[];
  prices: boolean;
}): Promise<{ raised: number; skipped: string[]; prices: number }> {
  return api.post<Envelope<{ raised: number; skipped: string[]; prices: number }>>("/rent/increase", body).then(data);
}
