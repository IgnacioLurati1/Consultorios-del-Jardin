import type{ Schedule, Room, Office, City, Person} from "../types.ts";


export const daysSpanish: string[] = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
];

export interface columnModuleProps{
    schedules: Schedule[];
    daysSpanish: string[];
    openingTime: string;
    closingTime: string;
    setScheduleModalOpen: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
    setSelectedKey: (key: string|undefined) => void; //Función para seleccionar la key del horario
}

export interface cellModuleProps{
    cellKey: string;
    schedule?: Schedule;
    height: number;
    setScheduleModalOpen: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
    setSelectedKey: (cellKey: string) => void; //Función para seleccionar la key del horario
    className?: string;
}

export interface scheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | undefined;
    cellKey: string | undefined;
    daysSpanish: string[];
    professional: Person;
    rooms: Room[];
    offices: Office[];
    cities: City[];
    onCreate: ((newSchedule: { day: string; initialHour: string; finalHour: string, room: string, personEmail:string, allowedType: string, duration: number}) => void) | null;
    onDelete: ((professionalEmail: string, day: string, initialHour:string) => void )| null;
    isProfessional: boolean;
}

export interface GridFilterProps{
  setProfessional: (profesionals: Person | undefined) => void;
  professionals?: Person[];
  schedules?: Schedule[];
  offices?: Office[];
  setOfficeToFilter: (office: Office|undefined) => void;
  setRoomToFilter: (room: Room|undefined)=> void;
}