import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import type { PlacePhoto } from "../lib/place";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AppearanceSheet } from "../features/Appearance";
import { useAvisos } from "../lib/avisos";
import { longDate, sentenceCase, today } from "../lib/dates";
import { radius, SCREEN_PADDING, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { Leaf } from "./Leaf";
import { AppText } from "./Text";

/**
 * El fondo del encabezado: un degradado del verde profundo de la marca.
 *
 * Es el único lugar de la app que se permite algo así, y por eso está acá y no repartido:
 * una app que decora todas las pantallas no decora ninguna. Lo que se busca es que el
 * primer golpe de vista al abrir sea el verde del consultorio y no una pantalla oscura
 * más.
 *
 * Se probó con una hoja de agua enorme detrás y se sacó: recortada por las esquinas
 * redondeadas se leía como una mancha y no como una hoja, y encima le competía a la fecha,
 * que es lo único que hay que leer acá. La hoja de la marca ya está arriba a la izquierda,
 * chica y nítida, que es donde se entiende.
 */
function Fondo() {
  const { band } = useTheme();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {/* En diagonal y no de arriba abajo: el claro queda arriba a la izquierda, donde
              está la marca, y se apaga hacia la esquina de abajo, que es por donde el
              encabezado se entrega a la pantalla. */}
          <LinearGradient id="banda" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={band.from} />
            <Stop offset="1" stopColor={band.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#banda)" />
      </Svg>
    </View>
  );
}

/**
 * El encabezado de Inicio: el verde profundo de la marca, la fecha de hoy en la
 * tipografía del consultorio y, abajo, lo único que de verdad importa saber al abrir la
 * app. Es el único lugar de la app donde aparece este fondo.
 *
 * Se eligió la fecha y no un saludo con el nombre porque el nombre ya lo sabe la persona;
 * qué día es y qué tiene hoy, no siempre.
 */
export function DayBand({ children, onOpenAssistant }: { children: ReactNode; onOpenAssistant?: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors, band } = useTheme();

  return (
    <View style={[styles.band, { backgroundColor: band.to, paddingTop: insets.top + space.lg }]}>
      <Fondo />

      <View style={styles.top}>
        <View style={styles.brand}>
          {/* La hoja dibujada y no la imagen: la misma que arma el arranque de la app, y
              se ve nítida en cualquier pantalla. */}
          <Leaf size={20} colors={{ blade: band.leaf, veins: band.leafVeins }} />
          <AppText variant="caption" chrome style={styles.brandName}>
            Consultorios del Jardín
          </AppText>
        </View>

        <View style={styles.acciones}>
          <Campana />
          <Apariencia />

          {onOpenAssistant ? (
            <Pressable
              onPress={onOpenAssistant}
              accessibilityRole="button"
              accessibilityLabel="Abrir el asistente"
              hitSlop={10}
              style={({ pressed }) => [styles.assistant, pressed && Platform.OS === "ios" && styles.pressed]}
            >
              <FontAwesome6 name="comment-dots" size={16} color={colors.cream} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <AppText variant="display" tone="cream">
        {/* today() antes de formatear, y no un Date a secas: los formateadores de
            lib/dates leen en UTC —es lo que necesitan las fechas de turno, que vienen
            sin hora— y en Argentina eso adelanta el día a partir de las nueve de la
            noche. El encabezado decía mañana todas las noches. */}
        {sentenceCase(longDate(today()))}
      </AppText>

      {children}
    </View>
  );
}

/**
 * La campanita, con el número de lo que no se leyó.
 *
 * El número va en rojo siempre que haya algo, y late cuando entre eso hay algo grave. Es
 * lo único de toda la app que se mueve solo, justamente para que quiera decir algo cuando
 * pasa. La lista está en su propia pantalla: un panel flotante en un teléfono se toca mal
 * y tapa lo que hay atrás.
 */
function Campana() {
  const { nuevos, urgente } = useAvisos();
  const { colors, band } = useTheme();
  const latido = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!urgente) return;

    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(latido, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(latido, { toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );

    ciclo.start();
    return () => ciclo.stop();
  }, [urgente, latido]);

  return (
    <Pressable
      onPress={() => router.push("/(app)/novedades" as never)}
      accessibilityRole="button"
      accessibilityLabel={nuevos === 0 ? "Avisos" : `Avisos, ${nuevos} sin leer`}
      hitSlop={10}
      style={({ pressed }) => [styles.assistant, pressed && Platform.OS === "ios" && styles.pressed]}
    >
      <FontAwesome6 name="bell" size={16} color={colors.cream} />

      {nuevos > 0 ? (
        <Animated.View
          style={[
            styles.globo,
            { borderColor: band.from },
            { transform: [{ scale: latido.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] },
          ]}
        >
          <AppText variant="caption" chrome style={styles.globoTexto}>
            {nuevos > 9 ? "9+" : nuevos}
          </AppText>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

/**
 * Cómo se ve la app, al lado de la campana.
 *
 * Es el mismo lugar que en la web, donde el engranaje está pegado a la campanita: son las
 * dos cosas que uno toca sin salir de donde está. Y es el encabezado y no la pantalla de
 * Más porque acá lo ven los tres roles, y porque de lo que se trata es del color del
 * encabezado, que es justo lo que se está mirando cuando se toca.
 */
function Apariencia() {
  const { colors, dark } = useTheme();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel="Cómo se ve la app"
        hitSlop={10}
        style={({ pressed }) => [styles.assistant, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <FontAwesome6 name={dark ? "sun" : "moon"} size={16} color={colors.cream} />
      </Pressable>

      <AppearanceSheet visible={abierto} onClose={() => setAbierto(false)} />
    </>
  );
}

/**
 * Pasa de una foto a la siguiente cada tanto. Con "reducir movimiento" prendido en el
 * teléfono queda quieta en la primera: es lo único de la pantalla que se movería solo.
 */
function useSlideshow(count: number, every = 6000): number {
  const [index, setIndex] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setStill(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (still || count < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), every);
    return () => clearInterval(timer);
  }, [still, count, every]);

  return index;
}

/**
 * El encabezado del paciente: el consultorio en fotos, en vez del bloque verde.
 *
 * El profesional y el administrador abren la app a trabajar, y para ellos el encabezado es
 * la fecha y la agenda del día. El paciente viene a atenderse a un lugar, y lo primero que
 * la página le muestra es ese lugar: la app no puede recibirlo con una lista de turnos a
 * secas. Es el mismo contenido que la portada de la página vista desde el celular.
 *
 * Abajo deja lugar para una tarjeta que se monta encima (el próximo turno): la pone quien
 * lo usa, porque es contenido de la pantalla y no del encabezado.
 */
export function PlaceBand({
  photos,
  subtitle,
  onOpenAssistant,
}: {
  photos: PlacePhoto[];
  subtitle: string;
  onOpenAssistant?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, band } = useTheme();
  const index = useSlideshow(photos.length);
  const photo = photos[index];

  return (
    <View style={[styles.place, { backgroundColor: band.to, paddingTop: insets.top + space.lg, minHeight: insets.top + 340 }]}>
      <Image
        source={photo.source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={{ duration: 900, effect: "cross-dissolve" }}
        accessible
        accessibilityLabel={photo.caption}
      />
      <Velo />

      <View style={styles.top}>
        <View style={styles.brand}>
          <Leaf size={20} colors={{ blade: band.leaf, veins: band.leafVeins }} />
        </View>

        <View style={styles.acciones}>
          <Campana />
          <Apariencia />

          {onOpenAssistant ? (
            <Pressable
              onPress={onOpenAssistant}
              accessibilityRole="button"
              accessibilityLabel="Abrir el asistente"
              hitSlop={10}
              style={({ pressed }) => [styles.assistant, pressed && Platform.OS === "ios" && styles.pressed]}
            >
              <FontAwesome6 name="comment-dots" size={16} color={colors.cream} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.placeFill} />

      <AppText variant="display" tone="cream" accessibilityRole="header">
        Consultorios del Jardín
      </AppText>
      <AppText variant="small" style={styles.headline}>
        {subtitle}
      </AppText>
    </View>
  );
}

/**
 * Lo que oscurece la foto para que se lea lo de encima. Más fuerte abajo, donde van el
 * nombre y la tarjeta, y apenas arriba, donde van los botones.
 */
function Velo() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0b1410" stopOpacity="0.45" />
            <Stop offset="0.45" stopColor="#0b1410" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#0b1410" stopOpacity="0.82" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#velo)" />
      </Svg>
    </View>
  );
}

/** El dato grande del encabezado: una frase, no una fila de tarjetas con números. */
export function BandHeadline({ children }: { children: ReactNode }) {
  return (
    <AppText variant="body" style={styles.headline}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  band: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: space.xxl,
    gap: space.md,
    borderBottomLeftRadius: radius.lg + 8,
    borderBottomRightRadius: radius.lg + 8,
    // Para que el degradado y la hoja se corten en las esquinas redondeadas.
    overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  brandName: { color: "rgba(254, 250, 224, 0.72)", letterSpacing: 0.3 },
  assistant: {
    width: TOUCH - 6,
    height: TOUCH - 6,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 250, 224, 0.14)",
  },
  acciones: { flexDirection: "row", alignItems: "center", gap: space.sm },
  /* El globito monta sobre el borde del botón, como el de cualquier campana del sistema.
     El borde del color del encabezado es lo que lo despega del ícono de atrás. */
  globo: {
    position: "absolute",
    top: 0,
    right: -1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    borderWidth: 2,
    backgroundColor: "#d93025",
    alignItems: "center",
    justifyContent: "center",
  },
  globoTexto: { color: "#ffffff", fontSize: 10, lineHeight: 12, fontWeight: "700" },
  headline: { color: "rgba(254, 250, 224, 0.82)" },
  pressed: { opacity: 0.6 },
  /* Sin las esquinas redondeadas del bloque verde: la foto va de borde a borde, y abajo
     deja aire para la tarjeta que se le monta encima. */
  place: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: space.xxxl + 40,
    gap: space.xs,
    overflow: "hidden",
  },
  placeFill: { flex: 1, minHeight: space.xxxl },
});
