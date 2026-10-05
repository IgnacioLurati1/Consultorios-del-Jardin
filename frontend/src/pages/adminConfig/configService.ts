import api from "../../axios.ts";
import type { HeroStyle, HomeBlock, HomeTemplate, HomeVariants, PanelSkin } from "../../lib/installation.ts";
import type { Vocabulary } from "../../lib/vocabulary.ts";
import type { Policies } from "../../lib/policies.ts";
import type { ContactReasonEntry, FaqEntry } from "../../lib/contentLists.ts";

export type RuleGroupKey = "reservas" | "profesionales" | "automatico" | "agenda" | "avisos" | "modulos";

/** Una regla del catálogo, con sus textos ya escritos. Ver shared/policies en el servidor. */
export interface RuleEntry {
  key: string;
  group: RuleGroupKey;
  kind: "bool" | "choice" | "number" | "span";
  label: string;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  nullLabel?: string;
  locked: boolean;
}

export interface RulesCatalog {
  groups: { key: RuleGroupKey; title: string }[];
  rules: RuleEntry[];
}

/**
 * La configuración completa del consultorio, como la edita la administración.
 *
 * Es la misma que la pública (ver lib/installation) más lo que no se le cuenta a quien
 * pide un turno: si las ausencias se cobran, cuándo sale el recordatorio, qué sabe el
 * asistente. La lee y la guarda el servidor en `/api/installation`, solo para admins.
 */
export interface OfficeConfig {
  name: string;
  tagline: string;
  address: string;
  city: string;
  publicHours: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapEmbedUrl: string | null;
  directionsUrl: string | null;
  visitAdvice: string;
  services: string[];
  brandHue: number | null;
  brandSaturation: number | null;
  heroStyle: HeroStyle;
  homeTemplate: HomeTemplate;
  panelSkin: PanelSkin;
  homeBlocksGuest: HomeBlock[];
  homeBlocksMember: HomeBlock[];
  /** El diseño de las secciones que no siguen al diseño general. Un servidor anterior no lo trae. */
  homeVariants?: Partial<HomeVariants>;
  /** Los colores propios de la barra, el pie y los mails. Un servidor anterior no los trae. */
  elementColors?: Partial<Record<"header" | "footer" | "mail", string>>;
  assistantTone: "voseo" | "tuteo" | "usted";
  assistantNotes: string;
  vocabulary: Vocabulary;
  bookingWeeksAhead: number;
  slotStepMinutes: number | null;
  bufferMinutes: number;
  realignToOpening: boolean;
  minNoticeMinutes: number;
  shortNoticeHours: number;
  opensSunday: boolean;
  reminderHoursBefore: number | null;
  chargesMissed: boolean;
  maxActiveAppointments: number;
  waitlistEnabled: boolean;
  /** Las reglas de funcionamiento. */
  policies: Policies;
  /** El catálogo para dibujarlas. No se manda al guardar. Un servidor anterior no lo trae. */
  rules?: RulesCatalog;
  /** El ícono y la foto de cada especialidad, por nombre. */
  specialityStyles: Record<string, { icon: string | null; imageId: string | null }>;
  /** Las preguntas frecuentes. Un servidor anterior no las trae. */
  faq?: FaqEntry[];
  /** Los motivos del formulario de contacto. Un servidor anterior no los trae. */
  contactReasons?: ContactReasonEntry[];
  /**
   * Las fotos de la portada y de la galería, en orden. Son parte del borrador: se publican
   * al guardar. Un servidor anterior no las trae.
   */
  photos?: { hero: AdminImage[]; gallery: AdminImage[] };
}

export async function getOfficeConfig(): Promise<OfficeConfig> {
  const { data } = await api.get("/installation/all");
  return data.data;
}

/**
 * Guarda lo que cambió y devuelve cómo quedó.
 *
 * Se manda solo lo que se tocó. El servidor rechaza el pedido entero si un valor no entra
 * en su rango, con un mensaje que se puede mostrar tal cual.
 */
export async function saveOfficeConfig(changes: Partial<OfficeConfig>): Promise<OfficeConfig> {
  const { data } = await api.patch("/installation", changes);
  return data.data;
}

export type PreviewKind = "pedido" | "confirmado" | "recordatorio" | "cancelado" | "profesional";

/**
 * Un mail de muestra con lo que se está editando, sin guardar ni mandar nada.
 *
 * Lo arma el servidor con las mismas funciones que los mails de verdad, así que lo que se
 * ve es lo que llega.
 */
export async function previewMail(
  kind: PreviewKind,
  draft: Partial<OfficeConfig>,
  signal?: AbortSignal
): Promise<{ subject: string; html: string }> {
  const { data } = await api.post("/installation/preview-mail", { kind, ...draft }, { signal });
  return data.data;
}

/** El mensaje del servidor, o uno que diga qué hacer. */
export function messageOf(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? "No se pudo guardar la configuración";
}

/* ============================================================
   Las fotos de la portada. Se guardan al subirlas, no con el resto.
   ============================================================ */

export type ImageSlot = "hero" | "gallery" | "speciality";

/** Cuántas fotos entran en cada lugar. Las mismas que controla el servidor. */
export const SLOT_LIMITS: Record<ImageSlot, number> = { hero: 5, gallery: 12, speciality: 30 };

/** El tope del archivo. El mismo que controla el servidor. */
export const MAX_UPLOAD_MB = 10;

export interface AdminImage {
  id: string;
  slot: ImageSlot;
  position: number;
  alt: string;
  width: number;
  height: number;
  preview: string;
  /** Subida y sin guardar: se publica al guardar la configuración. */
  pending?: boolean;
}

export async function listImages(): Promise<AdminImage[]> {
  const { data } = await api.get("/installation/images");
  return data.data;
}

export async function uploadImage(slot: ImageSlot, file: File, alt: string): Promise<AdminImage> {
  const form = new FormData();
  form.append("slot", slot);
  form.append("alt", alt);
  form.append("file", file);
  // Sin el Content-Type fijo de la instancia: con un formulario lo tiene que poner el
  // navegador, que es el que sabe el separador de las partes. Igual que la importación.
  const { data } = await api.post("/installation/images", form, { headers: { "Content-Type": undefined } });
  return data.data;
}

/** Borra una foto subida que no se guardó. Una publicada se saca del borrador y se va al guardar. */
export async function deleteImage(id: string): Promise<void> {
  await api.delete(`/installation/images/${encodeURIComponent(id)}`);
}

