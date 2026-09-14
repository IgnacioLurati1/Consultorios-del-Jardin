import api from "./client";
import type { WaitlistLimits } from "../lib/waitlist";

type Who = { email: string; name: string; surname: string };

/** Un aviso que ya le llegó: qué horario se liberó. */
export interface WaitlistNotice {
  /** "AAAA-MM-DD". */
  date: string;
  initialHour: string;
  at: string;
}

/** La inscripción del paciente en la lista de un profesional. */
export interface WaitlistEntry {
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
  entry: WaitlistEntry | null;
  /** Todas las listas en las que está ahora. */
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

export function waitlistStatus(professionalEmail: string): Promise<WaitlistStatus> {
  return api.get(`/waitlist/status/${encodeURIComponent(professionalEmail)}`).then((response) => response.data.data);
}

export function joinWaitlist(
  professionalEmail: string,
  request: { days: number[]; fromHour: string; toHour: string }
): Promise<WaitlistEntry> {
  return api.post(`/waitlist/${encodeURIComponent(professionalEmail)}`, request).then((response) => response.data.data);
}

export function leaveWaitlist(professionalEmail: string): Promise<void> {
  return api.delete(`/waitlist/${encodeURIComponent(professionalEmail)}`).then(() => undefined);
}

/** Quiénes esperan al profesional logueado. */
export function myWaitlist(): Promise<WaitingPatient[]> {
  return api.get("/waitlist/professional").then((response) => response.data.data);
}

/** El profesional saca a alguien de su lista. A la persona no le llega nada. */
export function removeFromMyWaitlist(id: number): Promise<void> {
  return api.delete(`/waitlist/professional/${id}`).then(() => undefined);
}

/** Cuánta gente recibiría el aviso si el profesional cancela este turno ahora. */
export function waitlistMatches(numAppointment: number): Promise<number> {
  return api.get(`/waitlist/matches/${numAppointment}`).then((response) => Number(response.data.data?.count ?? 0));
}
