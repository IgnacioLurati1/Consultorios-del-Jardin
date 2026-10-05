/**
 * Las reglas de funcionamiento del consultorio, del lado de la pantalla.
 *
 * Es el espejo de `backend/src/shared/policies.ts`. Allá están el catálogo, la validación y
 * los controles de verdad; acá solo lo que la pantalla necesita para no ofrecer lo que el
 * consultorio no permite: el botón que no va, la sección que no existe.
 *
 * Esconder no alcanza como control (lo hace el servidor), pero sí evita que alguien toque un
 * botón para enterarse recién ahí de que no se puede.
 */

export type Mode = "each" | "always" | "never";
export type MarkMode = "each" | "assisted" | "missed" | "never";
export type When = "appointment" | "day";
export type AssistantAccess = "all" | "staff" | "off";
/** Quién carga las vacaciones de cada profesional. */
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
}

/** Lo que hacía el sistema antes de que existieran las reglas. */
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
};

const CHOICES: Partial<Record<keyof Policies, readonly string[]>> = {
  acceptMode: ["each", "always", "never"],
  markMode: ["each", "assisted", "missed", "never"],
  markWhen: ["appointment", "day"],
  payMode: ["each", "always", "never"],
  payWhen: ["appointment", "day"],
  assistant: ["all", "staff", "off"],
  vacations: ["professional", "admin", "both"],
};

/**
 * Lo que mandó el servidor, completo.
 *
 * Un servidor anterior a las reglas no manda nada, y entonces vale todo lo de siempre: la
 * pantalla nueva funciona igual contra el backend viejo. Lo que llega con otro tipo también
 * cae al de siempre.
 */
export function policiesFrom(input: unknown): Policies {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_POLICIES } as Record<string, unknown>;

  for (const [key, fallback] of Object.entries(DEFAULT_POLICIES)) {
    const value = raw[key];
    if (value === undefined) continue;
    const choices = CHOICES[key as keyof Policies];
    if (choices) out[key] = choices.includes(String(value)) ? value : fallback;
    else if (typeof fallback === typeof value) out[key] = value;
  }

  return out as unknown as Policies;
}

/** Si el asistente se le muestra a este tipo de cuenta. */
export function assistantFor(policies: Policies, type: string | null | undefined): boolean {
  if (policies.assistant === "off") return false;
  if (policies.assistant === "staff") return type === "professional" || type === "admin";
  return true;
}
