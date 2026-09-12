import api from "../../../axios";
import type { WaitlistLimits } from "./waitlistRules.ts";

type Who = { email: string; name: string; surname: string };

/** Un aviso que ya le llegó: qué horario se liberó. */
export interface WaitlistNotice {
  /** "AAAA-MM-DD". */
  date: string;
  initialHour: string;
  at: string;
}

/** La lista en la que está el paciente con un profesional. */
export interface WaitlistEntryView {
  id: number;
  professional: Who;
  /** Días de la semana con el número de `getDay()`. */
  days: number[];
  fromHour: string;
  toHour: string;
  createdAt: string;
  expiresAt: string;
  noticesSent: number;
  notices: WaitlistNotice[];
}

export interface WaitlistStatus {
  /** Si el profesional trabaja con lista de espera. */
  enabled: boolean;
  /** Si su lista está llena. */
  full: boolean;
  entry: WaitlistEntryView | null;
  /** Todas las listas en que está ahora. */
  active: Who[];
  monthUsed: number;
  limits: WaitlistLimits;
}

/** Una persona en la lista del profesional logueado. */
export interface WaitingPatient {
  id: number;
  patient: Who & { phoneNumber: string | null };
  days: number[];
  fromHour: string;
  toHour: string;
  createdAt: string;
  expiresAt: string;
  noticesSent: number;
}

/** Lo que trae un error de axios que interesa acá. */
type HttpError = { response?: { data?: { message?: string; code?: string } }; message?: string };

/** El error con el mensaje del servidor, y su código si trae uno. */
function unwrap(err: HttpError): never {
  const error = new Error(err.response?.data?.message || err.message) as Error & { code?: string };
  error.code = err.response?.data?.code;
  throw error;
}

/** El texto de un error para mostrar en pantalla, venga de donde venga. */
export function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Ocurrió un error. Reintentar en unos minutos";
}

export function getWaitlistStatus(professionalEmail: string): Promise<WaitlistStatus> {
  return api
    .get(`/waitlist/status/${encodeURIComponent(professionalEmail)}`)
    .then((response) => response.data.data)
    .catch(unwrap);
}

export function joinWaitlist(
  professionalEmail: string,
  request: { days: number[]; fromHour: string; toHour: string }
): Promise<WaitlistEntryView> {
  return api
    .post(`/waitlist/${encodeURIComponent(professionalEmail)}`, request)
    .then((response) => response.data.data)
    .catch(unwrap);
}

export function leaveWaitlist(professionalEmail: string): Promise<void> {
  return api
    .delete(`/waitlist/${encodeURIComponent(professionalEmail)}`)
    .then(() => undefined)
    .catch(unwrap);
}

/** Quiénes esperan al profesional logueado. */
export function findMyWaitlist(): Promise<WaitingPatient[]> {
  return api
    .get("/waitlist/professional")
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** El profesional saca a alguien de su lista. A la persona no le llega nada. */
export function removeFromMyWaitlist(id: number): Promise<void> {
  return api
    .delete(`/waitlist/professional/${id}`)
    .then(() => undefined)
    .catch(unwrap);
}

/** Cuánta gente recibiría el aviso si el profesional cancela este turno ahora. */
export function countWaitlistMatches(numAppointment: number): Promise<number> {
  return api
    .get(`/waitlist/matches/${numAppointment}`)
    .then((response) => Number(response.data.data?.count ?? 0))
    .catch(unwrap);
}
