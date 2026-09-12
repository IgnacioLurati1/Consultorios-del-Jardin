import type { CSSProperties } from "react";
import { addDays, appointmentDate, shortHour, toISODate } from "../appointmentTypes.ts";
import type { partialAppointment } from "../appointmentTypes.ts";
import type { Person } from "../../types.ts";
import { WeekGrid, type WeekGridDay } from "../../../components/weekGrid/WeekGrid.tsx";

/**
 * Un horario libre. Trae al profesional cuando la grilla junta varios (los horarios de
 * toda una especialidad); en la agenda de uno solo no hace falta y no viene.
 */
export type BookableSlot = partialAppointment & { professional?: Person };

interface AvailableWeekGridProps<T extends BookableSlot> {
  slots: T[];
  monday: Date;
  onPick: (slot: T) => void;
}

function durationInMinutes(initialHour: string, finalHour: string): number {
  const [h1, m1] = initialHour.split(":").map(Number);
  const [h2, m2] = finalHour.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

/**
 * Horarios libres, semana por semana.
 *
 * Con un solo profesional, debajo de la hora va cuánto dura el turno. Con varios, va con
 * quién es: ahí la duración deja de ser lo que decide y el nombre sí.
 *
 * Los horarios entran desde abajo, escalonados de izquierda a derecha: al saltar de un
 * profesional a otro se nota enseguida que la grilla se renovó.
 */
export function AvailableWeekGrid<T extends BookableSlot>({ slots, monday, onPick }: AvailableWeekGridProps<T>) {
  const byDate = new Map<string, T[]>();
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
    const daySlots = (byDate.get(toISODate(date)) ?? []).sort(
      (a, b) =>
        a.initialHour.localeCompare(b.initialHour) ||
        (a.professional?.surname ?? "").localeCompare(b.professional?.surname ?? "")
    );

    return {
      date,
      empty: daySlots.length === 0,
      content: daySlots.map((slot) => {
        const minutes = durationInMinutes(slot.initialHour, slot.finalHour);
        const who = slot.professional ? `${slot.professional.surname}, ${slot.professional.name}` : null;

        return (
          <button
            type="button"
            // Con varios profesionales, dos pueden tener libre la misma hora.
            key={`${toISODate(date)}-${slot.initialHour}-${slot.professional?.email ?? ""}`}
            className={`week-slot ${who ? "has-who" : ""}`}
            style={{ "--slot-order": order++ } as CSSProperties}
            onClick={() => onPick(slot)}
            title={`${shortHour(slot.initialHour)} · ${who ? `${who} · ` : ""}${minutes} minutos`}
          >
            <span className="week-slot-hour">{shortHour(slot.initialHour)}</span>
            <span className="week-slot-note">{slot.professional ? slot.professional.surname : `${minutes} min`}</span>
          </button>
        );
      }),
    };
  });

  return <WeekGrid monday={monday} days={days} emptyLabel="Sin horarios" animate />;
}
