import type{ Office, Person} from "../types.ts";

export type partialAppointment = {date: Date;initialHour: string;finalHour: string;type: "simple" | "taller";};
export interface appointmentDetailsProps {
    office?: Office;
    professional?: Person;
}

export interface columnModuleProps{
    appointments: partialAppointment[];
    showSimple: boolean;
    showTaller: boolean;
    setAppointmentModalOpen?: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedAppointment: (partialAppointment: partialAppointment | undefined) => void; // Función para seleccionar el turno
}

export interface cellModuleProps{
    appointment?: partialAppointment;
    height: number;
    setAppointmentModalOpen?: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedAppointment: (partialAppointment: partialAppointment | undefined) => void; // Función para seleccionar el turno
    className?: string;
}

export interface appointmentCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment?: partialAppointment;
    professional: Person;
    office: Office;
    onCreate: ((newAppointment:{date: string,initialHour: string,type: "simple" | "taller",professionalEmail: string,officeId: string}) => void);

}