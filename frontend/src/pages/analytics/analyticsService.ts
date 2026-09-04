import api from "../../axios";

/** Lo que se mide de un recorte de turnos sin mirar la plata. */
export interface Activity {
  /** Turnos que no se cancelaron. */
  appointments: number;
  assisted: number;
  missed: number;
  cancelled: number;
  overbooked: number;
  patients: number;
  fromApp: number;
  fromProfessional: number;
  /** Turnos anteriores a que se guardara el origen: no se pueden clasificar. */
  unknownOrigin: number;
}

/** La plata del mismo recorte. */
export interface Billing {
  /**
   * Plata que entró: los turnos atendidos y cobrados, más lo cobrado de los parciales.
   *
   * Los turnos anteriores al registro de cobro cuentan completos. De esos no se sabe si
   * se cobraron, y darlos por impagos borraría la facturación de toda la historia.
   */
  billed: number;
  /** Lo que falta cobrar de los turnos que siguen en pie y todavía no se cerraron. */
  scheduled: number;
}

/** Métricas de un recorte de turnos. Todas salen de las mismas filas, así que cierran entre sí. */
export type Metrics = Activity & Billing;

/**
 * Lo que llega de un profesional.
 *
 * La facturación viene solo cuando la mira él. El admin la recibe sin esas dos cifras,
 * así que acá son opcionales y la pantalla se fija si están: la ausencia del dato es lo
 * que decide si el bloque de plata se dibuja.
 */
export type ProfessionalMetrics = Activity & Partial<Billing>;

export interface DayLoad {
  averagePerDay: number;
  busiestDay: string | null;
  busiestDayAverage: number;
}

export interface MonthPoint extends Metrics {
  key: string;
  label: string;
}

/**
 * Pedidos de turno que no llegaron a ser turno.
 *
 * No sale de las mismas filas que el resto: rechazar un pedido pendiente lo borra, así
 * que esto viene de un contador mensual que lleva el backend. Por eso va en su propio
 * campo y no mezclado con las métricas, que sí cierran todas entre sí.
 */
export interface Denials {
  /** Los que rechazó a mano más los que venció el sistema. */
  denied: number;
  /** De los anteriores, los que se cayeron solos porque nunca los contestó. */
  expired: number;
}

export type ProfessionalMonthPoint = ProfessionalMetrics & { key: string; label: string };

/** Un mes que se puede mirar en tarjetas: el que corre y el anterior. */
export interface RecentMonth extends Metrics, DayLoad {
  key: string;
  label: string;
  /** El mes en curso todavía no terminó, así que sus números van a seguir moviéndose. */
  inProgress: boolean;
}

/** Lo que le quedaron debiendo. Solo viaja cuando el profesional mira lo suyo. */
export interface Debt {
  /** Cuánta gente le debe al menos un turno, contando los pagos a medias. */
  people: number;
  appointments: number;
  amount: number;
}

export type ProfessionalRecentMonth = ProfessionalMetrics &
  DayLoad & {
    key: string;
    label: string;
    inProgress: boolean;
    denials: Denials;
    /** Lo que quedó sin cobrar de ese mes. Ausente cuando el que mira es un administrador. */
    debt?: Debt;
  };

export interface ProfessionalAnalytics {
  professional: { email: string; name: string; surname: string; speciality: string | null };
  recent: ProfessionalRecentMonth[];
  total: ProfessionalMetrics & DayLoad & { months: number; denials: Denials };
  months: ProfessionalMonthPoint[];
  /** Ausente para el administrador que mira los números de un profesional. */
  debt?: Debt;
}

export interface OfficeMetrics extends Metrics, DayLoad {
  sharedPatients: number;
  topOverbooker: { email: string; name: string; count: number } | null;
}

/**
 * Por dónde entra la gente al sistema.
 *
 * `app` y `web` son los totales que se leen como "cuántos usan cada cosa", y por eso
 * cuentan dos veces a quien usa las dos. `onlyApp`, `onlyWeb` y `both` son la partición:
 * esas tres sí suman, junto con `unknown`, la cantidad de cuentas.
 */
export interface AccessChannels {
  /** Cuentas que pueden iniciar sesión. */
  accounts: number;
  /** Cuántas de esas entraron al menos una vez desde que se mide. */
  withAccess: number;
  onlyApp: number;
  onlyWeb: number;
  both: number;
  /** Con cuenta, pero sin ningún acceso registrado. */
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
  /** Lo que va del día. El plan gratuito de Groq se mide así y se reinicia a medianoche. */
  hoy: AssistantSpend;
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

/**
 * Los números de un profesional puntual. Solo admin.
 *
 * Llegan sin `billed` ni `scheduled`: lo que factura cada uno es dato suyo. El total
 * del consultorio, que no es de nadie en particular, está en `findOfficeAnalytics`.
 */
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
