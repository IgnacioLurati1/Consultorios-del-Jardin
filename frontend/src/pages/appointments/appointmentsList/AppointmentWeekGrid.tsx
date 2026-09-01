import type { Appointment, Person } from "../../types.ts";
import { addDays, appointmentDate, describeState, isCancelled, shortHour, toISODate } from "../appointmentTypes.ts";
import { WeekGrid, type WeekGridDay } from "../../../components/weekGrid/WeekGrid.tsx";

interface AppointmentWeekGridProps {
  appointments: Appointment[];
  monday: Date;
  user: Person;
  onOpen: (appointment: Appointment) => void;
}

/**
 * Agenda semanal del profesional sobre la grilla compartida: cada turno es una
 * celda con el color de su estado.
 */
export function AppointmentWeekGrid({ appointments, monday, user, onOpen }: AppointmentWeekGridProps) {
  const isProfessional = user.type === "professional";

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
    const dayAppointments = (byDate.get(toISODate(date)) ?? []).sort((a, b) => a.initialHour.localeCompare(b.initialHour));

    return {
      date,
      empty: dayAppointments.length === 0,
      content: dayAppointments.map((appointment) => {
        const state = describeState(appointment.state);
        const counterpart = isProfessional
          ? appointment.patient
            ? `${appointment.patient.surname}, ${appointment.patient.name}`
            : "Sin paciente"
          : `${appointment.professional.surname}, ${appointment.professional.name}`;

        return (
          <button
            type="button"
            key={appointment.numAppointment}
            className={`week-slot state-${isCancelled(appointment.state) ? "cancelled" : appointment.state} ${
              appointment.overbooked ? "overbooked" : ""
            }`}
            onClick={() => onOpen(appointment)}
            title={`${shortHour(appointment.initialHour)} · ${counterpart} · ${state.label}${
              appointment.overbooked ? " · sobreturno" : ""
            }`}
          >
            <span className="week-slot-hour">
              {shortHour(appointment.initialHour)}
              {appointment.overbooked && <span className="appt-slot-over">sobreturno</span>}
            </span>
            <span className="week-slot-note">{counterpart}</span>
          </button>
        );
      }),
    };
  });

  return <WeekGrid monday={monday} days={days} />;
}
