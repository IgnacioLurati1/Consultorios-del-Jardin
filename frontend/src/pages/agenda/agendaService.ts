import api from "../../axios";

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
  /** Vino de un calendario externo: puede no encajar en la grilla ni tener paciente. */
  imported?: boolean;
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

function unwrap(err: any): never {
  throw new Error(err.response?.data?.message || err.message);
}

/** La agenda de un día puntual, con los horarios y los turnos juntos. Solo admin. */
export function findAgendaDay(date: string): Promise<AgendaDay> {
  return api
    .get(`/agenda/day/${date}`)
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Cómo viene la semana. 0 es la que corre, 1 la que viene. Solo admin. */
export function findAgendaWeek(weeksAhead = 0): Promise<AgendaWeek> {
  return api
    .get("/agenda/week", { params: { weeksAhead } })
    .then((response) => response.data.data)
    .catch(unwrap);
}

/* ============================================================
   Fechas de la semana. Se calculan en el cliente porque los dos
   lados de la pantalla las necesitan: el selector de día para
   ofrecerlas y el pedido al backend para nombrar una.
   ============================================================ */

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/**
 * Los días de la semana, de lunes a sábado.
 *
 * El domingo queda afuera porque el consultorio no atiende: mostrarlo agregaría una
 * columna vacía a algo que ya es ancho. `weeksAhead` en 1 es la semana que viene.
 */
export function weekDays(weeksAhead = 0): { date: string; label: string; short: string; isToday: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((today.getDay() + 6) % 7) + weeksAhead * 7);

  return Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);

    const name = dayName(date);
    return {
      date: toISODate(date),
      label: `${name} ${date.getDate()}`,
      short: name.slice(0, 3),
      isToday: date.getTime() === today.getTime(),
    };
  });
}
