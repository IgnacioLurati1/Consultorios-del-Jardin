import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * Sistema visual de la app. Es el mismo de la web ("Consultorios del Jardín"): el verde
 * del consultorio, el papel claro y Fraunces como firma tipográfica. Lo que cambia es
 * cómo se usa, no la paleta.
 *
 * Todo color, radio y espacio de la app sale de acá. Ninguna pantalla escribe un hex.
 */

/** Verde de marca. Es el único acento de la app: no hay un segundo color de énfasis. */
const GREEN = "#3b7658";

export const palette = {
  light: {
    /** Fondo de la pantalla. */
    bg: "#f1f4f6",
    /** Tarjetas, filas, barras: lo que se apoya sobre el fondo. */
    surface: "#ffffff",
    /** Un escalón más hundido que surface, para campos y bloques de dato. */
    sunken: "#f6f8f9",
    text: "#1f2a33",
    muted: "#64748b",
    border: "#e2e8f0",
    /** Separador de 1px dentro de una lista: más suave que el borde de una tarjeta. */
    hairline: "#eef2f5",
    green: GREEN,
    greenDark: "#2f5e46",
    greenSoft: "#e8f1ec",
    /** Verde muy oscuro de la portada web. Acá pinta el encabezado de Inicio. */
    ink: "#12211a",
    cream: "#fefae0",
    danger: "#c0392b",
    dangerSoft: "#fdecea",
    warn: "#b7791f",
    warnSoft: "#fdf3e3",
    /** Sobre verde: texto y trazos que van encima del acento. */
    onGreen: "#ffffff",
  },
  dark: {
    bg: "#0e1418",
    surface: "#161d23",
    sunken: "#1c252c",
    text: "#e6ecf0",
    muted: "#94a3b0",
    border: "#2a343d",
    hairline: "#222b33",
    /** El verde se aclara en oscuro: el de marca no llega al contraste mínimo sobre negro. */
    green: "#7fb494",
    greenDark: "#9ac9ad",
    greenSoft: "#17251e",
    ink: "#0b1210",
    cream: "#fefae0",
    danger: "#f08d80",
    dangerSoft: "#2a1a18",
    warn: "#d9a441",
    warnSoft: "#2a2113",
    onGreen: "#0e1418",
  },
} as const;

/** Los dos modos exponen exactamente los mismos nombres: eso es lo que hace que se puedan intercambiar. */
export type Colors = { [K in keyof typeof palette.light]: string };

/** Escala de 4pt. Nada de números sueltos en las pantallas. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** El padding horizontal de toda pantalla. Se elige una vez y no se discute más. */
export const SCREEN_PADDING = 20;

/** Alto mínimo de cualquier cosa que se toque. */
export const TOUCH = 44;

/** Una sola escala de radios, repartida por rol. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/**
 * Dos niveles de elevación, cada uno con sombra de iOS y elevation de Android juntas.
 * Una sin la otra no se ve en la mitad de los teléfonos.
 */
export const elevation = {
  card: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  } as ViewStyle,
  raised: {
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as ViewStyle,
} as const;

/**
 * Tipografía. Fraunces es la firma de la marca y por eso se reserva para títulos y
 * fechas: en cuerpo de texto rinde peor que la del sistema y no acompaña el tamaño de
 * letra que el usuario elige en el teléfono. El resto es la fuente del sistema, que en
 * un celular no es un default perezoso sino la que mejor se lee.
 */
export const DISPLAY_FONT = "Fraunces_600SemiBold";

export const type = {
  display: {
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    includeFontPadding: false,
  } as TextStyle,
  displaySmall: {
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    includeFontPadding: false,
  } as TextStyle,
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  } as TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "400",
  } as TextStyle,
  bodyStrong: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  } as TextStyle,
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  } as TextStyle,
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  } as TextStyle,
  /** Números que se comparan en columna (plata, cantidades): cifras del mismo ancho. */
  figure: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  } as TextStyle,
} as const;

/**
 * Tope de escalado tipográfico. Va solo en texto de chrome propio (botones, etiquetas de
 * tarjeta): si crece sin límite rompe la caja. El texto de contenido escala libre.
 */
export const MAX_FONT_SCALE = 1.4;

/** Feedback de toque: en Android el ripple del sistema, en iOS un apagado leve. */
export const pressFeedback = Platform.select({
  android: { opacity: 1 },
  default: { opacity: 0.62 },
}) as ViewStyle;
