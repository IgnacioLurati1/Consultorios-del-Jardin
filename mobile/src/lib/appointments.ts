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

/** Debajo de esto la baja se marca aparte. Es lo que separa avisar de avisar tarde. */
export const SHORT_NOTICE_HOURS = 24;

/**
 * Cuándo dio de baja el paciente el turno, y con cuánta anticipación.
 *
 * Devuelve null cuando no hay nada que contar. Puede ser que la baja la haya hecho el
 * profesional, que del lado de su propia agenda no es algo para mirar después, o que el
 * turno sea anterior a que se guardara este dato. Que el campo falte también es lo normal
 * contra un servidor todavía sin este cambio, así que no es un error.
 *
 * La hora del turno se arma en la zona del teléfono, que es donde queda el consultorio, y
 * no en UTC como el resto de las fechas de acá: esto se compara contra un instante real.
 *
 * `hours` puede dar negativo, y eso también dice algo: el aviso llegó con el turno ya
 * empezado.
 */
export function cancellationNotice(
  appointment: Pick<Appointment, "date" | "initialHour" | "patientCancelledAt">
): { at: Date; hours: number; short: boolean } | null {
  if (!appointment.patientCancelledAt) return null;

  const at = new Date(appointment.patientCancelledAt);
  if (Number.isNaN(at.getTime())) return null;

  const [year, month, day] = String(appointment.date).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const [hour, minute] = appointment.initialHour.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute || 0, 0, 0);

  const hours = (start.getTime() - at.getTime()) / 3_600_000;
  return { at, hours, short: hours < SHORT_NOTICE_HOURS };
}

/**
 * Los turnos de un día que hay que ver, cancelados incluidos pero no todos.
 *
 * De los cancelados queda uno solo: el que el paciente dio de baja con menos de un día de
 * aviso. El resto se liberó con tiempo y probablemente ya lo tomó otro, así que no explica
 * ningún hueco de hoy. Este sí: el horario quedó vacío y no hubo tiempo de ofrecérselo a
 * nadie, y si no aparece en el día no hay dónde enterarse.
 *
 * Es la misma regla que el panel del profesional de la página, escrita una vez para que
 * las dos pantallas no se vayan separando.
 */
export function delDia<T extends Pick<Appointment, "date" | "initialHour" | "state" | "patientCancelledAt">>(
  appointments: T[]
): T[] {
  return appointments.filter(
    (appointment) => stateOf(appointment) !== "cancelled" || !!cancellationNotice(appointment)?.short
  );
}

export const STATE_LABELS: Record<StateKey, string> = {
  pending: "A confirmar",
  accepted: "Confirmado",
  assisted: "Asistió",
  missed: "No vino",
  cancelled: "Cancelado",
};

/**
 * Fondo y texto de la etiqueta de estado, en el modo que esté el teléfono.
 *
 * "No vino" va en rojo y "Asistió" en gris. Los dos son turnos que ya pasaron, pero uno
 * es la agenda cumplida y el otro es un horario que se perdió: dejarlos del mismo gris
 * obligaba a leer las dos palabras para distinguirlos, que es justo lo que una etiqueta
 * de color tiene que ahorrar.
 */
export function stateColors(key: StateKey, colors: Colors): { bg: string; fg: string } {
  switch (key) {
    case "accepted":
      return { bg: colors.greenSoft, fg: colors.greenDark };
    case "pending":
      return { bg: colors.warnSoft, fg: colors.warn };
    case "missed":
      return { bg: colors.dangerSoft, fg: colors.danger };
    default:
      return { bg: colors.sunken, fg: colors.muted };
  }
}

/**
 * El color con el que se escribe la hora de un turno en una lista.
 *
 * Es el mismo del cartel de estado, y va sobre el dato que la vista busca primero. Recorrer
 * una agenda es buscar un horario; que ese horario ya diga en qué estado está ahorra leer
 * el cartel de la derecha renglón por renglón.
 *
 * Distinto de `stateAccent`, que pinta una línea: una línea puede ser tan tenue como el
 * borde de una tarjeta, un texto no. Cancelado va en apagado y no en el gris del borde,
 * que sobre el fondo no se leería.
 */
export function stateInk(key: StateKey, colors: Colors): string {
  switch (key) {
    case "accepted":
      return colors.greenDark;
    case "pending":
      return colors.warn;
    case "missed":
      return colors.danger;
    default:
      return colors.muted;
  }
}

/**
 * El color con el que se marca un turno en una lista.
 *
 * Es una sola línea de color al lado de la hora, y su trabajo es que la agenda del día se
 * pueda recorrer sin leerla: de un vistazo se ve cuántos quedan por confirmar, cuáles ya
 * se atendieron y cuál se perdió. El texto sigue diciendo lo mismo que antes; el color no
 * reemplaza nada, adelanta.
 *
 * Cancelado se lleva el gris más apagado de todos, no el rojo: el rojo es para el turno
 * que se perdió sin avisar, que es el que cuesta plata. Uno cancelado a tiempo dejó el
 * horario libre y no es un problema.
 */
export function stateAccent(key: StateKey, colors: Colors): string {
  switch (key) {
    case "accepted":
      return colors.green;
    case "pending":
      return colors.warn;
    case "missed":
      return colors.danger;
    case "assisted":
      return colors.muted;
    default:
      return colors.border;
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
