import api from "./client";

/** Métricas de un recorte de turnos. Todas salen de las mismas filas, así que cierran entre sí. */
export interface Metrics {
  appointments: number;
  assisted: number;
  missed: number;
  cancelled: number;
  overbooked: number;
  /** Plata de los turnos ya marcados como asistidos. */
  billed: number;
  /** Plata de los que siguen en pie pero todavía no se cerraron. */
  scheduled: number;
  patients: number;
  fromApp: number;
  fromProfessional: number;
  unknownOrigin: number;
}

export interface DayLoad {
  averagePerDay: number;
  busiestDay: string | null;
  busiestDayAverage: number;
}

export interface MonthPoint extends Metrics {
  key: string;
  label: string;
}

export interface RecentMonth extends Metrics, DayLoad {
  key: string;
  label: string;
  /** El mes en curso no terminó: sus números van a seguir moviéndose. */
  inProgress: boolean;
}

export interface ProfessionalAnalytics {
  professional: { email: string; name: string; surname: string; speciality: string | null };
  recent: RecentMonth[];
  total: Metrics & DayLoad & { months: number };
  months: MonthPoint[];
}

export interface OfficeMetrics extends Metrics, DayLoad {
  sharedPatients: number;
  topOverbooker: { email: string; name: string; count: number } | null;
}

export interface OfficeAnalytics {
  headcount: number;
  professionals: { email: string; name: string; surname: string; speciality: string | null }[];
  recent: (RecentMonth & { sharedPatients: number; topOverbooker: OfficeMetrics["topOverbooker"] })[];
  total: OfficeMetrics & { months: number };
  months: (MonthPoint & { sharedPatients: number })[];
}

export async function myAnalytics(): Promise<ProfessionalAnalytics> {
  const { data } = await api.get("/analytics/me");
  return data.data;
}

/** Los números del consultorio entero. Solo admin. */
export async function officeAnalytics(): Promise<OfficeAnalytics> {
  const { data } = await api.get("/analytics/office");
  return data.data;
}

export async function professionalAnalytics(email: string): Promise<ProfessionalAnalytics> {
  const { data } = await api.get(`/analytics/professional/${encodeURIComponent(email)}`);
  return data.data;
}

export interface AssistantSpend {
  consultas: number;
  llamadasAlModelo: number;
  tokens: number;
  tokensDeEntrada: number;
  tokensDeSalida: number;
  tokensPorConsulta: number;
}

export interface AssistantUsage {
  mesEnCurso: AssistantSpend;
  historico: AssistantSpend;
  desde: string | null;
  porRol: { role: string; consultas: number; tokens: number }[];
  herramientas: { name: string; label: string; count: number }[];
  masUsada: { name: string; label: string; count: number } | null;
  personasDistintas: number;
}

/** Lo que gastó el asistente y para qué se lo usa. Solo admin. */
export async function assistantUsage(): Promise<AssistantUsage> {
  const { data } = await api.get("/analytics/assistant");
  return data.data;
}
