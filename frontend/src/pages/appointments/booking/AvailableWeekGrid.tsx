import type { CSSProperties } from "react";
import { addDays, appointmentDate, shortHour, toISODate } from "../appointmentTypes.ts";
import type { partialAppointment } from "../appointmentTypes.ts";
import { WeekGrid, type WeekGridDay } from "../../../components/weekGrid/WeekGrid.tsx";

interface AvailableWeekGridProps {
  slots: partialAppointment[];
  monday: Date;
  onPick: (slot: partialAppointment) => void;
}

function durationInMinutes(initialHour: string, finalHour: string): number {
  const [h1, m1] = initialHour.split(":").map(Number);
  const [h2, m2] = finalHour.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/**
 * Horarios libres de un profesional, semana por semana.
 * Los horarios entran desde abajo, escalonados de izquierda a derecha: al saltar de un
 * profesional a otro se nota enseguida que la grilla se renovó.
 */
export function AvailableWeekGrid({ slots, monday, onPick }: AvailableWeekGridProps) {
  const byDate = new Map<string, partialAppointment[]>();
  for (const slot of slots) {
    const key = toISODate(appointmentDate(slot.date as unknown as string));
    const list = byDate.get(key);
    if (list) list.push(slot);
    else byDate.set(key, [slot]);
  }

  // Un contador corrido por toda la semana: define el retardo de cada horario.
  let order = 0;

  const days: WeekGridDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const daySlots = (byDate.get(toISODate(date)) ?? []).sort((a, b) => a.initialHour.localeCompare(b.initialHour));

    return {
      date,
      empty: daySlots.length === 0,
      content: daySlots.map((slot) => (
        <button
          type="button"
          key={`${toISODate(date)}-${slot.initialHour}`}
          className="week-slot"
          style={{ "--slot-order": order++ } as CSSProperties}
          onClick={() => onPick(slot)}
          title={`${shortHour(slot.initialHour)} · ${durationInMinutes(slot.initialHour, slot.finalHour)} minutos`}
        >
          <span className="week-slot-hour">{shortHour(slot.initialHour)}</span>
          <span className="week-slot-note">{durationInMinutes(slot.initialHour, slot.finalHour)} min</span>
        </button>
      )),
    };
  });

  return <WeekGrid monday={monday} days={days} emptyLabel="Sin horarios" animate />;
}
