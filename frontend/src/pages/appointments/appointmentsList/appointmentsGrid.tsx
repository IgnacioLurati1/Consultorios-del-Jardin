import type { Appointment, Person } from "../../types.ts";
import { AppointmentCell } from "./appointmentCell/appointmentCell.tsx";

interface AppointmentsGridProps {
    appointments: Appointment[];
    person: Person;
}

export function AppointmentsGrid({appointments, person }: AppointmentsGridProps) {
    return (
        <div>
            {appointments.map(appointment => (
                <div key={appointment.numAppointment}>
                    <AppointmentCell appointment={appointment} user={person}/>
                </div>
            ))}
        </div>
    );
}