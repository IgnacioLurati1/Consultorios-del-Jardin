import type { Appointment, Person, Diagnostic } from "../../types.ts"; // 1. Importar Diagnostic
import { AppointmentCell } from "./appointmentCell/appointmentCell.tsx";


interface AppointmentsGridProps {
  appointments: Appointment[];
  user: Person; 
  onDiagnosticsUpdate: (idAppointment: number, updatedDiagnostics: Diagnostic[]) => void;
  onAppointmentStateUpdate: (idAppointment: number, newState: string) => void;
}


export function AppointmentsGrid({
  appointments,
  user,
  onDiagnosticsUpdate,
  onAppointmentStateUpdate
}: AppointmentsGridProps) {
  
  return (
    <div className="appointment-grid">
      {appointments.map(appointment => (
        <div key={appointment.numAppointment}>
          {/* 5. Pasar TODOS los props a la celda hija */}
          <AppointmentCell
            appointment={appointment}
            user={user}
            onDiagnosticsUpdate={onDiagnosticsUpdate}
            onAppointmentStateUpdate={onAppointmentStateUpdate}
          />
        </div>
      ))}
    </div>
  );
}