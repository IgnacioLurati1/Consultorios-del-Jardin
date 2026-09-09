import type { Office, PaymentState, Person } from "../types.ts";

/** Slot libre devuelto por /appointments/getAppointments (ya no tiene tipo de turno). */
export type partialAppointment = { date: Date; initialHour: string; finalHour: string };

export interface confirmAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: partialAppointment;
  professional: Person;
  office: Office;
  onCreate: (newAppointment: { date: string; initialHour: string; professionalEmail: string; officeId: string }) => Promise<void>;
  /** Por qué esta persona no puede pedir este turno. En null lo pide como siempre. */
  blockedReason?: string | null;
}

/**
 * Por qué la persona que está mirando la agenda no puede sacar turno, o null si puede.
 *
 * El administrador entra a las agendas porque mirarlas es parte de su trabajo, pero su
 * cuenta no es la de alguien que se atiende: un turno suyo le ocuparía el módulo a un
 * paciente y quedaría sin historia clínica y sin nadie a quien avisarle. Antes la pantalla
 * se lo ofrecía igual y el turno se creaba.
 *
 * Se dice acá y no escondido en la ventana de confirmar para que sea una sola frase, la
 * misma en todos lados. El backend además lo rechaza, que es lo que de verdad lo impide.
 */
export function bookingBlockedFor(type: string | undefined): string | null {
  if (type === "admin") {
    return "Entraste como administrador y desde esta cuenta no se sacan turnos. Podés mirar las agendas, pero para pedir uno hace falta entrar con una cuenta de paciente.";
  }

  return null;
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

/**
 * El turno que el profesional sacó para sí mismo con un colega del consultorio.
 *
 * En su agenda estos son la excepción: no los da, los recibe. Todo lo que la pantalla
 * ofrece hacer con un turno —cambiarle el estado, escribir el registro, cobrarlo— es de
 * quien atiende, y en estos el que mira es el paciente. Por eso se pregunta turno por
 * turno y no una sola vez por el tipo de cuenta.
 *
 * Hasta que existió esto, un turno así no aparecía en ningún lado del lado del
 * profesional: lo sacaba y después no tenía dónde ver ni cuándo era.
 */
export function isOwnBooking(appointment: { patient?: Person | null }, user: Pick<Person, "type" | "email">): boolean {
  return user.type === "professional" && appointment.patient?.email === user.email;
}

/* ============================================================
   Baja del turno hecha por el paciente.
   ============================================================ */

/** Debajo de esto la baja se marca aparte. Es lo que separa avisar de avisar tarde. */
export const SHORT_NOTICE_HOURS = 24;

/**
 * Cuándo dio de baja el paciente el turno, y con cuánta anticipación.
 *
 * Devuelve null cuando no hay nada que contar. Puede ser que la baja la haya hecho el
 * profesional, que del lado de su propia agenda no es una cosa para mirar después, o que
 * el turno sea anterior a que se guardara este dato. El campo llega o no llega según qué
 * versión del servidor esté publicada, así que el que falte es un caso normal y no un
 * error.
 *
 * `hours` puede dar negativo, y eso también dice algo: la baja llegó cuando el turno ya
 * había arrancado.
 */
export function cancellationNotice(appointment: {
  date: string | Date;
  initialHour: string;
  patientCancelledAt?: string | null;
}): { at: Date; hours: number; short: boolean } | null {
  if (!appointment.patientCancelledAt) return null;

  const at = new Date(appointment.patientCancelledAt);
  if (Number.isNaN(at.getTime())) return null;

  // Copia, porque `appointmentDate` devuelve el mismo objeto cuando ya le llega un Date
  // y abajo se le cambia la hora.
  const start = new Date(appointmentDate(appointment.date));
  const [hour, minute] = appointment.initialHour.split(":").map(Number);
  start.setHours(hour, minute ?? 0, 0, 0);

  const hours = (start.getTime() - at.getTime()) / 3_600_000;
  return { at, hours, short: hours < SHORT_NOTICE_HOURS };
}

/** "12/9 a las 14:30", que es como se lee una baja en pantalla. */
export function formatCancellation(at: Date): string {
  const day = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(at);
  const time = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return `${day} a las ${time}`;
}

/* ============================================================
   Cobro de un turno.
   ============================================================ */

/** Lo que se ofrece elegir, en el orden en que se elige. */
export const PAYMENT_OPTIONS: { value: PaymentState; label: string }[] = [
  { value: "unpaid", label: "No pagó" },
  { value: "partial", label: "Pagó una parte" },
  { value: "paid", label: "Pagó" },
];

/**
 * Cómo se lee el cobro de un turno, con su color.
 *
 * Devuelve null cuando no hay nada que decir: los turnos anteriores a que existiera este
 * registro no tienen estado de cobro, y mostrarlos como impagos sería afirmar algo que
 * nadie sabe. Sin cobrar y cobrado a medias van en colores distintos porque son dos
 * conversaciones distintas con el paciente.
 */
export function describePayment(appointment: {
  paymentState?: PaymentState | null;
  paidAmount?: number | null;
  value?: number | null;
}): { label: string; className: string } | null {
  switch (appointment.paymentState) {
    case "paid":
      return { label: "Pagado", className: "adm-badge adm-badge-green" };
    case "partial":
      return {
        label: `Pagó $${appointment.paidAmount ?? 0} de $${appointment.value ?? 0}`,
        className: "adm-badge adm-badge-amber",
      };
    case "unpaid":
      return { label: "Sin cobrar", className: "adm-badge adm-badge-red" };
    default:
      return null;
  }
}

/** Lo que falta cobrar de un turno. Es el mismo cálculo que hace el backend. */
export function pendingAmount(appointment: { paymentState?: PaymentState | null; paidAmount?: number | null; value?: number | null }): number {
  const value = appointment.value ?? 0;
  if (appointment.paymentState === "partial") return Math.max(0, value - (appointment.paidAmount ?? 0));
  if (appointment.paymentState === "unpaid") return value;
  return 0;
}

/**
 * El color de un estado, para lo que no es el cartel.
 *
 * La hora y la franja de la izquierda de un renglón se pintan con esto, así la agenda se
 * recorre de arriba abajo sin leer los carteles uno por uno. Está separado de
 * `describeState` porque el rótulo cambia según la pantalla —"Asistió" en la agenda del
 * profesional, "Vino" en el panel del día— y el color no.
 */
export type StateTone = "green" | "amber" | "grey" | "red";

export function stateTone(state: string): StateTone {
  switch (state) {
    case "pending":
      return "amber";
    case "accepted":
      return "green";
    case "assisted":
      return "grey";
    case "missed":
      return "red";
    default:
      return "grey";
  }
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

/**
 * "1 al 7 · septiembre de 2026", y cuando la semana cambia de mes, "31 ago al 6 sept ·
 * 2026".
 *
 * El mes al final solo aparece cuando los siete días caen adentro del mismo. Antes se
 * ponía siempre, y salía del lunes: la semana del 31 de agosto al 6 de septiembre se
 * titulaba "agosto de 2026" con seis días de septiembre adentro. Cuando la semana se
 * parte, el mes ya está dicho en los dos extremos y repetirlo solo puede mentir.
 */
export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const sameYear = monday.getFullYear() === sunday.getFullYear();

  const from = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: sameMonth ? undefined : "short" }).format(monday);
  const to = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(sunday);

  const tail = sameMonth
    ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(monday)
    : sameYear
      ? String(monday.getFullYear())
      : `${monday.getFullYear()} – ${sunday.getFullYear()}`;

  return `${from} al ${to} · ${tail}`;
}
