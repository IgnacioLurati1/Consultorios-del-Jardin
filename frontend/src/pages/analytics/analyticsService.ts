import api from "../../axios";

/** Métricas de un recorte de turnos. Todas salen de las mismas filas, así que cierran entre sí. */
export interface Metrics {
  /** Turnos que no se cancelaron. */
  appointments: number;
  assisted: number;
  missed: number;
  cancelled: number;
  overbooked: number;
  /** Plata de los turnos ya marcados como asistidos. */
  billed: number;
  /** Plata de los turnos que siguen en pie pero todavía no se cerraron. */
  scheduled: number;
  patients: number;
  fromApp: number;
  fromProfessional: number;
  /** Turnos anteriores a que se guardara el origen: no se pueden clasificar. */
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

/** Un mes que se puede mirar en tarjetas: el que corre y el anterior. */
export interface RecentMonth extends Metrics, DayLoad {
  key: string;
  label: string;
  /** El mes en curso todavía no terminó, así que sus números van a seguir moviéndose. */
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

function unwrap(err: any): never {
  throw new Error(err.response?.data?.message || err.message);
}

/** Los números del profesional logueado. */
export function findMyAnalytics(): Promise<ProfessionalAnalytics> {
  return api
    .get("/analytics/me")
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Los números del consultorio entero. Solo admin. */
export function findOfficeAnalytics(): Promise<OfficeAnalytics> {
  return api
    .get("/analytics/office")
    .then((response) => response.data.data)
    .catch(unwrap);
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
  /** Ranking de funciones. `label` viene del backend, que es quien las define. */
  herramientas: { name: string; label: string; count: number }[];
  masUsada: { name: string; label: string; count: number } | null;
  personasDistintas: number;
}

/** Lo que gastó el asistente y para qué se lo usa. Solo admin. */
export function findAssistantUsage(): Promise<AssistantUsage> {
  return api
    .get("/analytics/assistant")
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Los números de un profesional puntual. Solo admin. */
export function findProfessionalAnalytics(email: string): Promise<ProfessionalAnalytics> {
  return api
    .get(`/analytics/professional/${encodeURIComponent(email)}`)
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Plata, sin centavos: en el panel no aportan y ensucian la lectura. */
export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

/** Un promedio se muestra con un decimal, salvo que sea redondo. */
export function decimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
