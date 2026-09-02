/**
 * El modelo del backend, tal como llega. Es el mismo que usa la web: si cambia allá,
 * cambia acá.
 */

export type Role = "client" | "professional" | "admin";

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

/** Una sede del consultorio. En la interfaz se llama "sucursal". */
export interface Office {
  idOffice: string;
  description: string;
  openingTime: string;
  closingTime: string;
  city: City;
  active: boolean;
}

/** Una sala de atención. En la interfaz se llama "consultorio". */
export interface Room {
  idRoom: string;
  description: string;
  office: Office;
  active: boolean;
}

export interface Person {
  email: string;
  docType: string;
  docNumber: string;
  name: string;
  surname: string;
  phoneNumber: string;
  speciality: string;
  /** Cómo se presenta el profesional. Lo lee el paciente antes de elegir con quién atenderse. */
  about?: string | null;
  type: Role;
  active: boolean;
  /**
   * Si el profesional aparece entre las opciones cuando un paciente saca turno. En false
   * sigue trabajando igual: entra, ve su agenda y carga turnos a mano.
   */
  bookable?: boolean;
  /** Paciente cargado por un profesional, sin cuenta propia. */
  anonymous?: boolean;
  createdBy?: string | null;
}

export type Day = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";

export interface Schedule {
  day: Day;
  initialHour: string;
  finalHour: string;
  duration: number;
  person: Person;
  room: Room;
  active: boolean;
}

export type RecurrenceFrequency = "weekly" | "biweekly";

export interface Recurrence {
  idRecurrence: number;
  frequency: RecurrenceFrequency;
  initialHour: string;
  finalHour: string;
  value: number;
  overbooked: boolean;
  startDate: string;
  /** Último día en que se crea un turno. En null se repite sin fecha de corte. */
  endDate: string | null;
  active?: boolean;
  patient: { email: string; name: string; surname: string } | null;
  room: { idRoom: number; description: string };
  upcoming: { numAppointment: number; date: string }[];
}

export interface Appointment {
  numAppointment: number;
  date: string;
  initialHour: string;
  finalHour: string;
  value: number;
  /** pending | accepted | assisted | missed, o un ISO timestamp si se canceló. */
  state: string;
  observations?: string | null;
  overbooked?: boolean;
  recurrence?: {
    idRecurrence: number;
    frequency: RecurrenceFrequency;
    active: boolean;
    endDate?: string | null;
  } | null;
  professional: Person;
  patient?: Person | null;
  room: Room;
}

export interface Slot {
  date: string;
  initialHour: string;
  finalHour: string;
}
