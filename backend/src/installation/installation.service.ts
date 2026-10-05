import { orm } from "../shared/db/orm.js";
import { Installation } from "./installation.entity.js";
import { SiteImage } from "./siteImage.entity.js";
import { savePhotos } from "./images.service.js";
import { faqOf, parseFaq, type FaqEntry } from "../shared/faq.js";
import { elementColorsOf, parseElementColors, type ElementColors } from "../shared/elementColors.js";
import { parseReasons, reasonsOf, type ContactReasonEntry } from "../shared/contactReasons.js";
import { Office } from "../offices/offices.entity.js";
import { badRequest, forbidden } from "../shared/errors.js";
import { tokenIssuer } from "../config/tokens.js";
import { Person } from "../people/people.entity.js";
import { canonicalSpeciality, normalizeSpecialityList, stylesFor, type SpecialityStyle } from "../shared/specialities.js";
import { parseVocabulary, vocabularyOf, words, type Vocabulary, type Words } from "../shared/vocabulary.js";
import {
  DEFAULT_POLICIES,
  applyPolicyChanges,
  lockableKeys,
  lockedOf,
  policiesOf,
  policyCatalog,
  policyDef,
  type Policies,
} from "../shared/policies.js";

/**
 * Lectura y escritura de la configuración de la instalación.
 *
 * Se lee en cada alta de turno, en cada listado de horarios y en cada mail, así que no
 * puede ser una consulta por vez: queda guardada en memoria del proceso con un
 * vencimiento corto.
 *
 * El vencimiento, y no una invalidación perfecta, porque con dos instancias del proceso un
 * cambio hecho en una no puede avisarle a la otra. Un minuto de desfasaje entre que se
 * guarda el horizonte de reserva y que la otra instancia lo ve es aceptable; una consulta
 * por slot de la grilla, no.
 */

/** Cuánto vale lo que está en memoria. */
const CACHE_MS = 60 * 1000;

let cached: Config | null = null;
let cachedAt = 0;

/** Las fotos de la portada que van en la configuración pública, con el mismo vencimiento. */
let cachedImages: PublicImage[] | null = null;
let cachedImagesAt = 0;

/** Las sucursales que van en la configuración pública, con el mismo vencimiento. */
let cachedBranches: PublicBranch[] | null = null;
let cachedBranchesAt = 0;

export interface PublicBranch {
  id: number;
  name: string;
  address: string | null;
  city: string;
  opens: string;
  closes: string;
}

export interface PublicImage {
  id: string;
  slot: string;
  alt: string;
  width: number;
  height: number;
  preview: string;
}

/** La configuración, ya en la forma en que la usa el resto del código. */
export interface Config {
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
  spaceTour: boolean;
  visitAdvice: string;
  /** Lo que se atiende, ya separado y sin espacios de más. */
  services: string[];
  /** El ícono y la foto de cada especialidad, por nombre. */
  specialityStyles: Record<string, SpecialityStyle>;
  brandHue: number | null;
  brandSaturation: number | null;
  heroStyle: HeroStyle;
  homeTemplate: HomeTemplate;
  panelSkin: PanelSkin;
  homeBlocksGuest: HomeBlock[];
  homeBlocksMember: HomeBlock[];
  /** El diseño de cada sección que no sigue al diseño general. */
  homeVariants: HomeVariants;
  /** Los colores propios de la barra, el pie y los mails. Ver shared/elementColors. */
  elementColors: ElementColors;
  assistantTone: AssistantTone;
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
  /** Las reglas de funcionamiento, completas. Ver shared/policies. */
  policies: Policies;
  /** Las reglas que el consultorio no puede cambiar porque las bloqueó el dueño del sistema. */
  locked: string[];
  /** Las preguntas frecuentes, en orden. Ver shared/faq. */
  faq: FaqEntry[];
  /** Los motivos del formulario de contacto, en orden. Ver shared/contactReasons. */
  contactReasons: ContactReasonEntry[];
  updatedAt: Date;
}

/**
 * Los límites de cada número, con su piso y su techo.
 *
 * El piso no es decoración. Un horizonte de cero días deja el sistema sin turnos, y un
 * colchón de media hora entre turnos de media hora deja la agenda a la mitad sin que nadie
 * lo haya querido. Lo que no entra en el rango se rechaza con el mensaje puesto, no se
 * recorta en silencio.
 */
const RANGOS = {
  bookingWeeksAhead: { min: 0, max: 26, texto: "El horizonte de reserva va de 0 a 26 semanas" },
  slotStepMinutes: { min: 5, max: 240, texto: "El paso de la grilla va de 5 a 240 minutos" },
  bufferMinutes: { min: 0, max: 120, texto: "El colchón entre turnos va de 0 a 120 minutos" },
  minNoticeMinutes: { min: 0, max: 4320, texto: "El aviso mínimo va de 0 a 4320 minutos" },
  shortNoticeHours: { min: 0, max: 168, texto: "La ventana de baja tardía va de 0 a 168 horas" },
  reminderHoursBefore: { min: 1, max: 168, texto: "El recordatorio va de 1 a 168 horas antes" },
  brandHue: { min: 0, max: 360, texto: "El tono de la marca va de 0 a 360" },
  brandSaturation: { min: 0, max: 100, texto: "La saturación de la marca va de 0 a 100" },
  maxActiveAppointments: { min: 0, max: 50, texto: "El tope de turnos activos va de 0 a 50" },
} as const;

/** Los textos y su largo máximo, que es el de la columna. */
const TEXTOS = {
  name: 120,
  tagline: 200,
  address: 160,
  city: 80,
  publicHours: 120,
  instagram: 80,
  phone: 40,
  whatsapp: 40,
  email: 160,
  directionsUrl: 400,
  visitAdvice: 160,
  services: 400,
} as const;

const BOOLEANOS = ["realignToOpening", "opensSunday", "chargesMissed", "waitlistEnabled"] as const;

const ACEPTAN_NADA = new Set(["slotStepMinutes", "reminderHoursBefore", "brandHue", "brandSaturation"]);

/** Cómo le habla el asistente a la gente. Ver `assistantTone` en la entidad. */
export const ASSISTANT_TONES = ["voseo", "tuteo", "usted"] as const;
export type AssistantTone = (typeof ASSISTANT_TONES)[number];

/** Largo máximo de lo que el consultorio le cuenta al asistente. Es prompt: cada letra se paga. */
export const ASSISTANT_NOTES_MAX = 1000;

/**
 * Los estilos de panel que existen. Cada uno es un juego de valores en adminPanel.css de la
 * web; uno que no esté acá no tiene cómo dibujarse, así que se rechaza.
 */
export const PANEL_SKINS = ["jardin", "clinico", "calido", "sobrio"] as const;
export type PanelSkin = (typeof PANEL_SKINS)[number];

/** Los diseños de portada que existen. Cada uno es una variante de Home.css en la web. */
export const HOME_TEMPLATES = ["jardin", "clasico", "minimal"] as const;
export type HomeTemplate = (typeof HOME_TEMPLATES)[number];

/** Cómo puede ser la portada. Ver `heroStyle` en la entidad. */
export const HERO_STYLES = ["collage", "photo", "text"] as const;
export type HeroStyle = (typeof HERO_STYLES)[number];

/**
 * Los bloques que sabe dibujar la portada.
 *
 * Son los que existen en la web (ver HomeBlocks en el front). Un bloque nuevo se agrega
 * acá y allá; uno que llegue y no esté en esta lista se rechaza, porque guardarlo haría
 * que la portada pida algo que no sabe dibujar.
 */
export const HOME_BLOCKS = ["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"] as const;
export type HomeBlock = (typeof HOME_BLOCKS)[number];

/**
 * Los diseños posibles de cada sección de la portada. Son los que sabe dibujar la web
 * (ver HOME_VARIANTS en el front); uno que no esté acá se rechaza. La portada de arriba
 * no está porque ya tiene el suyo, `heroStyle`.
 */
export const HOME_VARIANTS = {
  services: ["cards", "list", "mosaic"],
  gallery: ["carousel", "grid", "strip"],
  yourSpace: ["cards", "list", "band"],
  location: ["below", "split", "overlay"],
  footer: ["full", "centered", "columns"],
} as const;
export type HomeVariantSection = keyof typeof HOME_VARIANTS;
export type HomeVariants = { [K in HomeVariantSection]?: (typeof HOME_VARIANTS)[K][number] };

/** Los diseños guardados, sin los que la web ya no conoce. Leer nunca falla. */
function variantsOf(stored: string | null): HomeVariants {
  if (!stored) return {};
  try {
    const raw = JSON.parse(stored);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [section, options] of Object.entries(HOME_VARIANTS)) {
      if ((options as readonly string[]).includes(raw[section])) out[section] = raw[section];
    }
    return out as HomeVariants;
  } catch {
    return {};
  }
}

/** Los diseños que llegan de la pantalla. Una sección o un diseño desconocido rechazan el pedido. */
function parseVariants(value: unknown): string | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Los diseños de la portada llegaron con un formato que no se entiende");
  const out: Record<string, string> = {};
  for (const [section, variant] of Object.entries(value as Record<string, unknown>)) {
    const options = (HOME_VARIANTS as Record<string, readonly string[]>)[section];
    if (!options) throw badRequest(`La portada no tiene una sección llamada "${section}"`);
    if (variant === null || variant === undefined || variant === "") continue;
    if (!options.includes(String(variant))) throw badRequest(`Ese diseño no existe para "${section}"`);
    out[section] = String(variant);
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

function splitList(text: string): string[] {
  return String(text ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Los bloques guardados, sin los que la web ya no conoce. Leer nunca falla por un bloque viejo. */
function blocksOf(text: string): HomeBlock[] {
  return splitList(text).filter((block): block is HomeBlock => (HOME_BLOCKS as readonly string[]).includes(block));
}

/**
 * Un orden de bloques que llega de la pantalla, validado.
 *
 * Acepta un arreglo o un texto separado por comas. Un bloque desconocido o repetido rechaza
 * el pedido: guardar "hero,hero" dibujaría la portada dos veces.
 */
function parseBlocks(value: unknown): string {
  const list = Array.isArray(value) ? value.map(String) : splitList(String(value ?? ""));
  const unknown = list.filter((block) => !(HOME_BLOCKS as readonly string[]).includes(block));
  if (unknown.length) throw badRequest(`La portada no tiene un bloque llamado "${unknown[0]}"`);
  if (new Set(list).size !== list.length) throw badRequest("Un bloque no puede estar dos veces en la portada");
  return list.join(",");
}

function isDuplicate(error: any): boolean {
  return error?.code === "ER_DUP_ENTRY" || (typeof error?.message === "string" && error.message.includes("Duplicate entry"));
}

function toConfig(row: Installation): Config {
  return {
    name: row.name,
    tagline: row.tagline,
    address: row.address,
    city: row.city,
    publicHours: row.publicHours,
    instagram: row.instagram,
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email,
    mapEmbedUrl: row.mapEmbedUrl,
    directionsUrl: row.directionsUrl,
    spaceTour: row.spaceTour,
    visitAdvice: row.visitAdvice,
    services: splitList(row.services),
    specialityStyles: stylesFor(row.specialityStyles, splitList(row.services)),
    brandHue: row.brandHue,
    brandSaturation: row.brandSaturation,
    heroStyle: (HERO_STYLES as readonly string[]).includes(row.heroStyle) ? (row.heroStyle as HeroStyle) : "collage",
    homeTemplate: (HOME_TEMPLATES as readonly string[]).includes(row.homeTemplate) ? (row.homeTemplate as HomeTemplate) : "jardin",
    panelSkin: (PANEL_SKINS as readonly string[]).includes(row.panelSkin) ? (row.panelSkin as PanelSkin) : "jardin",
    homeBlocksGuest: blocksOf(row.homeBlocksGuest),
    homeBlocksMember: blocksOf(row.homeBlocksMember),
    homeVariants: variantsOf(row.homeVariants),
    elementColors: elementColorsOf(row.elementColors),
    assistantTone: (ASSISTANT_TONES as readonly string[]).includes(row.assistantTone)
      ? (row.assistantTone as AssistantTone)
      : "voseo",
    assistantNotes: row.assistantNotes ?? "",
    vocabulary: vocabularyOf(row.vocabulary),
    bookingWeeksAhead: row.bookingWeeksAhead,
    slotStepMinutes: row.slotStepMinutes,
    bufferMinutes: row.bufferMinutes,
    realignToOpening: row.realignToOpening,
    minNoticeMinutes: row.minNoticeMinutes,
    shortNoticeHours: row.shortNoticeHours,
    opensSunday: row.opensSunday,
    reminderHoursBefore: row.reminderHoursBefore,
    chargesMissed: row.chargesMissed,
    maxActiveAppointments: row.maxActiveAppointments,
    waitlistEnabled: row.waitlistEnabled,
    policies: policiesOf(row.policies),
    locked: lockedOf(row.lockedRules),
    faq: faqOf(row.faq),
    contactReasons: reasonsOf(row.contactReasons),
    updatedAt: row.updatedAt,
  };
}

/** El nombre de la instalación de Consultorios del Jardín. Ver `TOKEN_ISSUER`. */
const JARDIN_ISSUER = "jardin";

/**
 * Con qué datos nace la fila.
 *
 * Los valores por omisión de la entidad son los de Consultorios del Jardín, que es lo que
 * tenía escrito el código y lo que esa instalación tiene que seguir mostrando. Pero en una
 * instalación nueva esos datos son de otro consultorio: hasta que alguien los editara, su
 * portada diría el nombre y la dirección de este, y su asistente daría este teléfono.
 *
 * Así que fuera de la instalación de Jardín la identidad nace vacía —salvo el nombre, que
 * sale en el asunto de los mails y no puede faltar— y sin el recorrido 3D, que es de este
 * edificio. Las reglas de turnos no son de nadie y nacen igual en todas.
 */
function seedFor(issuer: string): Record<string, unknown> {
  if (!issuer || issuer === JARDIN_ISSUER) return { id: 1 };

  return {
    id: 1,
    name: "Consultorio",
    tagline: "",
    address: "",
    city: "",
    publicHours: "",
    instagram: "",
    email: "",
    mapEmbedUrl: null,
    directionsUrl: null,
    services: "",
    spaceTour: false,
    heroStyle: "text",
    // El alquiler de consultorios es de Jardín: una instalación nueva lo prende si lo usa.
    policies: JSON.stringify({ rentModule: false }),
  };
}

/** La fila, creada la primera vez que alguien la pide. Mismo patrón que RentSettings. */
async function ensureRow(em: ReturnType<typeof orm.em.fork>): Promise<Installation> {
  const found = await em.findOne(Installation, { id: 1 });
  if (found) return found;

  em.create(Installation, seedFor(tokenIssuer()) as any);

  try {
    await em.flush();
  } catch (error) {
    // Dos pedidos a la vez la crean los dos: el segundo choca y se queda con la del primero.
    if (!isDuplicate(error)) throw error;
    em.clear();
  }

  return em.findOneOrFail(Installation, { id: 1 });
}

/**
 * La configuración de esta instalación.
 *
 * Si la base falla, esto tira. Es a propósito: devolver valores inventados haría que un
 * problema de la base se viera como un consultorio con otras reglas, que es peor que una
 * pantalla con un error.
 */
export async function config(): Promise<Config> {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;

  cached = toConfig(await ensureRow(orm.em.fork()));
  cachedAt = Date.now();
  return cached;
}

/**
 * Las palabras del rubro, listas para escribir con ellas.
 *
 * A diferencia de `config()`, esta no falla: si la base no contesta, devuelve las de
 * siempre. La usan los mails, y un recordatorio que no sale porque no se pudo leer cómo se
 * dice "turno" es peor que un recordatorio que dice "turno".
 */
export async function officeWords(): Promise<Words> {
  try {
    return words((await config()).vocabulary);
  } catch {
    return words();
  }
}

/**
 * Las palabras del rubro, sin esperar a la base.
 *
 * Para el código que no es async y necesita armar un texto: usa la configuración que ya
 * está en memoria y, si todavía no se leyó nunca, las de siempre. Donde se pueda esperar,
 * conviene `officeWords()`.
 */
export function cachedWords(): Words {
  return words(cached?.vocabulary);
}

/** Olvida lo que tiene en memoria. La llama la escritura, y los tests entre casos. */
export function forget(): void {
  cached = null;
  cachedAt = 0;
  cachedImages = null;
  cachedImagesAt = 0;
  cachedBranches = null;
  cachedBranchesAt = 0;
}

/**
 * Las fotos que subió el consultorio, sin los bytes, en orden.
 *
 * Se leen acá y no desde images.service para no armar un ciclo entre los dos archivos:
 * aquel le pide a este que olvide lo guardado cada vez que cambia una foto.
 */
/**
 * Las sucursales habilitadas, para mostrarlas sin sesión.
 *
 * Solo cuando la instalación trabaja con varias: con una sola, la dirección es la del
 * consultorio y la portada ya la tiene.
 */
async function publicBranches(): Promise<PublicBranch[]> {
  if (cachedBranches && Date.now() - cachedBranchesAt < CACHE_MS) return cachedBranches;

  const offices = await orm.em
    .fork()
    .find(Office, { active: true }, { populate: ["city"], orderBy: { description: "ASC" } });

  cachedBranches = offices.map((office) => ({
    id: office.idOffice!,
    name: office.description,
    address: office.address ?? null,
    city: office.city?.nameCity ?? "",
    opens: String(office.openingTime ?? "").slice(0, 5),
    closes: String(office.closingTime ?? "").slice(0, 5),
  }));
  cachedBranchesAt = Date.now();
  return cachedBranches;
}

async function publicImages(): Promise<PublicImage[]> {
  if (cachedImages && Date.now() - cachedImagesAt < CACHE_MS) return cachedImages;

  const rows = await orm.em
    .fork()
    // Las recién subidas y sin guardar no: son un borrador de la configuración.
    .find(SiteImage, { pending: false }, { orderBy: { slot: "ASC", position: "ASC" } });

  cachedImages = rows.map((row) => ({
    id: row.id,
    slot: row.slot,
    alt: row.alt,
    width: row.width,
    height: row.height,
    preview: row.preview,
  }));
  cachedImagesAt = Date.now();
  return cachedImages;
}

function entero(valor: any, rango: { min: number; max: number; texto: string }): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < rango.min || numero > rango.max) throw badRequest(rango.texto);
  return numero;
}

/**
 * Las reglas que toca un pedido: las de su propia columna y las del JSON.
 *
 * Es lo que se compara con lo que puede tocar quien lo manda (ver `updateConfig`).
 */
function rulesTouched(cambios: Record<string, any>): string[] {
  const columns = Object.keys(cambios).filter((key) => policyDef(key)?.stored === "column");
  const policies = cambios.policies && typeof cambios.policies === "object" ? Object.keys(cambios.policies) : [];
  return [...columns, ...policies];
}

/**
 * Cambia lo que venga y deja el resto como estaba.
 *
 * Un campo que no viene no se toca, así que la pantalla puede mandar solo lo que el
 * usuario movió. Un campo que viene con algo que no entra en su rango rechaza el pedido
 * entero: media configuración guardada es peor que ninguna.
 *
 * `as` es quién lo pide. El consultorio no puede tocar una regla del dueño del sistema ni
 * una que él bloqueó; el dueño (la consola) toca todas y además decide cuáles se bloquean.
 */
export async function updateConfig(cambios: Record<string, any>, as: "client" | "owner" = "client"): Promise<Config> {
  const em = orm.em.fork();
  const fila = await ensureRow(em);

  if (as === "client") {
    const locked = lockedOf(fila.lockedRules);
    const blocked = rulesTouched(cambios).filter((key) => policyDef(key)?.scope === "owner" || locked.includes(key));
    if (blocked.length) throw forbidden("Esa opción no se puede cambiar desde acá");
    if (cambios.locked !== undefined) throw forbidden("Esa opción no se puede cambiar desde acá");
  }

  if (cambios.policies !== undefined) {
    if (!cambios.policies || typeof cambios.policies !== "object" || Array.isArray(cambios.policies))
      throw badRequest("Las reglas llegaron con un formato que no se entiende");
    fila.policies = JSON.stringify(applyPolicyChanges(policiesOf(fila.policies), cambios.policies));
  }

  if (as === "owner" && cambios.locked !== undefined) {
    if (!Array.isArray(cambios.locked)) throw badRequest("Las reglas bloqueadas llegan como una lista");
    const allowed = new Set(lockableKeys());
    const unknown = cambios.locked.find((key: unknown) => typeof key !== "string" || !allowed.has(key));
    if (unknown !== undefined) throw badRequest(`No se puede bloquear "${String(unknown)}"`);
    fila.lockedRules = cambios.locked.length ? JSON.stringify([...new Set(cambios.locked)]) : null;
  }

  for (const [campo, largo] of Object.entries(TEXTOS)) {
    // Las especialidades tienen su propio camino, más abajo.
    if (cambios[campo] === undefined || campo === "services") continue;
    const texto = String(cambios[campo] ?? "").trim();
    if (texto.length > largo) throw badRequest(`"${campo}" no puede pasar de ${largo} caracteres`);
    (fila as any)[campo] = texto;
  }

  // El nombre es el único texto que no puede quedar vacío: sale en el asunto de los mails.
  if (cambios.name !== undefined && !fila.name) throw badRequest("El nombre no puede quedar vacío");

  for (const [campo, rango] of Object.entries(RANGOS)) {
    if (cambios[campo] === undefined) continue;

    // Dos aceptan "nada", y en los dos significa lo que el sistema hacía antes de que el
    // número existiera: el paso de la grilla es la duración del módulo, y el recordatorio
    // es el de la víspera.
    if (ACEPTAN_NADA.has(campo) && (cambios[campo] === null || cambios[campo] === "")) {
      (fila as any)[campo] = null;
      continue;
    }

    (fila as any)[campo] = entero(cambios[campo], rango);
  }

  for (const campo of BOOLEANOS) {
    if (cambios[campo] === undefined) continue;
    (fila as any)[campo] = cambios[campo] === true || cambios[campo] === "true";
  }

  if (cambios.heroStyle !== undefined) {
    if (!(HERO_STYLES as readonly string[]).includes(cambios.heroStyle))
      throw badRequest("La portada puede ser collage, foto o texto");
    fila.heroStyle = cambios.heroStyle;
  }

  if (cambios.assistantTone !== undefined) {
    if (!(ASSISTANT_TONES as readonly string[]).includes(cambios.assistantTone))
      throw badRequest("El asistente puede hablar de vos, de tú o de usted");
    fila.assistantTone = cambios.assistantTone;
  }

  if (cambios.assistantNotes !== undefined) {
    const notas = String(cambios.assistantNotes ?? "").trim();
    if (notas.length > ASSISTANT_NOTES_MAX)
      throw badRequest(`Lo que sabe el asistente no puede pasar de ${ASSISTANT_NOTES_MAX} caracteres`);
    fila.assistantNotes = notas || null;
  }

  // El mapa se pega desde Google Maps. Solo se acepta una dirección de inserción de Google:
  // la portada lo pone en un iframe, y un iframe a cualquier sitio que escriba el panel es
  // una página ajena metida en la del consultorio.
  if (cambios.mapEmbedUrl !== undefined) {
    const url = String(cambios.mapEmbedUrl ?? "").trim();
    if (url && !/^https:\/\/www\.google\.com\/maps\/embed\?/.test(url))
      throw badRequest("El mapa tiene que ser el que da Google Maps al insertar un mapa");
    if (url.length > 2000) throw badRequest("La dirección del mapa es demasiado larga");
    fila.mapEmbedUrl = url || null;
  }

  if (cambios.directionsUrl !== undefined && fila.directionsUrl) {
    if (!/^https:\/\//.test(fila.directionsUrl)) throw badRequest("El link de cómo llegar tiene que empezar con https://");
  }
  if (cambios.directionsUrl !== undefined && !fila.directionsUrl) fila.directionsUrl = null;

  if (cambios.email !== undefined && fila.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fila.email))
    throw badRequest("La casilla no parece válida");

  // El teléfono y el WhatsApp salen como links (tel: y wa.me), así que llevan números y
  // lo que se usa para escribirlos, nada más.
  if (cambios.phone !== undefined && fila.phone && !/^[\d\s()+-]{6,40}$/.test(fila.phone))
    throw badRequest("El teléfono no parece válido");
  if (cambios.whatsapp !== undefined && fila.whatsapp) {
    if (!/^[\d\s()+-]{6,40}$/.test(fila.whatsapp) || fila.whatsapp.replace(/\D/g, "").length < 8)
      throw badRequest("El WhatsApp no parece válido. Va con el código de país");
  }

  if (cambios.faq !== undefined) fila.faq = parseFaq(cambios.faq);
  if (cambios.contactReasons !== undefined) fila.contactReasons = parseReasons(cambios.contactReasons);

  if (cambios.homeTemplate !== undefined) {
    if (!(HOME_TEMPLATES as readonly string[]).includes(cambios.homeTemplate)) throw badRequest("Ese diseño de portada no existe");
    fila.homeTemplate = cambios.homeTemplate;
  }

  if (cambios.panelSkin !== undefined) {
    if (!(PANEL_SKINS as readonly string[]).includes(cambios.panelSkin)) throw badRequest("Ese estilo de panel no existe");
    fila.panelSkin = cambios.panelSkin;
  }

  if (cambios.vocabulary !== undefined) {
    const parsed = parseVocabulary(cambios.vocabulary);
    if ("problem" in parsed) throw badRequest(parsed.problem);
    fila.vocabulary = JSON.stringify(parsed.vocabulary);
  }

  // Las fotos de la portada y de la galería: se publican con el resto, o no se publican.
  if (cambios.photos !== undefined) await savePhotos(em, cambios.photos);

  if (cambios.homeBlocksGuest !== undefined) fila.homeBlocksGuest = parseBlocks(cambios.homeBlocksGuest);
  if (cambios.homeBlocksMember !== undefined) fila.homeBlocksMember = parseBlocks(cambios.homeBlocksMember);
  if (cambios.homeVariants !== undefined) fila.homeVariants = parseVariants(cambios.homeVariants);
  if (cambios.elementColors !== undefined) fila.elementColors = parseElementColors(cambios.elementColors);

  // Las especialidades llegan como lista o como texto, y se guardan escritas siempre igual
  // (ver shared/specialities): mayúscula, tildes de las conocidas, sin repetidas.
  const servicesBefore = splitList(fila.services);
  if (cambios.services !== undefined) {
    const lista = normalizeSpecialityList(Array.isArray(cambios.services) ? cambios.services : splitList(String(cambios.services ?? "")));
    const texto = lista.join(", ");
    if (texto.length > TEXTOS.services) throw badRequest(`La lista no puede pasar de ${TEXTOS.services} caracteres`);
    fila.services = texto;
  }
  const services = splitList(fila.services);

  // El ícono y la foto de cada una. Solo de las que están en la lista: las demás se van.
  if (cambios.specialityStyles !== undefined || cambios.services !== undefined) {
    const styles = stylesFor(cambios.specialityStyles ?? fila.specialityStyles, services);
    fila.specialityStyles = Object.keys(styles).length ? JSON.stringify(styles) : null;
  }

  // Un tono sin saturación, o al revés, no alcanza para armar un color. Van los dos o ninguno.
  if ((fila.brandHue === null) !== (fila.brandSaturation === null))
    throw badRequest("El color de la marca necesita el tono y la saturación");

  // Un colchón que se come la grilla deja la agenda a la mitad sin que nadie lo pida. Se
  // avisa acá y no cuando el profesional no encuentra horarios libres.
  if (fila.slotStepMinutes !== null && fila.bufferMinutes >= fila.slotStepMinutes) {
    throw badRequest("El colchón tiene que ser menor que el paso de la grilla");
  }

  await em.flush();

  // Si la lista cambió, los profesionales quedan con la especialidad escrita como en ella:
  // "psicologia" en la ficha de alguien no se encontraba al filtrar por "Psicología".
  if (cambios.services !== undefined && JSON.stringify(services) !== JSON.stringify(servicesBefore)) {
    await alignProfessionals(em, services);
  }
  // Las fotos de especialidades que ya no usa ninguna se borran.
  if (cambios.specialityStyles !== undefined || cambios.services !== undefined) {
    await pruneSpecialityImages(em, toConfig(fila).specialityStyles);
  }

  forget();

  return toConfig(fila);
}

async function alignProfessionals(em: ReturnType<typeof orm.em.fork>, services: string[]): Promise<void> {
  const professionals = await em.find(Person, { type: "professional", speciality: { $ne: null } });
  let changed = 0;
  for (const person of professionals) {
    const canonical = canonicalSpeciality(person.speciality, services);
    if (canonical && canonical !== person.speciality) {
      person.speciality = canonical;
      changed++;
    }
  }
  if (changed) await em.flush();
}

async function pruneSpecialityImages(em: ReturnType<typeof orm.em.fork>, styles: Record<string, SpecialityStyle>): Promise<void> {
  const used = Object.values(styles)
    .map((style) => style.imageId)
    .filter((id): id is string => !!id);
  // Las que quedaron en uso se publican; las que no usa ninguna, guardadas o recién subidas, se van.
  if (used.length) await em.nativeUpdate(SiteImage, { slot: "speciality", id: { $in: used } }, { pending: false });
  await em.nativeDelete(SiteImage, used.length ? { slot: "speciality", id: { $nin: used } } : { slot: "speciality" });
}

/** Lo que se le cuenta al navegador sin pedirle sesión. */
export async function publicConfig() {
  const c = await config();
  // Sin fotos subidas, o si la tabla todavía no existe, la portada usa las de siempre.
  const images = await publicImages().catch(() => [] as PublicImage[]);
  const branches = c.policies.multiBranch ? await publicBranches().catch(() => [] as PublicBranch[]) : [];

  return {
    name: c.name,
    tagline: c.tagline,
    address: c.address,
    city: c.city,
    publicHours: c.publicHours,
    instagram: c.instagram,
    phone: c.phone,
    whatsapp: c.whatsapp,
    email: c.email,
    mapEmbedUrl: c.mapEmbedUrl,
    directionsUrl: c.directionsUrl,
    spaceTour: c.spaceTour,
    services: c.services,
    specialityStyles: c.specialityStyles,
    brand: { hue: c.brandHue, saturation: c.brandSaturation },
    heroStyle: c.heroStyle,
    homeTemplate: c.homeTemplate,
    panelSkin: c.panelSkin,
    vocabulary: c.vocabulary,
    images: {
      hero: images.filter((image) => image.slot === "hero"),
      gallery: images.filter((image) => image.slot === "gallery"),
    },
    homeBlocks: { guest: c.homeBlocksGuest, member: c.homeBlocksMember },
    homeVariants: c.homeVariants,
    elementColors: c.elementColors,
    // Con varias sucursales, cuáles son y dónde quedan. Con una sola, vacía.
    branches,
    faq: c.faq,
    contactReasons: c.contactReasons,
    rules: {
      bookingWeeksAhead: c.bookingWeeksAhead,
      slotStepMinutes: c.slotStepMinutes,
      // La pantalla del profesional arma la misma grilla que el motor (ver freeSlots en el
      // front), así que necesita saber desde dónde se cuenta.
      realignToOpening: c.realignToOpening,
      bufferMinutes: c.bufferMinutes,
      minNoticeMinutes: c.minNoticeMinutes,
      shortNoticeHours: c.shortNoticeHours,
      opensSunday: c.opensSunday,
      maxActiveAppointments: c.maxActiveAppointments,
      waitlistEnabled: c.waitlistEnabled,
    },
    // Lo que la web prende o apaga según las reglas. Sin las fechas internas.
    policies: publicPolicies(c.policies),
  };
}

function publicPolicies(policies: Policies) {
  const { markSince, paySince, ...rest } = policies;
  return rest;
}

/** Las reglas de funcionamiento, con el valor de siempre si la base no contesta. */
export async function policies(): Promise<Policies> {
  try {
    return (await config()).policies;
  } catch {
    return DEFAULT_POLICIES;
  }
}

/** Los valores de todas las reglas del catálogo, las de columna y las del JSON juntas. */
function ruleValues(c: Config): Record<string, unknown> {
  const values: Record<string, unknown> = { ...publicPolicies(c.policies) };
  for (const key of Object.keys(c)) if (policyDef(key)?.stored === "column") values[key] = (c as any)[key];
  return values;
}

/**
 * Las reglas para dibujar: el catálogo con sus textos, los valores y cuáles están bloqueadas.
 *
 * El consultorio recibe solo las suyas; la consola, todas.
 */
export async function rulesView(who: "client" | "owner") {
  const c = await config();
  const values = ruleValues(c);
  return { ...policyCatalog(words(c.vocabulary), values, c.locked, who), values, locked: c.locked };
}
