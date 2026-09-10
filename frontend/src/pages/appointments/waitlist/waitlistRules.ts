/**
 * Lo que la pantalla necesita saber de la lista de espera sin preguntarle al servidor.
 *
 * Los números de los topes no están acá: llegan con el estado de cada lista (ver
 * waitlistService), así que cambiarlos es tocar un solo lugar del backend.
 */

export interface WaitlistLimits {
  maxDays: number;
  maxHours: number;
  lifetimeDays: number;
  maxNotices: number;
  maxActive: number;
  maxPerMonth: number;
  maxPerProfessional: number;
}

/** De lunes a sábado, con el número de `getDay()`. El domingo el consultorio no atiende. */
export const WEEK_DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "lunes", "lunes y miércoles", "lunes, martes y viernes". */
export function describeDays(days: number[]): string {
  const names = [...days].sort((a, b) => a - b).map((day) => DAY_NAMES[day]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Lo mismo con mayúscula, para cuando va al principio de un renglón. */
export function describeDaysTitle(days: number[]): string {
  const text = describeDays(days);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Las horas que se ofrecen en la franja, cada media hora, del horario del consultorio. */
export function hourOptions(from = 8, to = 21): string[] {
  const options: string[] = [];
  for (let minutes = from * 60; minutes <= to * 60; minutes += 30) {
    options.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return options;
}

function minutesOf(hour: string): number {
  const [hours, minutes] = hour.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Por qué no se puede mandar lo que está elegido, o null si se puede. */
export function formProblem(days: number[], fromHour: string, toHour: string, limits: WaitlistLimits): string | null {
  if (days.length === 0) return "Elegí al menos un día";
  if (days.length > limits.maxDays) return `Podés elegir hasta ${limits.maxDays} días`;

  const length = minutesOf(toHour) - minutesOf(fromHour);
  if (length <= 0) return "La hora de fin tiene que ser después de la de inicio";
  if (length > limits.maxHours * 60) return `La franja puede ser de hasta ${limits.maxHours} horas`;

  return null;
}

/** Lo mínimo del estado que hace falta para saber si todavía se puede anotar. */
export interface JoinState {
  enabled: boolean;
  full: boolean;
  active: unknown[];
  monthUsed: number;
  limits: WaitlistLimits;
}

/**
 * Por qué hoy no se puede anotar en esta lista, o null si puede.
 *
 * Es lo que apaga el botón antes de que llegue al servidor. Pasarse del tope del mes
 * cierra la cuenta, así que ese caso no puede depender de que el servidor lo rechace: la
 * pantalla no tiene que dejar mandarlo nunca.
 */
export function blockReason(status: JoinState): string | null {
  if (!status.enabled) return "Este profesional no trabaja con lista de espera.";

  if (status.monthUsed >= status.limits.maxPerMonth)
    return `Este mes ya te anotaste ${status.limits.maxPerMonth} veces en listas de espera, que es el máximo. El mes que viene podés volver a anotarte.`;

  if (status.active.length >= status.limits.maxActive)
    return `Ya estás en ${status.limits.maxActive} listas de espera, que es el máximo a la vez. Para anotarte en esta, salí de alguna de las otras.`;

  if (status.full) return "La lista de espera de este profesional está completa. Probá de nuevo en unos días.";

  return null;
}

/** "martes 22 de septiembre", para un momento que viene con hora (cuándo vence, cuándo se anotó). */
export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}
