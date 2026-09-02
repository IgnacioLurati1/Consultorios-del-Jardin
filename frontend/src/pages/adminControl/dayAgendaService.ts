import api from "../../axios";

/** Una visita del día: un turno, mirado desde la puerta de entrada y no desde la agenda. */
export interface DayVisit {
  numAppointment: number;
  initialHour: string;
  finalHour: string;
  state: string;
  overbooked: boolean;
  patient: { email: string; name: string; surname: string; phoneNumber: string | null } | null;
  professional: { email: string; name: string; surname: string; speciality: string | null };
  room: { idRoom: number; description: string; office: string | null };
}

/** Quién atiende ese día, con su primer y su último turno. */
export interface DayProfessional {
  email: string;
  name: string;
  surname: string;
  speciality: string | null;
  from: string;
  to: string;
  visits: number;
  patients: number;
}

/** Un tramo del día en el que hay varios pacientes a la vez. */
export interface CrowdedStretch {
  from: string;
  to: string;
  /** Cuántos llegaron a coincidir en el momento más cargado del tramo. */
  peak: number;
  patients: {
    email: string;
    name: string;
    surname: string;
    initialHour: string;
    finalHour: string;
    professional: string;
  }[];
  professionals: string[];
}

export interface DayAgenda {
  date: string;
  visits: DayVisit[];
  professionals: DayProfessional[];
  crowded: CrowdedStretch[];
  /** A partir de cuántos pacientes a la vez se considera que se llena. */
  crowdLimit: number;
  /** Pacientes distintos ese día. Uno con dos turnos cuenta una vez. */
  patients: number;
}

/** Todo lo que pasa en el consultorio un día, ordenado por horario de ingreso. */
export function findDayAgenda(date: string): Promise<DayAgenda> {
  return api
    .get(`/appointments/by-day/${date}`)
    .then((response) => response.data.data)
    .catch((err: any) => {
      throw new Error(err.response?.data?.message || err.message);
    });
}
