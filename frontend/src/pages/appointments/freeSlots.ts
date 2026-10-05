import type { Appointment, Room, Schedule } from "../types.ts";
import { appointmentDate, isCancelled, toISODate } from "./appointmentTypes.ts";
import { currentInstallation, type InstallationRules } from "../../lib/installation.ts";

/**
 * Los turnos que entran en un día, según la grilla de horarios del profesional.
 *
 * Es la misma cuenta que hace el alta de un turno para armar su lista de horarios
 * disponibles, y la que hace la agenda semanal para dibujar el "+" en los huecos. Vive
 * acá y no adentro de una pantalla porque las dos tienen que dar exactamente lo mismo:
 * un "+" que ofrezca una franja que después el alta no acepta es peor que no tener "+".
 *
 * Y tiene que dar lo mismo que el servidor, que hace la cuenta en `appointments/slotGrid`.
 * Las reglas —cada cuánto arranca un turno, desde dónde se cuenta, el colchón entre
 * turnos— llegan del servidor (ver lib/installation); la cuenta está escrita dos veces
 * porque una corre en el navegador y la otra en el servidor, y las pruebas de los dos
 * lados fijan los mismos casos.
 */

type GridRules = Pick<InstallationRules, "slotStepMinutes" | "realignToOpening" | "bufferMinutes">;

function minutesOf(hour: string): number {
  const [h, m] = hour.split(":").map(Number);
  return h * 60 + m;
}

function hourOf(minutes: number): string {
  const total = Math.max(0, minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Desde dónde se cuenta la grilla de un módulo.
 *
 * Sin realinear, desde el inicio del módulo, como siempre. Realineando, desde la hora en
 * que abre la sucursal si el módulo arranca antes: es el arreglo del primer horario que
 * aparecía corrido (un módulo de 14 a 20 con la sucursal abriendo a las 15 empezaba en
 * 15:30).
 */
function anchorOf(schedule: Schedule, rules: GridRules): number {
  const start = minutesOf(shortHour(schedule.initialHour));
  const opens = schedule.room?.office?.openingTime;
  if (rules.realignToOpening && opens) return Math.max(start, minutesOf(shortHour(opens)));
  return start;
}

/** Los días como los guardan los horarios de atención: en minúscula y sin acentos. */
const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export function dayNameOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

export function addMinutes(hour: string, minutes: number): string {
  const [h, m] = hour.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** MySQL devuelve "09:00:00"; para comparar y para mostrar alcanza con HH:MM. */
const shortHour = (hour: string) => (hour ?? "").slice(0, 5);

/** La hora actual como "HH:MM", para comparar contra los horarios de los módulos. */
export function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Una franja de la grilla, ocupada o no. */
export interface DaySlot {
  key: string;
  initialHour: string;
  finalHour: string;
  room: Room;
  duration: number;
}

/**
 * Divide cada módulo del día en turnos del largo que definió el profesional.
 *
 * Sólo entran los que caben enteros adentro del módulo: media hora suelta al final de un
 * módulo de cuarenta minutos no es un turno que se pueda dar.
 *
 * Con `fromNow`, si el día es hoy deja afuera los que ya arrancaron: es lo que quiere la
 * agenda para ofrecer huecos. El alta del profesional no lo usa, porque ahí sí se carga
 * el turno de alguien que ya está en el consultorio (el backend lo acepta, y la app del
 * celular ya lo ofrecía). Sin eso, a las tres de la tarde un módulo de 14 a 20 con turnos
 * de 45 minutos arrancaba en el de las 15:30.
 */
export function buildDaySlots(
  schedules: Schedule[],
  isoDate: string,
  { fromNow = false, rules = currentInstallation().rules as GridRules } = {}
): DaySlot[] {
  if (!isoDate) return [];

  const day = dayNameOf(isoDate);
  const from = fromNow && isoDate === toISODate(new Date()) ? nowHHMM() : "";
  const slots: DaySlot[] = [];

  for (const schedule of schedules.filter((s) => s.day === day)) {
    const end = minutesOf(shortHour(schedule.finalHour));
    // El paso es la duración del módulo salvo que el consultorio haya puesto otro.
    const step = rules.slotStepMinutes && rules.slotStepMinutes > 0 ? rules.slotStepMinutes : schedule.duration;
    if (step <= 0 || schedule.duration <= 0) continue;

    for (let start = anchorOf(schedule, rules); start + schedule.duration <= end; start += step) {
      const hour = hourOf(start);
      if (hour <= from) continue;

      slots.push({
        key: `${hour}-${schedule.room.idRoom}`,
        initialHour: hour,
        finalHour: hourOf(start + schedule.duration),
        room: schedule.room,
        duration: schedule.duration,
      });
    }
  }

  return slots.sort((a, b) => a.initialHour.localeCompare(b.initialHour));
}

/**
 * Los huecos de un día: las franjas de la grilla donde todavía no hay nada.
 *
 * Un turno cancelado no ocupa nada —cancelar es justamente lo que libera el horario— así
 * que el hueco vuelve a ofrecerse. Los sobreturnos sí ocupan: están fuera de la grilla,
 * pero el profesional está atendiendo a alguien en ese rato igual.
 *
 * Los días que ya pasaron no tienen huecos. No se puede dar un turno para ayer, y ofrecer
 * uno que el alta va a rechazar es prometer algo que no se cumple.
 */
export function freeDaySlots(
  schedules: Schedule[],
  isoDate: string,
  appointments: Appointment[],
  rules: GridRules = currentInstallation().rules
): DaySlot[] {
  if (isoDate < toISODate(new Date())) return [];

  // Cada turno ocupa también el colchón de cada lado: el alta del profesional lo controla
  // igual (ver withBuffer en el motor), y un "+" que ofrezca el hueco pegado a otro turno
  // sería prometer algo que el servidor después rechaza.
  const buffer = Math.max(0, rules.bufferMinutes || 0);

  const ocupadas = appointments
    .filter((appointment) => !isCancelled(appointment.state))
    .filter((appointment) => toISODate(appointmentDate(appointment.date)) === isoDate)
    .map((appointment) => ({
      initialHour: hourOf(minutesOf(shortHour(appointment.initialHour)) - buffer),
      finalHour: hourOf(minutesOf(shortHour(appointment.finalHour)) + buffer),
    }));

  return buildDaySlots(schedules, isoDate, { fromNow: true, rules }).filter(
    (slot) => !ocupadas.some((taken) => slot.initialHour < taken.finalHour && slot.finalHour > taken.initialHour)
  );
}
