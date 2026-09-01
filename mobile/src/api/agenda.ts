import api from "./client";

/** Una persona, como la manda la agenda: lo justo para nombrarla en pantalla. */
export interface AgendaPerson {
  email: string;
  name: string;
  surname: string;
  speciality: string | null;
}

export interface AgendaRoom {
  idRoom: number;
  description: string;
  office: { idOffice: number; description: string };
}

/** Un módulo de atención de un profesional en una sala. */
export interface AgendaSchedule {
  idRoom: number;
  initialHour: string;
  finalHour: string;
  duration: number;
  professional: AgendaPerson;
}

export interface AgendaAppointment {
  numAppointment: number;
  idRoom: number;
  initialHour: string;
  finalHour: string;
  state: string;
  /** Fuera de los módulos del profesional: lo metió a mano. */
  overbooked: boolean;
  /** Salió de un turno que se repite solo. */
  recurring: boolean;
  professional: AgendaPerson;
  patient: AgendaPerson | null;
}

/** Todo lo que pasa un día en el consultorio. Los cancelados no vienen; su cantidad sí. */
export interface AgendaDay {
  date: string;
  day: string;
  opening: string;
  closing: string;
  rooms: AgendaRoom[];
  schedules: AgendaSchedule[];
  appointments: AgendaAppointment[];
  cancelled: number;
}

/** La punta del día: la hora, y todos los que empatan en ella. */
export interface AgendaEdge {
  hour: string;
  professionals: AgendaPerson[];
}

export interface AgendaPeak {
  from: string;
  to: string;
  appointments: number;
  patients: number;
  professionals: number;
  items: {
    numAppointment: number;
    initialHour: string;
    finalHour: string;
    state: string;
    overbooked: boolean;
    room: string;
    professional: AgendaPerson;
    patient: AgendaPerson | null;
  }[];
}

export interface AgendaWeekDay {
  date: string;
  day: string;
  isToday: boolean;
  /** La primera y la última hora con alguien adentro, sea por un módulo o por un turno. */
  earliest: AgendaEdge | null;
  latest: AgendaEdge | null;
  /** La franja de una hora con más turnos encima. */
  peak: AgendaPeak | null;
  patients: number;
  professionals: number;
  appointments: number;
}

export interface AgendaWeek {
  from: string;
  to: string;
  weeksAhead: number;
  days: AgendaWeekDay[];
}

/** La agenda de un día puntual, con los horarios y los turnos juntos. Solo admin. */
export async function agendaDay(date: string): Promise<AgendaDay> {
  const { data } = await api.get(`/agenda/day/${date}`);
  return data.data;
}

/** Cómo viene la semana. 0 es la que corre, 1 la que viene. Solo admin. */
export async function agendaWeek(weeksAhead = 0): Promise<AgendaWeek> {
  const { data } = await api.get("/agenda/week", { params: { weeksAhead } });
  return data.data;
}
