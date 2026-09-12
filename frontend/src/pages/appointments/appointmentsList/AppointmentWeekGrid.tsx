import type { HTMLAttributes, ReactNode } from "react";
import { FaCircleCheck, FaPlus } from "react-icons/fa6";
import type { Appointment, Person, Schedule } from "../../types.ts";
import {
  addDays,
  appointmentDate,
  cancellationNotice,
  describeState,
  isCancelled,
  isOwnBooking,
  shortHour,
  toISODate,
} from "../appointmentTypes.ts";
import { freeDaySlots, type DaySlot } from "../freeSlots.ts";
import { WeekGrid, type WeekGridDay } from "../../../components/weekGrid/WeekGrid.tsx";

/** Un rato libre de la agenda, con el día al que pertenece. */
export interface FreeSlotPick {
  /** "AAAA-MM-DD". */
  date: string;
  slot: DaySlot;
}

interface AppointmentWeekGridProps {
  appointments: Appointment[];
  monday: Date;
  user: Person;
  onOpen: (appointment: Appointment) => void;
  /** Click derecho y teclado, los mismos que en la vista lista. */
  quickActions?: (appointment: Appointment) => HTMLAttributes<HTMLElement>;
  /** Los horarios de atención. Sin esto no hay huecos que ofrecer. */
  schedules?: Schedule[];
  /** Tocar un hueco. Sin esto los huecos no se dibujan. */
  onNew?: (pick: FreeSlotPick) => void;
}

/** Una celda del día y a qué hora va, que es lo que las ordena entre sí. */
interface Celda {
  hour: string;
  node: ReactNode;
}

/**
 * Agenda semanal del profesional sobre la grilla compartida: cada turno es una
 * celda con el color de su estado.
 *
 * Entre los turnos aparecen los ratos libres, cada uno con un "+" que abre el alta con esa
 * franja ya elegida. Van mezclados y en orden de reloj, no en una lista aparte al final:
 * un hueco de las tres de la tarde se entiende mirando lo que tiene arriba y lo que tiene
 * abajo.
 */
export function AppointmentWeekGrid({
  appointments,
  monday,
  user,
  onOpen,
  quickActions,
  schedules,
  onNew,
}: AppointmentWeekGridProps) {
  const isProfessional = user.type === "professional";
  // Los huecos son para dar de alta, así que solo existen del lado del profesional.
  const ofreceHuecos = isProfessional && !!onNew && !!schedules?.length;

  // Se agrupan por fecha una sola vez en lugar de filtrar dentro de cada columna
  const byDate = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    const key = toISODate(appointmentDate(appointment.date));
    const list = byDate.get(key);
    if (list) list.push(appointment);
    else byDate.set(key, [appointment]);
  }

  const days: WeekGridDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = toISODate(date);
    const dayAppointments = byDate.get(key) ?? [];

    /*
     * Los ratos de la grilla donde todavía no hay nadie.
     *
     * Se calculan contra todos los turnos del día y no contra los que se están dibujando:
     * mostrar o esconder los cancelados no puede hacer aparecer ni desaparecer un hueco.
     * Lo que libera un horario es cancelar, no mirar.
     *
     * Los turnos que el profesional sacó para sí mismo también ocupan, y eso está bien:
     * a esa hora lo están atendiendo a él, así que no hay nadie para ofrecer el "+".
     */
    const huecos = ofreceHuecos ? freeDaySlots(schedules!, key, dayAppointments) : [];

    const celdas: Celda[] = dayAppointments.map((appointment) => {
      const state = describeState(appointment.state);

      // El turno que sacó para atenderse él. De acá para abajo la celda se arma como la
      // de un paciente, porque en ese turno eso es lo que es.
      const own = isOwnBooking(appointment, user);
      const atiende = isProfessional && !own;

      // La misma marca que la lista, por lo mismo: entre todos los cancelados en gris, el
      // que avisó sobre la hora es el único que el profesional está buscando.
      const notice = atiende ? cancellationNotice(appointment) : null;
      const cancelled = isCancelled(appointment.state);
      const stateClass = cancelled ? (notice?.short ? "cancelled late" : "cancelled") : appointment.state;

      // Contestó "Sí, voy" desde el mail del día anterior. En la celda no entra una frase:
      // va una tilde, y la frase en el title.
      const confirmed = atiende && !!appointment.attendanceConfirmedAt && appointment.state === "accepted";

      const counterpart = atiende
        ? appointment.patient
          ? `${appointment.patient.surname}, ${appointment.patient.name}`
          : "Sin paciente"
        : `${appointment.professional.surname}, ${appointment.professional.name}`;

      return {
        hour: shortHour(appointment.initialHour),
        node: (
          <button
            type="button"
            key={`turno-${appointment.numAppointment}`}
            className={`week-slot state-${stateClass} ${appointment.overbooked ? "overbooked" : ""} ${own ? "own" : ""}`}
            onClick={() => onOpen(appointment)}
            title={`${shortHour(appointment.initialHour)} · ${own ? "turno propio con " : ""}${counterpart} · ${state.label}${
              notice?.short ? " · baja sobre la hora" : ""
            }${appointment.overbooked ? " · turno especial" : ""}${confirmed ? " · asistencia confirmada" : ""}`}
            {...quickActions?.(appointment)}
          >
            <span className="week-slot-hour">
              {shortHour(appointment.initialHour)}
              {/* En una celda de dos renglones no entra una frase. El nombre de abajo es
                  el del colega, y esto dice de quién es el nombre. */}
              {own && <span className="appt-slot-own">tuyo</span>}
              {appointment.overbooked && <span className="appt-slot-over">turno especial</span>}
              {confirmed && <FaCircleCheck className="appt-slot-confirmed" aria-hidden="true" />}
            </span>
            <span className="week-slot-note">{counterpart}</span>
          </button>
        ),
      };
    });

    for (const slot of huecos) {
      celdas.push({
        hour: slot.initialHour,
        node: (
          <button
            type="button"
            key={`libre-${slot.key}`}
            className="week-slot week-slot-free"
            onClick={() => onNew!({ date: key, slot })}
            title={`Dar un turno de las ${slot.initialHour} a las ${slot.finalHour} en ${slot.room.description}`}
          >
            <span className="week-slot-hour">
              <FaPlus aria-hidden="true" />
              {slot.initialHour}
            </span>
            <span className="week-slot-note">{slot.duration} min</span>
          </button>
        ),
      });
    }

    return {
      date,
      empty: celdas.length === 0,
      // Un día sin nada agendado, aunque tenga huecos para ofrecer, se esconde en celular.
      minor: dayAppointments.length === 0,
      content: celdas.sort((a, b) => a.hour.localeCompare(b.hour)).map((celda) => celda.node),
    };
  });

  return <WeekGrid monday={monday} days={days} />;
}
