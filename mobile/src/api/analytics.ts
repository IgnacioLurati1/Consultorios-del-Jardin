import api from "./client";

/** Lo que se mide de un recorte de turnos sin mirar la plata. */
export interface Activity {
  appointments: number;
  assisted: number;
  missed: number;
  cancelled: number;
  overbooked: number;
  patients: number;
  fromApp: number;
  fromProfessional: number;
  unknownOrigin: number;
}

/** La plata del mismo recorte. */
export interface Billing {
  /** Plata de los turnos ya marcados como asistidos. */
  billed: number;
  /** Plata de los que siguen en pie pero todavía no se cerraron. */
  scheduled: number;
}

/** Métricas de un recorte de turnos. Todas salen de las mismas filas, así que cierran entre sí. */
export type Metrics = Activity & Billing;

/**
 * Lo que llega de un profesional: la facturación solo cuando la mira él. Al admin el
 * backend le saca esas dos cifras, así que acá son opcionales.
 */
export type ProfessionalMetrics = Activity & Partial<Billing>;

/**
 * Pedidos de turno que no llegaron a ser turno.
 *
 * No sale de las mismas filas que el resto: rechazar un pedido pendiente lo borra, así
 * que viene de un contador mensual que lleva el backend.
 */
export interface Denials {
  /** Los que rechazó a mano más los que venció el sistema. */
  denied: number;
  /** De los anteriores, los que se cayeron solos porque nunca los contestó. */
  expired: number;
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

/** Los números propios del profesional: acá la plata siempre viene. */
export interface SelfAnalytics {
  professional: { email: string; name: string; surname: string; speciality: string | null };
  recent: (RecentMonth & { denials: Denials })[];
  total: Metrics & DayLoad & { months: number; denials: Denials };
  months: MonthPoint[];
}

export interface ProfessionalAnalytics {
  professional: { email: string; name: string; surname: string; speciality: string | null };
  recent: (ProfessionalMetrics & DayLoad & { key: string; label: string; inProgress: boolean; denials: Denials })[];
  total: ProfessionalMetrics & DayLoad & { months: number; denials: Denials };
  months: (ProfessionalMetrics & { key: string; label: string })[];
}

export interface OfficeMetrics extends Metrics, DayLoad {
  sharedPatients: number;
  topOverbooker: { email: string; name: string; count: number } | null;
}

/**
 * Por dónde entra la gente al sistema.
 *
 * `app` y `web` son los totales que se leen como "cuántos usan cada cosa", y cuentan dos
 * veces a quien usa las dos. `onlyApp`, `onlyWeb`, `both` y `unknown` son la partición:
 * esas cuatro suman la cantidad de cuentas.
 */
export interface AccessChannels {
  accounts: number;
  withAccess: number;
  onlyApp: number;
  onlyWeb: number;
  both: number;
  unknown: number;
  app: number;
  web: number;
  /** Desde cuándo hay dato. Sin esto, "sin registro" no se puede interpretar. */
  since: string | null;
  byRole: { role: string; onlyApp: number; onlyWeb: number; both: number; unknown: number }[];
}

export interface OfficeAnalytics {
  headcount: number;
  channels: AccessChannels;
  professionals: { email: string; name: string; surname: string; speciality: string | null }[];
  recent: (RecentMonth & { sharedPatients: number; topOverbooker: OfficeMetrics["topOverbooker"] })[];
  total: OfficeMetrics & { months: number };
  months: (MonthPoint & { sharedPatients: number })[];
}

export async function myAnalytics(): Promise<SelfAnalytics> {
  const { data } = await api.get("/analytics/me");
  return data.data;
}

/** Los números del consultorio entero. Solo admin. */
export async function officeAnalytics(): Promise<OfficeAnalytics> {
  const { data } = await api.get("/analytics/office");
  return data.data;
}

/**
 * Los números de un profesional puntual. Solo admin, y llegan sin `billed` ni `scheduled`:
 * lo que factura cada uno es dato suyo. El total del consultorio está en `officeAnalytics`.
 */
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
