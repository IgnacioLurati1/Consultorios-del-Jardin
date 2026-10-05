import { badRequest } from "./errors.js";
import { words, type Words } from "./vocabulary.js";

/**
 * Las reglas de funcionamiento de una instalación.
 *
 * Son las que deciden si el turnero es autogestionado —el paciente pide su turno, el
 * profesional maneja su agenda— o más cerrado, con el sistema confirmando, cerrando y
 * cobrando solo y los profesionales sin poder tocar lo que ya está dado. Cada consultorio
 * se ubica en algún punto del medio, y por eso son reglas sueltas y no un modo.
 *
 * Quién las cambia:
 *
 * - **El dueño del sistema** (la consola de instalaciones) las cambia todas, y puede
 *   bloquear las que el cliente ve para que no las toque.
 * - **El cliente** (Configuración, en su panel) cambia las de alcance "client" que no
 *   estén bloqueadas.
 *
 * Los valores por omisión son lo que hacía el sistema antes de que existieran: con todas en
 * su valor de siempre, Consultorios del Jardín funciona igual que antes.
 *
 * Este archivo es la única lista. La consola y la pantalla de configuración se dibujan con
 * el catálogo que sale de acá (ver `policyCatalog`), así que una regla nueva se agrega en un
 * solo lugar.
 */

/** Lo decide cada profesional, siempre sí, o siempre no. */
export type Mode = "each" | "always" | "never";
/** Cómo se cierran solos los turnos que pasaron. */
export type MarkMode = "each" | "assisted" | "missed" | "never";
export type When = "appointment" | "day";
/** Para quién está el asistente. */
export type AssistantAccess = "all" | "staff" | "off";
/** Quién carga los períodos sin atender de cada profesional. */
export type VacationsBy = "professional" | "admin" | "both";

export interface Policies {
  patientBooking: boolean;
  acceptMode: Mode;
  patientCancel: boolean;
  cancelNoticeHours: number;
  openSignup: boolean;
  adminBooking: boolean;
  proCreate: boolean;
  proOverbook: boolean;
  proEdit: boolean;
  proCancel: boolean;
  proPatients: boolean;
  proRecurring: boolean;
  proCalendar: boolean;
  proDeleteHistory: boolean;
  vacations: VacationsBy;
  markMode: MarkMode;
  markWhen: When;
  payMode: Mode;
  payWhen: When;
  reminders: boolean;
  rentModule: boolean;
  rentMorning: string;
  rentAfternoon: string;
  assistant: AssistantAccess;
  multiBranch: boolean;
  /**
   * Desde cuándo rige el cierre o el cobro impuesto a todos. Igual que el `autoMarkSince`
   * de cada profesional: imponerlo no puede dar por cerrada ni cobrada la agenda vieja, que
   * es justamente donde puede haber ausencias y deudas de verdad. No se muestra: se anota
   * solo al pasar a un modo impuesto.
   */
  markSince: string | null;
  paySince: string | null;
}

export const DEFAULT_POLICIES: Policies = {
  patientBooking: true,
  acceptMode: "each",
  patientCancel: true,
  cancelNoticeHours: 0,
  openSignup: true,
  adminBooking: false,
  proCreate: true,
  proOverbook: true,
  proEdit: true,
  proCancel: true,
  proPatients: true,
  proRecurring: true,
  proCalendar: true,
  proDeleteHistory: true,
  vacations: "professional",
  markMode: "each",
  markWhen: "appointment",
  payMode: "each",
  payWhen: "appointment",
  reminders: true,
  rentModule: true,
  rentMorning: "09:00-13:00",
  rentAfternoon: "14:00-20:00",
  assistant: "all",
  multiBranch: false,
  markSince: null,
  paySince: null,
};

/* ============================================================
   El catálogo
   ============================================================ */

export type PolicyGroup = "reservas" | "profesionales" | "automatico" | "agenda" | "avisos" | "modulos";

export const POLICY_GROUPS: { key: PolicyGroup; title: (w: Words) => string }[] = [
  { key: "reservas", title: (w) => `${w.Turnos} y ${w.pacientes}` },
  { key: "profesionales", title: (w) => `Lo que puede hacer cada ${w.profesional}` },
  { key: "automatico", title: () => "Lo que hace el sistema solo" },
  { key: "agenda", title: () => "La agenda" },
  { key: "avisos", title: () => "Avisos" },
  { key: "modulos", title: () => "Partes del sistema" },
];

type Text = (w: Words) => string;

export interface PolicyDef {
  key: string;
  group: PolicyGroup;
  kind: "bool" | "choice" | "number" | "span";
  /** "owner" la cambia solo el dueño del sistema; "client" también el consultorio. */
  scope: "client" | "owner";
  /** Dónde se guarda: en el JSON de reglas o en su propia columna, que ya existía. */
  stored: "policies" | "column";
  label: Text;
  hint?: Text;
  options?: { value: string; label: Text }[];
  min?: number;
  max?: number;
  /** Para los números que aceptan "nada": cómo se lee esa opción. */
  nullLabel?: Text;
  /** Se muestra solo si esto da true con los valores actuales. */
  showIf?: (values: Record<string, unknown>) => boolean;
}

const forced = (key: string) => (values: Record<string, unknown>) => values[key] !== "each" && values[key] !== "never";

export const POLICY_DEFS: PolicyDef[] = [
  /* ---------- turnos y pacientes ---------- */
  {
    key: "patientBooking",
    group: "reservas",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `${w.Los("paciente")} piden ${w.turno} desde la web y la app`,
    hint: (w) => `Apagado, ${w.los("turno")} los carga solo ${w.el("profesional")}`,
  },
  {
    key: "acceptMode",
    group: "reservas",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: (w) => `Confirmación de ${w.los("turno")} pedid${w.os("turno")}`,
    options: [
      { value: "each", label: (w) => `La decide cada ${w.profesional}` },
      { value: "always", label: () => "Se confirman solos" },
      { value: "never", label: (w) => `Siempre l${w.os("turno")} confirma ${w.el("profesional")}` },
    ],
  },
  {
    key: "patientCancel",
    group: "reservas",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `${w.Los("paciente")} cancelan sus ${w.turnos}`,
    hint: (w) => `Apagado, una baja se pide ${w.al("lugar")}`,
  },
  {
    key: "cancelNoticeHours",
    group: "reservas",
    kind: "number",
    scope: "client",
    stored: "policies",
    min: 0,
    max: 168,
    label: () => "Horas de anticipación para cancelar",
    hint: (w) => `En cero, se puede cancelar hasta que empieza ${w.el("turno")}`,
    showIf: (values) => values.patientCancel !== false,
  },
  {
    key: "openSignup",
    group: "reservas",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: () => "Cualquiera puede crear su cuenta",
    hint: (w) => `Apagado, solo ${w.los("paciente")} que ya cargó ${w.un("profesional")}`,
  },
  {
    key: "adminBooking",
    group: "reservas",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `La administración da, mueve y cancela ${w.turnos} en cualquier agenda`,
    hint: () => "Es el trabajo de una recepción",
  },

  /* ---------- lo que puede hacer cada profesional ---------- */
  {
    key: "proCreate",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Carga ${w.turnos} a mano`,
  },
  {
    key: "proOverbook",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Da ${w.turnos} fuera de su horario`,
    hint: (w) => `Son ${w.los("turno")} especiales`,
    showIf: (values) => values.proCreate !== false,
  },
  {
    key: "proEdit",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Cambia fecha, hora, ${w.sala} o valor de ${w.un("turno")}`,
  },
  {
    key: "proCancel",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Cancela ${w.turnos} confirmad${w.os("turno")}`,
    hint: () => "Los pedidos sin contestar se pueden rechazar igual",
  },
  {
    key: "proPatients",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Carga ${w.pacientes} sin cuenta`,
  },
  {
    key: "proRecurring",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Arma ${w.turnos} que se repiten`,
    hint: (w) => `Apagado, ${w.los("turno")} repetibles que ya existen dejan de generar ${w.turnos} nuev${w.os("turno")}`,
  },
  {
    key: "proCalendar",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: () => "Importa y exporta su agenda a otro calendario",
  },
  {
    key: "proDeleteHistory",
    group: "profesionales",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Borra ${w.los("turno")} de ${w.un("paciente")}`,
  },
  {
    key: "vacations",
    group: "profesionales",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: () => "Quién carga las vacaciones",
    hint: (w) => `Los días de vacaciones ${w.el("profesional")} no aparece al pedir ${w.turno}`,
    options: [
      { value: "professional", label: (w) => `Cada ${w.profesional} las suyas` },
      { value: "admin", label: () => "Solo la administración" },
      { value: "both", label: (w) => `${w.El("profesional")} y la administración` },
    ],
  },

  /* ---------- lo que hace el sistema solo ---------- */
  {
    key: "markMode",
    group: "automatico",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: (w) => `Cerrar ${w.los("turno")} que ya pasaron`,
    options: [
      { value: "each", label: (w) => `Lo decide cada ${w.profesional}` },
      { value: "assisted", label: () => "Siempre como asistidos" },
      { value: "missed", label: () => "Siempre como ausentes" },
      { value: "never", label: (w) => `Nunca solos, l${w.os("turno")} cierra ${w.el("profesional")}` },
    ],
  },
  {
    key: "markWhen",
    group: "automatico",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: () => "Cuándo se cierran",
    options: [
      { value: "appointment", label: (w) => `Al terminar cada ${w.turno}` },
      { value: "day", label: () => "Al terminar el día" },
    ],
    showIf: forced("markMode"),
  },
  {
    key: "payMode",
    group: "automatico",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: (w) => `Dar por cobrad${w.os("turno")} ${w.los("turno")} atendid${w.os("turno")}`,
    options: [
      { value: "each", label: (w) => `Lo decide cada ${w.profesional}` },
      { value: "always", label: () => "Siempre" },
      { value: "never", label: (w) => `Nunca, el cobro lo marca ${w.el("profesional")}` },
    ],
  },
  {
    key: "payWhen",
    group: "automatico",
    kind: "choice",
    scope: "client",
    stored: "policies",
    label: () => "Cuándo se dan por cobrados",
    options: [
      { value: "appointment", label: (w) => `Al terminar cada ${w.turno}` },
      { value: "day", label: () => "Al terminar el día" },
    ],
    showIf: forced("payMode"),
  },

  /* ---------- la agenda (las reglas que ya existían, cada una en su columna) ---------- */
  {
    key: "bookingWeeksAhead",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 0,
    max: 26,
    label: () => "Semanas para reservar",
    hint: () => "En cero, solo la semana en curso",
  },
  {
    key: "minNoticeMinutes",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 0,
    max: 4320,
    label: () => "Anticipación mínima en minutos",
    hint: (w) => `En cero, se puede reservar hasta que empieza ${w.el("turno")}`,
  },
  {
    key: "slotStepMinutes",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 5,
    max: 240,
    label: (w) => `${w.Un("turno")} cada tantos minutos`,
    nullLabel: (w) => `${w.Un("turno")} detrás de otr${w.o("turno")}`,
  },
  {
    key: "bufferMinutes",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 0,
    max: 120,
    label: (w) => `Pausa entre ${w.turnos} en minutos`,
  },
  {
    key: "realignToOpening",
    group: "agenda",
    kind: "bool",
    scope: "client",
    stored: "column",
    label: () => "Arrancar los horarios cuando abre la sucursal",
  },
  { key: "opensSunday", group: "agenda", kind: "bool", scope: "client", stored: "column", label: () => "Atención los domingos" },
  {
    key: "maxActiveAppointments",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 0,
    max: 50,
    label: (w) => `${w.Turnos} activ${w.os("turno")} por ${w.paciente}`,
    hint: () => "En cero, sin tope",
  },
  {
    key: "shortNoticeHours",
    group: "agenda",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 0,
    max: 168,
    label: () => "Baja tardía en horas",
    hint: () => "Una baja con menos anticipación se marca aparte",
  },
  {
    key: "chargesMissed",
    group: "agenda",
    kind: "bool",
    scope: "client",
    stored: "column",
    label: () => "Las ausencias se cobran",
  },
  { key: "waitlistEnabled", group: "agenda", kind: "bool", scope: "client", stored: "column", label: () => "Lista de espera" },

  /* ---------- avisos ---------- */
  {
    key: "reminders",
    group: "avisos",
    kind: "bool",
    scope: "client",
    stored: "policies",
    label: (w) => `Recordatorio por mail antes de cada ${w.turno}`,
  },
  {
    key: "reminderHoursBefore",
    group: "avisos",
    kind: "number",
    scope: "client",
    stored: "column",
    min: 1,
    max: 168,
    label: (w) => `Horas antes ${w.del("turno")}`,
    nullLabel: () => "El día anterior",
    showIf: (values) => values.reminders !== false,
  },

  /* ---------- partes del sistema (solo el dueño) ---------- */
  {
    key: "rentModule",
    group: "modulos",
    kind: "bool",
    scope: "owner",
    stored: "policies",
    label: (w) => `Alquiler de ${w.los("sala")}`,
    hint: (w) => `Cuotas de cada ${w.profesional} por usar ${w.los("sala")}`,
  },
  {
    key: "rentMorning",
    group: "modulos",
    kind: "span",
    scope: "owner",
    stored: "policies",
    label: () => "Módulo de la mañana",
    hint: () => "Un tramo de esta duración se cobra con el precio de la mañana",
    showIf: (values) => values.rentModule !== false,
  },
  {
    key: "rentAfternoon",
    group: "modulos",
    kind: "span",
    scope: "owner",
    stored: "policies",
    label: () => "Módulo de la tarde",
    hint: () => "Más que esto se cobra como día entero",
    showIf: (values) => values.rentModule !== false,
  },
  {
    key: "assistant",
    group: "modulos",
    kind: "choice",
    scope: "owner",
    stored: "policies",
    label: () => "Asistente",
    options: [
      { value: "all", label: () => "Para todos" },
      { value: "staff", label: (w) => `Solo para ${w.profesionales} y administración` },
      { value: "off", label: () => "Apagado" },
    ],
  },
  {
    key: "multiBranch",
    group: "modulos",
    kind: "bool",
    scope: "owner",
    stored: "policies",
    label: (w) => `Varias ${w.sucursales}`,
    hint: (w) => `Se elige ${w.el("sucursal")} al pedir ${w.turno}, y cada ${w.profesional} muestra dónde atiende`,
  },
];

const DEF_BY_KEY = new Map(POLICY_DEFS.map((def) => [def.key, def]));

export function policyDef(key: string): PolicyDef | undefined {
  return DEF_BY_KEY.get(key);
}

/** Las claves de las reglas que se guardan en el JSON. */
const POLICY_KEYS = POLICY_DEFS.filter((def) => def.stored === "policies").map((def) => def.key);

/* ============================================================
   Leer y validar
   ============================================================ */

const SPAN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export function spanMinutes(span: string): { from: number; to: number } {
  const [, h1, m1, h2, m2] = SPAN.exec(span) ?? [];
  return { from: Number(h1) * 60 + Number(m1), to: Number(h2) * 60 + Number(m2) };
}

/** Un valor que llega para una regla, validado. Tira con un mensaje para mostrar. */
function validValue(def: PolicyDef, value: unknown): unknown {
  switch (def.kind) {
    case "bool":
      if (typeof value !== "boolean") throw badRequest(`"${def.label(words())}" va prendido o apagado`);
      return value;
    case "choice":
      if (!def.options!.some((option) => option.value === value)) throw badRequest(`"${def.label(words())}" no tiene esa opción`);
      return value;
    case "number": {
      const number = Number(value);
      if (!Number.isInteger(number) || number < def.min! || number > def.max!)
        throw badRequest(`"${def.label(words())}" va de ${def.min} a ${def.max}`);
      return number;
    }
    case "span": {
      const text = String(value ?? "").trim();
      if (!SPAN.test(text)) throw badRequest(`"${def.label(words())}" se escribe como 09:00-13:00`);
      const { from, to } = spanMinutes(text);
      if (from >= to) throw badRequest(`"${def.label(words())}" tiene que terminar después de empezar`);
      return text;
    }
  }
}

/**
 * Las reglas guardadas, completas.
 *
 * Lo que falta o vino roto toma el valor de siempre: una regla agregada después de que se
 * creó la instalación no puede dejarla sin funcionar.
 */
export function policiesOf(raw: string | null | undefined, fallback: Policies = DEFAULT_POLICIES): Policies {
  let parsed: Record<string, unknown> = {};
  try {
    const value = raw ? JSON.parse(raw) : {};
    if (value && typeof value === "object" && !Array.isArray(value)) parsed = value;
  } catch {
    parsed = {};
  }

  const out: Record<string, unknown> = { ...fallback };
  for (const key of POLICY_KEYS) {
    if (parsed[key] === undefined) continue;
    try {
      out[key] = validValue(DEF_BY_KEY.get(key)!, parsed[key]);
    } catch {
      // Un valor viejo que ya no vale se queda con el de siempre.
    }
  }
  for (const key of ["markSince", "paySince"] as const) {
    out[key] = typeof parsed[key] === "string" && !Number.isNaN(Date.parse(parsed[key] as string)) ? parsed[key] : null;
  }

  return out as unknown as Policies;
}

/**
 * Aplica cambios a las reglas guardadas, validando cada uno.
 *
 * Si un modo pasa a imponerse a todos, anota desde cuándo (ver `markSince`).
 */
export function applyPolicyChanges(current: Policies, changes: Record<string, unknown>, now = new Date()): Policies {
  const next: Record<string, unknown> = { ...current };

  for (const [key, value] of Object.entries(changes)) {
    const def = DEF_BY_KEY.get(key);
    if (!def || def.stored !== "policies") throw badRequest(`No existe la regla "${key}"`);
    next[key] = validValue(def, value);
  }

  const result = next as unknown as Policies;

  if (result.markMode !== current.markMode) result.markSince = forcedMark(result.markMode) ? now.toISOString() : null;
  if (result.payMode !== current.payMode) result.paySince = result.payMode === "always" ? now.toISOString() : null;

  // Los dos módulos de alquiler se distinguen por lo que duran, y la mañana va antes que la tarde.
  const morning = spanMinutes(result.rentMorning);
  const afternoon = spanMinutes(result.rentAfternoon);
  if (morning.to > afternoon.from) throw badRequest("El módulo de la mañana tiene que terminar antes de que empiece el de la tarde");
  if (morning.to - morning.from === afternoon.to - afternoon.from)
    throw badRequest("Los módulos de la mañana y de la tarde tienen que durar distinto: el precio sale de lo que dura cada tramo");

  return result;
}

function forcedMark(mode: MarkMode): boolean {
  return mode === "assisted" || mode === "missed";
}

/* ============================================================
   Lo que cada regla quiere decir para un profesional
   ============================================================ */

interface ProfessionalFlags {
  autoAccept: boolean;
  autoMark?: string | null;
  autoMarkWhen: When;
  autoMarkSince?: Date | null;
  autoPay: boolean;
  autoPayWhen: When;
  autoPaySince?: Date | null;
}

/** Si un turno que pide un paciente nace confirmado. */
export function acceptsAutomatically(policies: Policies, professional: Pick<ProfessionalFlags, "autoAccept">): boolean {
  if (policies.acceptMode === "always") return true;
  if (policies.acceptMode === "never") return false;
  return !!professional.autoAccept;
}

/** Cómo se cierran solos los turnos de un profesional, o null si no se cierran. */
export function markFor(
  policies: Policies,
  professional: ProfessionalFlags
): { state: "assisted" | "missed"; when: When; since: Date } | null {
  if (policies.markMode === "never") return null;
  if (forcedMark(policies.markMode)) {
    return {
      state: policies.markMode as "assisted" | "missed",
      when: policies.markWhen,
      since: policies.markSince ? new Date(policies.markSince) : new Date(),
    };
  }
  if (professional.autoMark !== "assisted" && professional.autoMark !== "missed") return null;
  return { state: professional.autoMark, when: professional.autoMarkWhen, since: professional.autoMarkSince ?? new Date() };
}

/** Si los turnos atendidos de un profesional se dan por cobrados solos, y desde cuándo. */
export function payFor(policies: Policies, professional: ProfessionalFlags): { when: When; since: Date } | null {
  if (policies.payMode === "never") return null;
  if (policies.payMode === "always") {
    return { when: policies.payWhen, since: policies.paySince ? new Date(policies.paySince) : new Date() };
  }
  if (!professional.autoPay) return null;
  return { when: professional.autoPayWhen, since: professional.autoPaySince ?? new Date() };
}

/* ============================================================
   El catálogo para las pantallas
   ============================================================ */

export interface CatalogEntry {
  key: string;
  group: PolicyGroup;
  kind: PolicyDef["kind"];
  scope: PolicyDef["scope"];
  label: string;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  nullLabel?: string;
  locked: boolean;
  visible: boolean;
}

/**
 * Las reglas con sus textos ya escritos, para dibujarlas.
 *
 * `who` es quién mira: el cliente recibe solo las suyas, con las bloqueadas marcadas; el
 * dueño recibe todas.
 */
export function policyCatalog(
  w: Words,
  values: Record<string, unknown>,
  locked: string[],
  who: "client" | "owner"
): { groups: { key: PolicyGroup; title: string }[]; rules: CatalogEntry[] } {
  const rules = POLICY_DEFS.filter((def) => who === "owner" || def.scope === "client").map((def) => ({
    key: def.key,
    group: def.group,
    kind: def.kind,
    scope: def.scope,
    label: def.label(w),
    hint: def.hint?.(w),
    options: def.options?.map((option) => ({ value: option.value, label: option.label(w) })),
    min: def.min,
    max: def.max,
    nullLabel: def.nullLabel?.(w),
    locked: locked.includes(def.key),
    visible: def.showIf ? def.showIf(values) : true,
  }));

  const used = new Set(rules.map((rule) => rule.group));
  return {
    groups: POLICY_GROUPS.filter((group) => used.has(group.key)).map((group) => ({ key: group.key, title: group.title(w) })),
    rules,
  };
}

/** Las claves que se pueden bloquear: las que el cliente ve. */
export function lockableKeys(): string[] {
  return POLICY_DEFS.filter((def) => def.scope === "client").map((def) => def.key);
}

/** La lista de bloqueadas guardada, sin claves que ya no existan. */
export function lockedOf(raw: string | null | undefined): string[] {
  try {
    const value = raw ? JSON.parse(raw) : [];
    const allowed = new Set(lockableKeys());
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string" && allowed.has(key)) : [];
  } catch {
    return [];
  }
}

/* ============================================================
   Los dos puntos de partida de la consola
   ============================================================ */

/**
 * Los puntos de partida para una instalación nueva. Son un atajo: cargan varias reglas de
 * una vez, y después cada una se ajusta suelta.
 */
export const POLICY_PRESETS: { key: string; label: string; description: string; values: Partial<Policies> }[] = [
  {
    key: "autogestion",
    label: "Autogestión",
    description: "Como Consultorios del Jardín: el paciente pide y cancela solo, y cada profesional maneja su agenda.",
    values: {
      patientBooking: true,
      acceptMode: "each",
      patientCancel: true,
      cancelNoticeHours: 0,
      openSignup: true,
      adminBooking: false,
      proCreate: true,
      proOverbook: true,
      proEdit: true,
      proCancel: true,
      proPatients: true,
      proRecurring: true,
      proCalendar: true,
      proDeleteHistory: true,
      vacations: "professional",
      markMode: "each",
      payMode: "each",
    },
  },
  {
    key: "cerrado",
    label: "Cerrado",
    description:
      "El paciente pide su turno y el sistema lo confirma, lo cierra y lo da por cobrado solo. Los profesionales atienden: no cargan, mueven ni cancelan turnos.",
    values: {
      patientBooking: true,
      acceptMode: "always",
      patientCancel: true,
      cancelNoticeHours: 24,
      openSignup: true,
      adminBooking: false,
      proCreate: false,
      proOverbook: false,
      proEdit: false,
      proCancel: false,
      proPatients: false,
      proRecurring: false,
      proCalendar: false,
      proDeleteHistory: false,
      vacations: "both",
      markMode: "assisted",
      markWhen: "appointment",
      payMode: "always",
      payWhen: "appointment",
    },
  },
  {
    key: "recepcion",
    label: "Con recepción",
    description:
      "La administración da los turnos, los mueve y los cancela. Los pacientes no piden ni cancelan por la web, y los profesionales atienden.",
    values: {
      patientBooking: false,
      acceptMode: "always",
      patientCancel: false,
      cancelNoticeHours: 0,
      openSignup: false,
      adminBooking: true,
      proCreate: false,
      proOverbook: false,
      proEdit: false,
      proCancel: false,
      proPatients: false,
      proRecurring: false,
      proCalendar: false,
      proDeleteHistory: false,
      vacations: "admin",
      markMode: "each",
      payMode: "each",
    },
  },
];
