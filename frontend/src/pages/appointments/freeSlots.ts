import type { Appointment, Room, Schedule } from "../types.ts";
import { appointmentDate, isCancelled, toISODate } from "./appointmentTypes.ts";

/**
 * Los turnos que entran en un día, según la grilla de horarios del profesional.
 *
 * Es la misma cuenta que hace el alta de un turno para armar su lista de horarios
 * disponibles, y la que hace la agenda semanal para dibujar el "+" en los huecos. Vive
 * acá y no adentro de una pantalla porque las dos tienen que dar exactamente lo mismo:
 * un "+" que ofrezca una franja que después el alta no acepta es peor que no tener "+".
 */

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
 * módulo de cuarenta minutos no es un turno que se pueda dar. Si el día es hoy, deja
 * afuera los que ya arrancaron, porque el backend los rechazaría igual.
 */
export function buildDaySlots(schedules: Schedule[], isoDate: string): DaySlot[] {
  if (!isoDate) return [];

  const day = dayNameOf(isoDate);
  const isToday = isoDate === toISODate(new Date());
  const from = isToday ? nowHHMM() : "";
  const slots: DaySlot[] = [];

  for (const schedule of schedules.filter((s) => s.day === day)) {
    let hour = shortHour(schedule.initialHour);
    const end = shortHour(schedule.finalHour);

    while (addMinutes(hour, schedule.duration) <= end) {
      const finalHour = addMinutes(hour, schedule.duration);

      if (hour > from) {
        slots.push({
          key: `${hour}-${schedule.room.idRoom}`,
          initialHour: hour,
          finalHour,
          room: schedule.room,
          duration: schedule.duration,
        });
      }

      hour = finalHour;
    }
  }

  return slots.sort((a, b) => a.initialHour.localeCompare(b.initialHour));
}

/** Si el profesional atiende ese día, aunque ya no queden turnos por delante. */
export function worksOn(schedules: Schedule[], isoDate: string): boolean {
  return !!isoDate && schedules.some((s) => s.day === dayNameOf(isoDate));
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
export function freeDaySlots(schedules: Schedule[], isoDate: string, appointments: Appointment[]): DaySlot[] {
  if (isoDate < toISODate(new Date())) return [];

  const ocupadas = appointments
    .filter((appointment) => !isCancelled(appointment.state))
    .filter((appointment) => toISODate(appointmentDate(appointment.date)) === isoDate)
    .map((appointment) => ({
      initialHour: shortHour(appointment.initialHour),
      finalHour: shortHour(appointment.finalHour),
    }));

  return buildDaySlots(schedules, isoDate).filter(
    (slot) => !ocupadas.some((taken) => slot.initialHour < taken.finalHour && slot.finalHour > taken.initialHour)
  );
}
