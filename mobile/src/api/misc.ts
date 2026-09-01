import api from "./client";
import { Recurrence, RecurrenceFrequency } from "./types";

/* ---------- turnos repetibles ---------- */

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Todas las semanas",
  biweekly: "Cada dos semanas",
};

export async function findRecurrences(): Promise<Recurrence[]> {
  const { data } = await api.get("/recurrences");
  return data.data;
}

/** Marca un turno existente como repetible. endDate en null repite sin fecha de corte. */
export async function createRecurrence(
  numAppointment: number,
  frequency: RecurrenceFrequency,
  endDate: string | null
): Promise<{ idRecurrence: number; created: number; skipped: number }> {
  const { data } = await api.post("/recurrences", { numAppointment, frequency, endDate });
  return data.data;
}

/** Solo afecta a los turnos que todavía no se generaron. */
export async function updateRecurrence(
  idRecurrence: number,
  changes: { frequency?: RecurrenceFrequency; value?: number; idRoom?: number; patientEmail?: string | null; endDate?: string | null }
): Promise<void> {
  await api.patch(`/recurrences/${idRecurrence}`, changes);
}

/** Frena la generación. Los turnos ya creados quedan como están. */
export async function stopRecurrence(idRecurrence: number): Promise<void> {
  await api.delete(`/recurrences/${idRecurrence}`);
}

/* ---------- contacto ---------- */

export interface ContactInput {
  reason: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  /** Trampa para bots: si viene con algo, el backend descarta el mensaje. */
  website?: string;
}

export async function sendContactMessage(input: ContactInput): Promise<void> {
  await api.post("/contact", { ...input, website: input.website ?? "" });
}

/* ---------- asistente ---------- */

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Un botón que el asistente ofrece para ir a una pantalla de la app. */
export type ChatLink = { label: string; path: string };

export interface ChatReply {
  answer: string;
  newHistory: ChatMessage[];
  links: ChatLink[];
  /** El asistente tocó turnos: lo que haya abierto quedó viejo. */
  changed: boolean;
  /**
   * Acción esperando un "sí". Se devuelve tal cual en el mensaje siguiente: adentro está
   * lo que se va a hacer, firmado por el backend, así que el asistente no puede cambiar
   * el turno entre lo que preguntó y lo que ejecuta.
   */
  pendingAction: string | null;
}

export async function askAssistant(
  message: string,
  history: ChatMessage[],
  pendingAction: string | null
): Promise<ChatReply> {
  const { data } = await api.post("/assistant/message", { message, history, pendingAction });
  const reply = data.data;

  return {
    answer: reply.content,
    newHistory: reply.chatHistory,
    links: reply.links ?? [],
    changed: !!reply.changed,
    pendingAction: reply.pendingAction?.token ?? null,
  };
}
