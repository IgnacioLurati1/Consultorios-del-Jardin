export interface Province {
    idProvince: string;
    nameProvince: string;
    active: boolean;
}

export interface City {
    idCity: string;
    nameCity: string;
    province: Province;
    active: boolean;
}

export interface Office {

    idOffice: string;
    description: string;
    openingTime: string;
    closingTime: string;
    city: City
    active: boolean;
}

export interface Room {
    idRoom: string;
    description: string;
    office: Office;
    active: boolean;
}

export interface Person{
    email: string;
    docType: string;
    docNumber: string;
    name: string;
    surname: string;
    phoneNumber: string;
    /** Los pacientes anónimos no tienen contraseña. */
    password?: string | null;
    speciality: string;
    /** Cómo se presenta el profesional. Lo lee el paciente antes de elegir con quién atenderse. */
    about?: string | null;
    type: string;
    active: boolean;
    /**
     * Si el profesional aparece entre las opciones cuando un paciente saca turno. En
     * false sigue trabajando igual: entra, ve su agenda y carga turnos a mano.
     */
    bookable?: boolean;
    /** Paciente cargado por un profesional, sin cuenta propia. */
    anonymous?: boolean;
    /** Email del profesional que lo cargó, si es (o fue) un paciente anónimo. */
    createdBy?: string | null;
    /**
     * Quién apagó la cuenta. "admin" es una decisión de una persona; "system" la tomó
     * una regla de uso. En null la cuenta está bien, o se deshabilitó antes de que se
     * empezara a registrar el motivo.
     */
    bannedBy?: "admin" | "system" | null;
  /** De qué clase fue la baja automática: uso abusivo propio, o cuenta ajena. */
  banKind?: "abuse" | "compromise" | null;
    bannedAt?: string | null;
    /** Qué regla saltó, si la deshabilitó el sistema. */
    banReason?: string | null;
}

export interface Schedule {
    day: "lunes"|"martes"|"miercoles"|"jueves"|"viernes"|"sabado";
    initialHour: string; //"HH:MM"
    person: Person;
    room: Room;
    finalHour: string;
    active: boolean;
    duration: number
}

export interface TokenPayload {
    email:string;
    type:string;
    exp:number;
}

/**
 * Vista clínica de un turno. Ya no es una entidad propia: el backend la deriva
 * del turno y la sigue exponiendo en los endpoints /diagnostic.
 */
export interface Diagnostic {
    appointment: number;
    patient: string;
    state: string;
    observations: string | null;
}

export type RecurrenceFrequency = "weekly" | "biweekly";

/** Turno repetible: la receta con la que el backend va creando los turnos que se repiten. */
export interface Recurrence {
    idRecurrence: number;
    frequency: RecurrenceFrequency;
    initialHour: string;
    finalHour: string;
    value: number;
    overbooked: boolean;
    /** Fecha del turno que la originó: define el día de la semana. */
    startDate: string;
    /** Último día en que se puede crear un turno. En null se repite sin fecha de corte. */
    endDate: string | null;
    patient: { email: string; name: string; surname: string } | null;
    room: { idRoom: number; description: string };
    /** Los próximos turnos ya generados. */
    upcoming: { numAppointment: number; date: string }[];
}

export interface Appointment {
    numAppointment: number;
    date: string;
    initialHour: string;
    finalHour: string;
    value: number;
    /** pending | accepted | assisted | missed, o un ISO timestamp si fue cancelado. */
    state: string;
    observations?: string | null;
    /** Sobreturno: el profesional lo dio fuera de sus módulos de atención. */
    overbooked?: boolean;
    /** Si salió de un turno repetible, la configuración que lo generó. */
    recurrence?: {
        idRecurrence: number;
        frequency: RecurrenceFrequency;
        active: boolean;
        endDate?: string | null;
    } | null;
    professional: Person;
    /** Un turno tiene como mucho un paciente. Puede no tener ninguno todavía. */
    patient?: Person | null;
    room: Room;
}
