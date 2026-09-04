import { Appointment, PaymentState } from "../api/types";
import { Colors } from "../theme/tokens";

/**
 * El estado de un turno es una palabra o, si se canceló, el timestamp de cuándo. Ese
 * detalle del modelo no tiene por qué salir a la pantalla: acá se traduce a algo que se
 * pueda leer y a un color.
 */
export type StateKey = "pending" | "accepted" | "assisted" | "missed" | "cancelled";

export function stateOf(appointment: Pick<Appointment, "state">): StateKey {
  switch (appointment.state) {
    case "pending":
    case "accepted":
    case "assisted":
    case "missed":
      return appointment.state;
    default:
      return "cancelled";
  }
}

export const STATE_LABELS: Record<StateKey, string> = {
  pending: "A confirmar",
  accepted: "Confirmado",
  assisted: "Asistió",
  missed: "No vino",
  cancelled: "Cancelado",
};

/** Fondo y texto de la etiqueta de estado, en el modo que esté el teléfono. */
export function stateColors(key: StateKey, colors: Colors): { bg: string; fg: string } {
  switch (key) {
    case "accepted":
      return { bg: colors.greenSoft, fg: colors.greenDark };
    case "pending":
      return { bg: colors.warnSoft, fg: colors.warn };
    case "cancelled":
      return { bg: colors.dangerSoft, fg: colors.danger };
    default:
      return { bg: colors.sunken, fg: colors.muted };
  }
}

/* ---------- cobro ---------- */

export const PAYMENT_LABELS: Record<PaymentState, string> = {
  unpaid: "Sin cobrar",
  partial: "Pagó una parte",
  paid: "Pagado",
};

/** Lo que se ofrece elegir, en el orden en que se elige. */
export const PAYMENT_OPTIONS: { key: PaymentState; label: string; description: string }[] = [
  { key: "unpaid", label: "No pagó", description: "Queda en la lista de lo que falta cobrar." },
  { key: "partial", label: "Pagó una parte", description: "Se anota cuánto entró y cuánto queda debiendo." },
  { key: "paid", label: "Pagó", description: "El turno queda saldado." },
];

/** Lo que falta cobrar de un turno. Es el mismo cálculo que hace el backend. */
export function pendingAmount(appointment: Pick<Appointment, "paymentState" | "paidAmount" | "value">): number {
  const value = appointment.value ?? 0;
  if (appointment.paymentState === "partial") return Math.max(0, value - (appointment.paidAmount ?? 0));
  if (appointment.paymentState === "unpaid") return value;
  return 0;
}

/**
 * Cómo se lee el cobro, con el color de su etiqueta.
 *
 * Null cuando no hay nada que decir: los turnos anteriores a este registro no tienen
 * estado de cobro, y mostrarlos como impagos sería afirmar algo que nadie sabe.
 */
export function describePayment(
  appointment: Pick<Appointment, "paymentState" | "paidAmount" | "value">
): { label: string; tone: "green" | "warn" | "danger" } | null {
  switch (appointment.paymentState) {
    case "paid":
      return { label: "Pagado", tone: "green" };
    case "partial":
      return { label: `Pagó $${appointment.paidAmount ?? 0} de $${appointment.value ?? 0}`, tone: "warn" };
    case "unpaid":
      return { label: "Sin cobrar", tone: "danger" };
    default:
      return null;
  }
}

/** Un turno que todavía va a pasar y no se canceló. */
export function isUpcoming(appointment: Appointment, now = new Date()): boolean {
  const key = stateOf(appointment);
  if (key === "cancelled" || key === "assisted" || key === "missed") return false;

  const day = appointment.date.slice(0, 10);
  const todayISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  if (day > todayISO) return true;
  if (day < todayISO) return false;

  return appointment.finalHour.slice(0, 5) >= `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Cómo se llama a la otra persona del turno, según de qué lado esté quien mira.
 *
 * Las relaciones que el backend no popula llegan como el email pelado en vez de un
 * objeto, así que acá no se puede dar por sentado que haya un nombre adentro: si no lo
 * hay, es preferible mostrar el email que "undefined undefined".
 */
export function counterpart(appointment: Appointment, viewerEmail: string): string {
  const viewerIsProfessional = emailOf(appointment.professional) === viewerEmail;
  const other = viewerIsProfessional ? appointment.patient : appointment.professional;

  if (!other) return "Sin paciente asignado";
  return fullName(other) || emailOf(other) || "Sin datos";
}

/** El email de una relación, esté populada o no. */
function emailOf(person: unknown): string {
  if (typeof person === "string") return person;
  if (person && typeof person === "object" && "email" in person) return String((person as { email: string }).email);
  return "";
}

export function fullName(person: { name?: string; surname?: string } | null | undefined): string {
  if (!person) return "";
  return `${person.name ?? ""} ${person.surname ?? ""}`.trim();
}

/** Las iniciales que van en el círculo del avatar. */
export function initials(person: { name?: string; surname?: string } | null | undefined): string {
  const first = person?.name?.trim()?.[0] ?? "";
  const last = person?.surname?.trim()?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}
