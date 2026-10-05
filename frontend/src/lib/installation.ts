import { useEffect, useSyncExternalStore } from "react";
import { API_BASE_URL } from "../axios.ts";
import seo from "../seo.json";
import { DEFAULT_VOCABULARY, vocabularyFrom, words, type Vocabulary, type Words } from "./vocabulary.ts";
import { DEFAULT_POLICIES, policiesFrom, type Policies } from "./policies.ts";
import {
  defaultFaq,
  defaultReasons,
  faqFrom,
  reasonsFrom,
  type ContactReasonEntry,
  type FaqEntry,
} from "./contentLists.ts";
import { applyElementColors, elementColorsFrom, type ElementColors } from "./elementColors.ts";

/**
 * Lo que la pantalla sabe del consultorio y de sus reglas de turnos.
 *
 * Vivía escrito acá: el horizonte de reserva, la ventana de baja tardía, el paso de la
 * grilla. Eran copias de números que el servidor también tenía, y el día que un consultorio
 * quisiera otro valor iba a cambiar de un lado y no del otro. Ahora el servidor los manda
 * (`GET /api/installation`, sin sesión) y la pantalla los lee de acá.
 *
 * **Los valores de abajo son el plan B, no un adorno.** La pantalla y el servidor se
 * publican por separado, y hay un rato en que esta versión de la pantalla habla con un
 * servidor que todavía no tiene la ruta, o que no tiene algún campo nuevo. En ese rato, y
 * mientras la respuesta no llegó, se usan estos, que son exactamente los que estaban
 * escritos antes. Un campo que falta en la respuesta toma su valor de acá, uno por uno.
 */

export interface InstallationRules {
  /** Semanas después de la actual que se pueden reservar. Uno es "esta y la que viene". */
  bookingWeeksAhead: number;
  /** Cada cuántos minutos arranca un turno. `null` es la duración del módulo. */
  slotStepMinutes: number | null;
  /** Si la grilla se cuenta desde la hora en que abre la sucursal. */
  realignToOpening: boolean;
  /** Minutos libres entre un turno y el siguiente. */
  bufferMinutes: number;
  /** Cuánto antes, como mínimo, se puede reservar. */
  minNoticeMinutes: number;
  /** Debajo de cuántas horas una baja es "sobre la hora". */
  shortNoticeHours: number;
  /** Si se atiende domingo. */
  opensSunday: boolean;
  /** Tope de turnos activos por paciente. Cero es sin tope. */
  maxActiveAppointments: number;
  /** Si la lista de espera está disponible. */
  waitlistEnabled: boolean;
}

/** Una foto que subió el consultorio. Los bytes se piden aparte, con imageUrl. */
export interface SiteImage {
  id: string;
  alt: string;
  width: number;
  height: number;
  /** Una versión de 24 px, para mostrar algo borroso mientras llega la de verdad. */
  preview: string;
}

/** Dónde se pide una foto subida: la grande, de hasta 1600 px, o la chica, de hasta 640. */
export function imageUrl(id: string, size: "large" | "small"): string {
  return `${API_BASE_URL}/installation/images/${encodeURIComponent(id)}/${size}`;
}

/** Los bloques que sabe dibujar la portada. El servidor valida contra la misma lista. */
export const HOME_BLOCKS = ["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"] as const;
export type HomeBlock = (typeof HOME_BLOCKS)[number];

export type HeroStyle = "collage" | "photo" | "text";

/**
 * Los diseños de portada.
 *
 * Cada uno es una variante de Home.css (`.home[data-home-template]`) más lo que propone al
 * elegirlo: un estilo de portada, un orden de bloques y un diseño para cada sección. Lo
 * que propone se puede cambiar después; el diseño general sigue siendo el mismo.
 */
export const HOME_TEMPLATES = [
  {
    id: "jardin",
    label: "Jardín",
    description: "Collage de fotos, títulos con serifa y franjas de color",
    heroStyle: "collage",
    guest: ["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"],
    member: ["garland", "hero", "yourSpace", "gallery", "services", "location", "footer"],
    variants: { services: "cards", gallery: "carousel", yourSpace: "cards", location: "below", footer: "full" },
  },
  {
    id: "clasico",
    label: "Clásico",
    description: "Una foto grande, letra sin serifa y franjas claras",
    heroStyle: "photo",
    guest: ["hero", "services", "yourSpace", "gallery", "location", "footer"],
    member: ["hero", "yourSpace", "services", "gallery", "location", "footer"],
    variants: { services: "mosaic", gallery: "grid", yourSpace: "band", location: "split", footer: "columns" },
  },
  {
    id: "minimal",
    label: "Minimalista",
    description: "Solo el nombre, sin fotos ni color, con mucho aire",
    heroStyle: "text",
    guest: ["hero", "services", "yourSpace", "location", "footer"],
    member: ["hero", "yourSpace", "services", "location", "footer"],
    variants: { services: "list", gallery: "strip", yourSpace: "list", location: "overlay", footer: "centered" },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  heroStyle: HeroStyle;
  guest: readonly HomeBlockName[];
  member: readonly HomeBlockName[];
  variants: HomeVariants;
}>;

/**
 * Los diseños de cada sección de la portada. La de arriba tiene el suyo, `heroStyle`.
 *
 * Cada sección se dibuja de tres maneras con los mismos datos. El diseño general propone
 * una para cada una (ver `variants` en HOME_TEMPLATES) y el consultorio puede cambiar
 * cualquiera. El servidor valida contra la misma lista (HOME_VARIANTS en
 * installation.service).
 */
export const HOME_VARIANTS = {
  services: [
    { id: "cards", label: "Tarjetas", description: "Un bloque de color o foto para cada una" },
    { id: "list", label: "Lista", description: "Una lista en columnas, cómoda con muchas" },
    { id: "mosaic", label: "Mosaico", description: "Fotos grandes con el nombre encima" },
  ],
  gallery: [
    { id: "carousel", label: "Carrusel", description: "Una foto grande y las vecinas a los costados" },
    { id: "grid", label: "Grilla", description: "Todas a la vista, la primera más grande" },
    { id: "strip", label: "Tira", description: "Una fila que se desliza de costado" },
  ],
  yourSpace: [
    { id: "cards", label: "Tarjetas", description: "Un recuadro por acceso o por paso" },
    { id: "list", label: "Lista", description: "Renglones uno debajo del otro" },
    { id: "band", label: "Franja", description: "Sobre una franja de color, de lado a lado" },
  ],
  location: [
    { id: "below", label: "Mapa abajo", description: "La dirección arriba y el mapa debajo" },
    { id: "split", label: "Lado a lado", description: "La dirección a un lado y el mapa al otro" },
    { id: "overlay", label: "Sobre el mapa", description: "El mapa de lado a lado con la dirección encima" },
  ],
  footer: [
    { id: "full", label: "Completo", description: "Nombre, contacto y accesos en bloques" },
    { id: "columns", label: "Columnas", description: "Tres columnas con su título" },
    { id: "centered", label: "Centrado", description: "Todo al medio, en pocos renglones" },
  ],
} as const;

export type HomeVariantSection = keyof typeof HOME_VARIANTS;
export type HomeVariants = { [K in HomeVariantSection]: (typeof HOME_VARIANTS)[K][number]["id"] };

/** Los diseños elegidos que esta versión de la pantalla sabe dibujar. */
function variantsFrom(input: unknown): Partial<HomeVariants> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [section, options] of Object.entries(HOME_VARIANTS)) {
    const value = (input as Record<string, unknown>)[section];
    if (options.some((option) => option.id === value)) out[section] = value as string;
  }
  return out as Partial<HomeVariants>;
}

/** El diseño de cada sección: el elegido, o el que propone el diseño general. */
export function homeVariantsOf(installation: Pick<Installation, "homeTemplate" | "homeVariants">): HomeVariants {
  const template = HOME_TEMPLATES.find((item) => item.id === installation.homeTemplate) ?? HOME_TEMPLATES[0];
  return { ...template.variants, ...installation.homeVariants };
}

type HomeBlockName = "garland" | "hero" | "services" | "gallery" | "yourSpace" | "location" | "footer";

export type HomeTemplate = (typeof HOME_TEMPLATES)[number]["id"];

export interface Installation {
  name: string;
  tagline: string;
  address: string;
  city: string;
  publicHours: string;
  instagram: string;
  /** El teléfono y el WhatsApp que se publican. Vacíos no se muestran. */
  phone: string;
  whatsapp: string;
  email: string;
  /** El mapa insertado de Google Maps. `null` lo arma la portada con la dirección. */
  mapEmbedUrl: string | null;
  directionsUrl: string | null;
  /** Si se ofrece el recorrido en 3D. Es solo de Consultorios del Jardín. */
  spaceTour: boolean;
  /** Lo que se atiende, en el orden en que se muestra. */
  services: string[];
  /** El color fijo de la marca. `null` es el color que cambia con la estación. */
  brand: { hue: number; saturation: number } | null;
  heroStyle: HeroStyle;
  /** El diseño de la portada. Ver HOME_TEMPLATES. */
  homeTemplate: HomeTemplate;
  /** El estilo de los paneles: la forma, no el color. */
  panelSkin: PanelSkin;
  /** Las palabras del rubro. Ver lib/vocabulary. */
  vocabulary: Vocabulary;
  /** Las fotos que subió el consultorio. Vacías, la portada usa las que vienen con el sitio. */
  images: { hero: SiteImage[]; gallery: SiteImage[] };
  /**
   * Si este sitio trae fotos propias en el código (las de Consultorios del Jardín). No lo
   * manda el servidor: lo dice seo.json al compilar. Sin fotos propias y sin subidas, la
   * portada no muestra ninguna en vez de mostrar las de otro consultorio.
   */
  bundledPhotos: boolean;
  homeBlocks: { guest: HomeBlock[]; member: HomeBlock[] };
  /** El diseño de las secciones que no siguen al diseño general. Ver homeVariantsOf. */
  homeVariants: Partial<HomeVariants>;
  /** Los colores propios de la barra, el pie y los mails. Ver lib/elementColors. */
  elementColors: ElementColors;
  rules: InstallationRules;
  /** Las reglas de funcionamiento. Ver lib/policies. */
  policies: Policies;
  /**
   * Cómo se ve cada especialidad en la portada: su ícono y, si el consultorio subió una, su
   * foto. Por nombre, tal como figura en `services`. La que no está toma el ícono que
   * sugiere su nombre (ver lib/specialityIcons).
   */
  specialityStyles: Record<string, SpecialityStyle>;
  /**
   * Las sucursales, cuando la instalación trabaja con varias (regla multiBranch). Con una
   * sola viene vacía y todo se ve como siempre.
   */
  branches: Branch[];
  /** Las preguntas frecuentes, en orden. Ver lib/contentLists. */
  faq: FaqEntry[];
  /** Los motivos del formulario de contacto, en orden. Ver lib/contentLists. */
  contactReasons: ContactReasonEntry[];
}

export interface Branch {
  id: number;
  name: string;
  address: string | null;
  city: string;
  opens: string;
  closes: string;
}

export interface SpecialityStyle {
  icon: string | null;
  imageId: string | null;
}

/**
 * Los datos del consultorio con los que arranca la pantalla, de seo.json.
 *
 * Son el plan B mientras no contesta el servidor, y por eso no pueden estar escritos acá:
 * escritos acá serían los de un consultorio en particular, y el sitio de cualquier otro
 * mostraría un instante el nombre y la dirección ajenos. seo.json es el archivo de cada
 * cliente al compilar (ver scripts/seo-pages.mjs), así que cada sitio arranca con lo suyo.
 */
const SEED = seo.client.defaults;

export const DEFAULT_INSTALLATION: Installation = {
  name: seo.client.name,
  tagline: SEED.tagline,
  address: SEED.address,
  city: SEED.city,
  publicHours: SEED.publicHours,
  instagram: SEED.instagram,
  phone: "",
  whatsapp: "",
  email: SEED.email,
  mapEmbedUrl: SEED.mapEmbedUrl || null,
  directionsUrl: SEED.directionsUrl || null,
  spaceTour: SEED.spaceTour,
  services: SEED.services,
  brand: null,
  heroStyle: (["collage", "photo", "text"] as const).includes(SEED.heroStyle as HeroStyle)
    ? (SEED.heroStyle as HeroStyle)
    : "text",
  bundledPhotos: SEED.bundledPhotos,
  homeTemplate: "jardin",
  panelSkin: "jardin",
  vocabulary: DEFAULT_VOCABULARY,
  images: { hero: [], gallery: [] },
  homeBlocks: {
    guest: ["garland", "hero", "services", "gallery", "yourSpace", "location", "footer"],
    member: ["garland", "hero", "yourSpace", "gallery", "services", "location", "footer"],
  },
  homeVariants: {},
  elementColors: {},
  rules: {
    bookingWeeksAhead: 1,
    slotStepMinutes: null,
    realignToOpening: false,
    bufferMinutes: 0,
    minNoticeMinutes: 0,
    shortNoticeHours: 24,
    opensSunday: false,
    maxActiveAppointments: 0,
    waitlistEnabled: true,
  },
  policies: DEFAULT_POLICIES,
  specialityStyles: {},
  branches: [],
  faq: defaultFaq(),
  contactReasons: defaultReasons(),
};

/**
 * Lo que llegó, encima de lo de siempre, campo por campo.
 *
 * Un valor del tipo equivocado también cae al de siempre. No debería pasar, pero si una
 * versión del servidor manda el horizonte como texto, es mejor mostrar dos semanas que una
 * pantalla sin horarios.
 */
function merge(input: unknown): Installation {
  const base = DEFAULT_INSTALLATION;
  const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rules = (raw.rules && typeof raw.rules === "object" ? raw.rules : {}) as Record<string, unknown>;
  const blocks = (raw.homeBlocks && typeof raw.homeBlocks === "object" ? raw.homeBlocks : {}) as Record<string, unknown>;
  const brand = (raw.brand && typeof raw.brand === "object" ? raw.brand : {}) as Record<string, unknown>;

  // Una lista de bloques que no es una lista, o que trae bloques que esta versión de la
  // pantalla no sabe dibujar, se filtra; vacía del todo, vale la de siempre.
  const blockList = (value: unknown, fallback: HomeBlock[]): HomeBlock[] => {
    if (!Array.isArray(value)) return fallback;
    return value.filter((block): block is HomeBlock => (HOME_BLOCKS as readonly string[]).includes(String(block)));
  };
  const nullableText = (value: unknown, fallback: string | null) =>
    value === null ? null : typeof value === "string" ? value || null : fallback;

  return {
    name: text(raw.name, base.name) || base.name,
    tagline: text(raw.tagline, base.tagline),
    address: text(raw.address, base.address),
    city: text(raw.city, base.city),
    publicHours: text(raw.publicHours, base.publicHours),
    instagram: text(raw.instagram, base.instagram),
    phone: text(raw.phone, base.phone),
    whatsapp: text(raw.whatsapp, base.whatsapp),
    email: text(raw.email, base.email),
    mapEmbedUrl: nullableText(raw.mapEmbedUrl, base.mapEmbedUrl),
    directionsUrl: nullableText(raw.directionsUrl, base.directionsUrl),
    spaceTour: bool(raw.spaceTour, base.spaceTour),
    services: Array.isArray(raw.services) ? raw.services.map(String).filter(Boolean) : base.services,
    brand:
      typeof brand.hue === "number" && typeof brand.saturation === "number"
        ? { hue: brand.hue, saturation: brand.saturation }
        : raw.brand === undefined
          ? base.brand
          : null,
    heroStyle: (["collage", "photo", "text"] as const).includes(raw.heroStyle as HeroStyle)
      ? (raw.heroStyle as HeroStyle)
      : base.heroStyle,
    homeTemplate: HOME_TEMPLATES.some((item) => item.id === raw.homeTemplate)
      ? (raw.homeTemplate as HomeTemplate)
      : base.homeTemplate,
    panelSkin: PANEL_SKINS.some((item) => item.id === raw.panelSkin) ? (raw.panelSkin as PanelSkin) : base.panelSkin,
    vocabulary: vocabularyFrom(raw.vocabulary),
    // Esto no lo manda el servidor: es del sitio, de cuando se compiló.
    bundledPhotos: base.bundledPhotos,
    images: {
      hero: imageList((raw.images as Record<string, unknown> | undefined)?.hero),
      gallery: imageList((raw.images as Record<string, unknown> | undefined)?.gallery),
    },
    homeBlocks: {
      guest: blockList(blocks.guest, base.homeBlocks.guest),
      member: blockList(blocks.member, base.homeBlocks.member),
    },
    homeVariants: variantsFrom(raw.homeVariants),
    elementColors: elementColorsFrom(raw.elementColors),
    rules: {
      bookingWeeksAhead: num(rules.bookingWeeksAhead, base.rules.bookingWeeksAhead),
      // El de siempre es null, la duración del módulo. Un número que no sirve también.
      slotStepMinutes:
        typeof rules.slotStepMinutes === "number" && rules.slotStepMinutes > 0 ? rules.slotStepMinutes : null,
      realignToOpening: bool(rules.realignToOpening, base.rules.realignToOpening),
      bufferMinutes: num(rules.bufferMinutes, base.rules.bufferMinutes),
      minNoticeMinutes: num(rules.minNoticeMinutes, base.rules.minNoticeMinutes),
      shortNoticeHours: num(rules.shortNoticeHours, base.rules.shortNoticeHours),
      opensSunday: bool(rules.opensSunday, base.rules.opensSunday),
      maxActiveAppointments: num(rules.maxActiveAppointments, base.rules.maxActiveAppointments),
      waitlistEnabled: bool(rules.waitlistEnabled, base.rules.waitlistEnabled),
    },
    policies: policiesFrom(raw.policies),
    specialityStyles: stylesFrom(raw.specialityStyles),
    branches: branchesFrom(raw.branches),
    faq: faqFrom(raw.faq),
    contactReasons: reasonsFrom(raw.contactReasons),
  };
}

/** Las sucursales, sin las que no tengan la forma esperada. */
function branchesFrom(input: unknown): Branch[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "number" && typeof item.name === "string")
    .map((item) => ({
      id: item.id as number,
      name: item.name as string,
      address: typeof item.address === "string" && item.address ? item.address : null,
      city: typeof item.city === "string" ? item.city : "",
      opens: typeof item.opens === "string" ? item.opens : "",
      closes: typeof item.closes === "string" ? item.closes : "",
    }));
}

/** Si la instalación trabaja con varias sucursales y hay más de una para elegir. */
export function hasBranches(installation: Installation): boolean {
  return installation.policies.multiBranch && installation.branches.length > 1;
}

/** Los estilos de las especialidades, sin lo que no tenga la forma esperada. */
function stylesFrom(input: unknown): Record<string, SpecialityStyle> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, SpecialityStyle> = {};
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    const style = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    out[name] = {
      icon: typeof style.icon === "string" ? style.icon : null,
      imageId: typeof style.imageId === "string" ? style.imageId : null,
    };
  }
  return out;
}

/**
 * Las palabras del rubro, para un componente. Antes de que conteste el servidor, las de
 * siempre: "turno", "profesional", "paciente".
 */
export function useWords(): Words {
  return words(useInstallation().vocabulary);
}

/** Las palabras del rubro, fuera de un componente. */
export function currentWords(): Words {
  return words(current.vocabulary);
}

/** El diseño de una sección de la portada, para un componente. */
export function useHomeVariant<K extends HomeVariantSection>(section: K): HomeVariants[K] {
  return homeVariantsOf(useInstallation())[section];
}

/** Las reglas del consultorio, para un componente. Antes de que conteste el servidor, las de siempre. */
export function usePolicies(): Policies {
  return useInstallation().policies;
}

/** Las reglas del consultorio, fuera de un componente. */
export function currentPolicies(): Policies {
  return current.policies;
}

/** El nombre del consultorio, para un componente: los logos lo llevan de texto alternativo. */
export function useOfficeName(): string {
  return useInstallation().name;
}

/** "9 de Julio 3672, Rosario", como se escribe en la web. */
export function fullAddress(installation: Installation): string {
  return [installation.address, installation.city].filter(Boolean).join(", ");
}

/**
 * El mapa de la portada.
 *
 * El que pegó el consultorio, si pegó uno, porque marca su puerta exacta. Si no, uno armado
 * con la dirección, que ubica buscando el texto: sirve para arrancar sin pedirle nada a nadie.
 */
export function mapEmbedOf(installation: Installation): string {
  return (
    installation.mapEmbedUrl ??
    `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress(installation))}&output=embed`
  );
}

/** El link de "Cómo llegar", con el mismo criterio que el mapa. */
export function directionsOf(installation: Installation): string {
  return (
    installation.directionsUrl ??
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(installation))}`
  );
}

/** Las variables del tema que pisa un color de marca fijo. Ver useBrandTheme. */
const BRAND_VARS = ["--sea-h", "--sea-s", "--sea-h2", "--sea-s2", "--home-leaf"] as const;

/**
 * Los estilos de panel: la forma de la aplicación, no el color.
 *
 * Cada uno es un juego de valores en adminPanel.css (`[data-panel-skin="..."]`). `font` es
 * la familia de Google Fonts que hay que cargar para ese estilo; la de "jardin" ya viene en
 * index.html. El servidor valida contra la misma lista de nombres.
 */
export const PANEL_SKINS = [
  { id: "jardin", label: "Jardín", description: "Letra Ubuntu, esquinas suaves y grises con un toque de color", font: null },
  {
    id: "clinico",
    label: "Clínico",
    description: "Letra técnica, esquinas chicas y grises casi neutros",
    font: "IBM+Plex+Sans:wght@400;500;600;700",
  },
  {
    id: "calido",
    label: "Cálido",
    description: "Letra redonda, esquinas amplias y fondo que tira a papel",
    font: "Nunito:wght@400;600;700",
  },
  {
    id: "sobrio",
    label: "Sobrio",
    description: "Sin sombras, esquinas casi rectas y grises neutros",
    font: "Work+Sans:wght@400;500;600;700",
  },
] as const;

export type PanelSkin = (typeof PANEL_SKINS)[number]["id"];

/**
 * Dónde queda guardada la apariencia en este navegador, para pintarla antes de que conteste
 * el servidor. La lee el script del <head> de index.html; si cambia el nombre, cambia allá.
 */
const APPEARANCE_KEY = "apariencia";

/** Carga la letra de un estilo, una sola vez por familia. */
function loadSkinFont(skin: PanelSkin): void {
  const font = PANEL_SKINS.find((item) => item.id === skin)?.font;
  if (!font || document.querySelector(`link[data-skin-font="${skin}"]`)) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
  link.dataset.skinFont = skin;
  document.head.appendChild(link);
}

/**
 * Pinta la aplicación con el color de la marca, o la devuelve al de la estación.
 *
 * Todo el tema sale de cuatro variables (`--sea-h`, `--sea-s` y sus pares, en
 * adminPanel.css), y la estación del año las cambia con `data-season`. Un color de marca
 * las fija en línea sobre `<html>`, que gana sobre la estación sin tocar el contexto que la
 * calcula: sacar la marca devuelve el color de la estación solo.
 *
 * El acento va doce grados corrido y un poco más saturado, que es la misma distancia que hay
 * entre los dos tonos de la primavera de siempre.
 *
 * Está suelta, fuera del hook, porque la usa también la vista previa de la configuración.
 */
export function applyBrand(brand: Installation["brand"]): void {
  const style = document.documentElement.style;

  if (!brand) {
    for (const name of BRAND_VARS) style.removeProperty(name);
    return;
  }

  const saturation = Math.max(0, Math.min(100, brand.saturation));
  style.setProperty("--sea-h", String(brand.hue));
  style.setProperty("--sea-s", `${saturation}%`);
  style.setProperty("--sea-h2", String((brand.hue + 12) % 360));
  style.setProperty("--sea-s2", `${Math.min(100, saturation + 10)}%`);
  style.setProperty("--home-leaf", `hsl(${brand.hue} ${Math.min(100, saturation + 20)}% 40%)`);
}

/** Pone un estilo de panel. "jardin" es sacar el atributo: son los valores de siempre. */
export function applyPanelSkin(skin: PanelSkin): void {
  if (skin === "jardin") {
    document.documentElement.removeAttribute("data-panel-skin");
    return;
  }
  loadSkinFont(skin);
  document.documentElement.setAttribute("data-panel-skin", skin);
}

/**
 * La apariencia de la aplicación: el color de la marca y el estilo de los paneles.
 *
 * Además de ponerlos, los deja guardados en el navegador. La próxima vez el script del
 * <head> los pinta antes que React, y no hay medio segundo de verde y Ubuntu antes del
 * color y la letra del consultorio.
 */
export function useAppearance(): void {
  const { brand, panelSkin, elementColors } = useInstallation();
  const colors = JSON.stringify(elementColors);

  useEffect(() => {
    applyBrand(brand);
    applyPanelSkin(panelSkin);
    const vars = applyElementColors(JSON.parse(colors));

    // La vista previa no guarda nada: es lo que se está probando, no lo que hay.
    if (PREVIEW_AS) return;

    try {
      const font = PANEL_SKINS.find((item) => item.id === panelSkin)?.font ?? null;
      // Los colores propios van ya como variables: el script del <head> las pone tal cual.
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ skin: panelSkin, font, brand, vars }));
    } catch {
      // Sin almacenamiento, la próxima vez se pinta tarde. Nada más.
    }
  }, [brand, panelSkin, colors]);
}

const NUMBER_WORDS = ["", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];

/**
 * Cómo se dice el horizonte de reserva en pantalla.
 *
 * `sub` va debajo del título de la agenda y `empty` completa "Sin horarios libres ...". Con
 * el horizonte de siempre dan "hasta dos semanas en adelante" y "en las próximas dos
 * semanas", que es lo que estaba escrito.
 */
export function bookingWindowText(weeksAhead: number): { sub: string; empty: string } {
  const total = Math.max(0, Math.round(weeksAhead)) + 1;
  if (total === 1) return { sub: "solo esta semana", empty: "esta semana" };

  const words = NUMBER_WORDS[total] ?? String(total);
  return { sub: `hasta ${words} semanas en adelante`, empty: `en las próximas ${words} semanas` };
}

/** Una lista de fotos que llegó del servidor, sin las que vengan rotas. */
function imageList(value: unknown): SiteImage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      id: String(item.id),
      alt: typeof item.alt === "string" ? item.alt : "",
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      preview: typeof item.preview === "string" && item.preview.startsWith("data:image/") ? item.preview : "",
    }));
}

/* ============================================================
   El dato compartido: una sola pedida por carga de la página.
   ============================================================ */

let current: Installation = DEFAULT_INSTALLATION;
let pending: Promise<Installation> | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/**
 * Le pide la configuración al servidor una sola vez.
 *
 * Nunca falla: sin red, con un servidor viejo que no tiene la ruta o con una respuesta
 * rota, se queda con la de siempre. No vale la pena mostrarle un error a nadie por esto;
 * lo que se ve con los valores de siempre es lo que se veía antes.
 */
export function loadInstallation(): Promise<Installation> {
  if (loaded) return Promise.resolve(current);
  if (pending) return pending;

  pending = fetch(`${API_BASE_URL}/installation`, { credentials: "omit" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => {
      if (body?.data) current = merge(body.data);
      return current;
    })
    .catch(() => current)
    .finally(() => {
      loaded = true;
      pending = null;
      listeners.forEach((listener) => listener());
    });

  return pending;
}

/**
 * Vuelve a pedir la configuración.
 *
 * La llama la pantalla de configuración después de guardar: sin esto, la portada y el resto
 * seguirían mostrando lo de antes hasta recargar la página.
 */
export function refreshInstallation(): Promise<Installation> {
  loaded = false;
  pending = null;
  return loadInstallation();
}

/* ============================================================
   La vista previa de la portada.

   La configuración muestra la portada de verdad en un iframe, con lo que se está editando.
   Esa portada se abre con ?vista-previa en la dirección, y en ese modo escucha lo que le
   manda la ventana de afuera en vez de quedarse con lo que contestó el servidor.

   Solo se aceptan mensajes del mismo origen: son la misma aplicación hablando consigo
   misma. Uno de otro sitio no puede cambiar lo que se ve, ni en la vista previa.
   ============================================================ */

/** "visitante" o "paciente", si esta página es una vista previa; si no, null. */
export const PREVIEW_AS: "visitante" | "paciente" | null = (() => {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("vista-previa");
  return value === "visitante" || value === "paciente" ? value : null;
})();

export const PREVIEW_MESSAGE = "vista-previa-portada";

if (PREVIEW_AS) {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== PREVIEW_MESSAGE) return;

    current = merge(event.data.installation);
    loaded = true;
    pending = null;
    listeners.forEach((listener) => listener());
  });
}

/** Lo que hay ahora, sin esperar. Antes de que llegue la respuesta, lo de siempre. */
export function currentInstallation(): Installation {
  return current;
}

/**
 * La configuración, para un componente.
 *
 * Arranca con lo que haya —lo de siempre, la primera vez— y se vuelve a dibujar cuando
 * llega la respuesta. Así una pantalla nunca espera a esto para mostrarse.
 */
export function useInstallation(): Installation {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );

  useEffect(() => {
    void loadInstallation();
  }, []);

  return value;
}

/** Para las pruebas: vuelve al estado de antes de pedir nada, o fija una configuración. */
export function resetInstallationForTests(
  value?: Partial<Omit<Installation, "rules" | "policies">> & { rules?: Partial<InstallationRules>; policies?: Partial<Policies> }
): void {
  current = value
    ? {
        ...DEFAULT_INSTALLATION,
        ...value,
        rules: { ...DEFAULT_INSTALLATION.rules, ...(value.rules ?? {}) },
        policies: { ...DEFAULT_POLICIES, ...(value.policies ?? {}) },
      }
    : DEFAULT_INSTALLATION;
  loaded = !!value;
  pending = null;
  listeners.forEach((listener) => listener());
}
