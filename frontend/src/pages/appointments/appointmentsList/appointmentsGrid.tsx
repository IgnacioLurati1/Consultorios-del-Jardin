import type { Appointment, Person } from "../../types.ts";
import { AppointmentCell } from "./appointmentCell/appointmentCell.tsx";

interface AppointmentsGridProps {
    appointments: Appointment[];
    personType: string;
}

export function AppointmentsGrid({appointments, personType }: AppointmentsGridProps) {
    return (
        <div>
            {appointments.map(appointment => (
                <div key={appointment.numAppointment}>
                    <AppointmentCell appointment={appointment} userType={personType}/>
                </div>
            ))}
        </div>
    );
}