import type{ Schedule, Room, Office, City, Person} from "../types.ts";


export const daysSpanish: string[] = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
];

/** Qué se está mirando en la grilla: la agenda de un profesional o la ocupación de un consultorio. */
export type ScheduleViewMode = "professional" | "room";

export interface columnModuleProps{
    schedules: Schedule[];
    daysSpanish: string[];
    openingTime: string;
    closingTime: string;
    setScheduleModalOpen: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
    setSelectedKey: (key: string|undefined) => void; //Función para seleccionar la key del horario
    /** En modo consultorio interesa quién ocupa la franja, no en qué consultorio es. */
    showProfessional?: boolean;
    /** En modo consultorio no se crean horarios: no hay un profesional al que asignárselos. */
    readOnly?: boolean;
}

export interface cellModuleProps{
    cellKey: string;
    schedule?: Schedule;
    height: number;
    setScheduleModalOpen: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
    setSelectedKey: (cellKey: string) => void; //Función para seleccionar la key del horario
    className?: string;
    showProfessional?: boolean;
    readOnly?: boolean;
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
    onCreate: ((newSchedule: { day: string; initialHour: string; finalHour: string, room: string, personEmail:string, duration: number}) => void) | null;
    onDelete: ((professionalEmail: string, day: string, initialHour:string) => void )| null;
    isProfessional: boolean;
    /** El profesional puede cambiar la duración de sus propios módulos. */
    onUpdateDuration?: ((day: string, initialHour: string, personEmail: string, duration: number) => void) | null;
}

export interface GridFilterProps{
  rooms: Room[];
  viewMode: ScheduleViewMode;
  selectedRoom: Room | undefined;
  onSelectRoom: (room: Room) => void;
  onClearRoom: () => void;
  /** Pasa a modo consultorio: trae los horarios de todos los profesionales en ese consultorio. */
  onShowRoomOccupancy: () => void;
}
