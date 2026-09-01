import type { Office, Person } from "../types.ts";

/** Slot libre devuelto por /appointments/getAppointments (ya no tiene tipo de turno). */
export type partialAppointment = { date: Date; initialHour: string; finalHour: string };

export interface confirmAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: partialAppointment;
  professional: Person;
  office: Office;
  onCreate: (newAppointment: { date: string; initialHour: string; professionalEmail: string; officeId: string }) => Promise<void>;
}

/* ============================================================
   Estados de un turno.
   Cancelar guarda un ISO timestamp en `state` (para que el índice único deje
   volver a sacar turno en la misma franja), así que cualquier estado que no
   esté en esta lista significa "cancelado".
   ============================================================ */

export const APPOINTMENT_STATES = ["pending", "accepted", "assisted", "missed"] as const;
export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

/** Estados que el profesional puede marcar a mano una vez pasado el turno. */
export const CLOSING_STATES: AppointmentState[] = ["assisted", "missed"];

export function isCancelled(state: string): boolean {
  return !APPOINTMENT_STATES.includes(state as AppointmentState);
}

export function describeState(state: string): { label: string; className: string } {
  switch (state) {
    case "pending":
      return { label: "Pendiente", className: "adm-badge adm-badge-amber" };
    case "accepted":
      return { label: "Confirmado", className: "adm-badge adm-badge-green" };
    case "assisted":
      return { label: "Asistió", className: "adm-badge adm-badge-grey" };
    case "missed":
      return { label: "No vino", className: "adm-badge adm-badge-red" };
    default:
      return { label: "Cancelado", className: "adm-badge adm-badge-grey" };
  }
}

/* ---------- helpers de fecha/hora ---------- */

/** MySQL devuelve "09:00:00"; para mostrar alcanza con HH:MM. */
export function shortHour(hour: string): string {
  return hour?.slice(0, 5) ?? "";
}

/** Fecha del turno como Date local, sin que el huso la corra un día. */
export function appointmentDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date);
}

export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: sameMonth ? undefined : "short" });
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(monday);
  return `${fmt.format(monday)} al ${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(sunday)} · ${month}`;
}
