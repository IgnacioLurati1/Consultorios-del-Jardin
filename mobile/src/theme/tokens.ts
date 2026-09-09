import { Platform, TextStyle, ViewStyle } from "react-native";
import { hsl, Season, SEASON_TINT } from "./season";

/**
 * Sistema visual de la app. Es el mismo de la web ("Consultorios del Jardín"): el color
 * del consultorio, el papel claro y Fraunces como firma tipográfica. Lo que cambia es
 * cómo se usa, no la paleta.
 *
 * Todo color, radio y espacio de la app sale de acá. Ninguna pantalla escribe un hex.
 */

/** Los dos modos exponen exactamente los mismos nombres: eso es lo que los hace intercambiables. */
export interface Colors {
  /** Fondo de la pantalla. */
  bg: string;
  /** Tarjetas, filas, barras: lo que se apoya sobre el fondo. */
  surface: string;
  /** Un escalón separado de surface, para campos y bloques de dato. */
  sunken: string;
  text: string;
  muted: string;
  border: string;
  /** Separador de 1px dentro de una lista: más suave que el borde de una tarjeta. */
  hairline: string;
  /** El acento. Es el único de la app: no hay un segundo color de énfasis. */
  green: string;
  greenDark: string;
  greenSoft: string;
  /**
   * El verde de "esto está bien": un turno confirmado.
   *
   * Es igual que el trío de arriba pero quieto: mismos tres papeles —el pelado para la
   * línea, `okDark` para el texto, `okSoft` para el fondo— y el mismo tono en las cuatro
   * estaciones.
   */
  ok: string;
  okDark: string;
  okSoft: string;
  /** El tono más profundo de la estación. Es el fondo del encabezado de Inicio. */
  ink: string;
  cream: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  /** Sobre el acento: texto y trazos que van encima de `green`. */
  onGreen: string;
}

/**
 * El encabezado de Inicio.
 *
 * Es el mismo en los dos modos: siempre oscuro. No sale de la paleta porque no cambia con
 * el modo del teléfono —de noche y de día es el mismo bloque— y porque es un degradado,
 * que la paleta no sabe expresar.
 *
 * Los dos extremos son los de la barra de arriba de la web, un punto más saturados: en un
 * teléfono este bloque ocupa un tercio de la pantalla y es lo primero que se ve al abrir.
 */
export interface Band {
  from: string;
  to: string;
  leaf: string;
  leafVeins: string;
}

/**
 * Los colores que no son de la estación.
 *
 * El rojo y el ámbar son señales, no decoración: el turno que no vino tiene que verse
 * igual de rojo en verano que en otoño. Y el crema es de la marca, como la hoja.
 *
 * El verde de confirmado está acá por lo mismo, y es el que faltaba. Salía del acento, y
 * el acento se mueve: en otoño un turno confirmado quedaba marrón, del mismo color que un
 * aviso, al lado de un "No vino" rojo y un "A confirmar" ámbar que no se movían. Un
 * estado no puede cambiar de color según el mes. El tono es el de la primavera, que es el
 * verde del proyecto, y son los mismos números que usa la web.
 */
const SIGNALS = {
  light: {
    cream: "#fefae0",
    danger: "#c0392b",
    dangerSoft: "#fdecea",
    warn: "#b7791f",
    warnSoft: "#fdf3e3",
    ok: hsl(116, 32, 35),
    okDark: hsl(116, 32, 27),
    okSoft: hsl(116, 32, 93),
  },
  dark: {
    cream: "#fefae0",
    danger: "#ef8a7d",
    dangerSoft: "#32201e",
    warn: "#dfb264",
    warnSoft: "#2e2617",
    /* Sube igual que el acento en oscuro: el mismo tono se pierde sobre el gris. */
    ok: hsl(116, 34, 51),
    okDark: hsl(116, 34, 62),
    okSoft: hsl(116, 26, 14),
  },
} as const;

/*
 * El oscuro no es el claro con los valores dados vuelta.
 *
 * No hay negro puro: un negro puro con texto blanco encima vibra y cansa. Y los grises no
 * son neutros sino de la estación, con muy poco color —el consultorio sigue estando,
 * apagado—, que es la misma decisión que ya había tomado la web. La app se había quedado
 * con grises azulados, y eso la hacía verse como cualquier otra app oscura en vez de como
 * esta.
 *
 * El acento sube de luminosidad porque el de marca, que se lee bien sobre blanco,
 * desaparece sobre un gris oscuro.
 */
function build(season: Season, dark: boolean): Colors {
  const { h, s } = SEASON_TINT[season];

  if (dark) {
    return {
      bg: hsl(h, 17, 6),
      surface: hsl(h, 13, 12),
      /* Más claro que `surface` y no más oscuro: en oscuro, un escalón hacia abajo se
         funde con el fondo de la pantalla y el hueco deja de leerse como hueco. */
      sunken: hsl(h, 11, 15),
      text: hsl(h, 14, 91),
      muted: hsl(h, 8, 63),
      border: hsl(h, 11, 22),
      hairline: hsl(h, 12, 16),
      green: hsl(h, s, 51),
      greenDark: hsl(h, s, 61),
      greenSoft: hsl(h, s, 14),
      ink: hsl(h, s, 12),
      onGreen: hsl(h, 17, 6),
      ...SIGNALS.dark,
    };
  }

  return {
    bg: hsl(h, 14, 95),
    surface: "#ffffff",
    sunken: hsl(h, 12, 97),
    text: hsl(h, 18, 16),
    muted: hsl(h, 12, 41),
    border: hsl(h, 20, 90),
    hairline: hsl(h, 18, 95),
    green: hsl(h, s, 35),
    greenDark: hsl(h, s, 27),
    greenSoft: hsl(h, s, 93),
    ink: hsl(h, s, 10),
    onGreen: "#ffffff",
    ...SIGNALS.light,
  };
}

/*
 * Ocho paletas posibles —cuatro estaciones por dos modos— y useTheme lo llama desde cada
 * componente de cada pantalla. Se guardan hechas: armarlas es un puñado de cuentas, pero
 * hacerlas cientos de veces por segundo de scroll no tiene ningún sentido.
 */
const hechas = new Map<string, Colors>();

export function paletteFor(season: Season, dark: boolean): Colors {
  const key = `${season}${dark ? "-oscuro" : "-claro"}`;

  let colors = hechas.get(key);
  if (!colors) {
    colors = build(season, dark);
    hechas.set(key, colors);
  }

  return colors;
}

export function bandFor(season: Season): Band {
  const { h, s, h2, s2 } = SEASON_TINT[season];

  return {
    from: hsl(h, s + 7, 20),
    to: hsl(h2, s2, 11),
    /* La hoja de la marca acompaña, pero mucho más clara y más saturada que el fondo:
       es un dibujo de veinte píxeles sobre un bloque oscuro, y con el tono del propio
       encabezado se perdería. La saturación de más es la misma que le queda a la hoja de
       la web cuando se le gira el tono, para que las dos hojas se vean igual de vivas. */
    leaf: hsl(h, s + 22, 56),
    leafVeins: hsl(h, s + 7, 20),
  };
}

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
