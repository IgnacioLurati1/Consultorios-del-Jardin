import type{ Schedule, Room, Office, City, Person, Appointment} from "../types.ts";

export interface appointmentDetailsProps {
    office?: Office;
    professional?: Person;
}

export interface columnModuleProps{
    schedules: Schedule[];
    showSimple: boolean;
    showTaller: boolean;
    setAppointmentModalOpen?: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el turno
    setSelectedDate: (date: Date|undefined) => void; //Función para seleccionar la key del turno
}

export interface cellModuleProps{
    date: Date;
    time?: string;
    schedule?: Schedule;
    height: number;
    setAppointmentModalOpen?: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
    setSelectedDate: (date: Date) => void; //Función para seleccionar la key del horario
    className?: string;
}

export interface appointmentCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | undefined;
    selectedDate: Date | undefined;
    professional: Person;
    office: Office;
}