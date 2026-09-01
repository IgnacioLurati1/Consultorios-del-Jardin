import { Appointment } from "../api/types";
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

/** Cómo se llama a la otra persona del turno según quién esté mirando. */
export function counterpart(appointment: Appointment, viewerEmail: string): string {
  const isProfessional = appointment.professional?.email === viewerEmail;
  const other = isProfessional ? appointment.patient : appointment.professional;

  if (!other) return "Sin paciente asignado";
  return `${other.name} ${other.surname}`.trim();
}

export function fullName(person: { name: string; surname: string } | null | undefined): string {
  if (!person) return "";
  return `${person.name} ${person.surname}`.trim();
}

/** Las iniciales que van en el círculo del avatar. */
export function initials(person: { name?: string; surname?: string } | null | undefined): string {
  const first = person?.name?.trim()?.[0] ?? "";
  const last = person?.surname?.trim()?.[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}
