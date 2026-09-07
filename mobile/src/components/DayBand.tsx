import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAvisos } from "../lib/avisos";
import { longDate, sentenceCase, today } from "../lib/dates";
import { useUser } from "../session/SessionProvider";
import { palette, radius, SCREEN_PADDING, space, TOUCH } from "../theme/tokens";
import { AppText } from "./Text";

const leaf = require("../../assets/images/leaf.png");

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

  return (
    <View style={[styles.band, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Image source={leaf} style={styles.leaf} contentFit="contain" accessibilityIgnoresInvertColors />
          <AppText variant="caption" chrome style={styles.brandName}>
            Consultorios del Jardín
          </AppText>
        </View>

        <View style={styles.acciones}>
          <Campana />

          {onOpenAssistant ? (
            <Pressable
              onPress={onOpenAssistant}
              accessibilityRole="button"
              accessibilityLabel="Abrir el asistente"
              hitSlop={10}
              style={({ pressed }) => [styles.assistant, pressed && Platform.OS === "ios" && styles.pressed]}
            >
              <FontAwesome6 name="comment-dots" size={16} color={palette.light.cream} />
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
  const { email } = useUser();
  const { nuevos, urgente } = useAvisos(email);
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
      <FontAwesome6 name="bell" size={16} color={palette.light.cream} />

      {nuevos > 0 ? (
        <Animated.View
          style={[
            styles.globo,
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
    backgroundColor: palette.light.ink,
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: space.xxl,
    gap: space.md,
    borderBottomLeftRadius: radius.lg + 8,
    borderBottomRightRadius: radius.lg + 8,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm },
  leaf: { width: 20, height: 20 },
  brandName: { color: "rgba(254, 250, 224, 0.72)", letterSpacing: 0.3 },
  assistant: {
    width: TOUCH - 6,
    height: TOUCH - 6,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 250, 224, 0.12)",
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
    borderColor: palette.light.ink,
    backgroundColor: "#d93025",
    alignItems: "center",
    justifyContent: "center",
  },
  globoTexto: { color: "#ffffff", fontSize: 10, lineHeight: 12, fontWeight: "700" },
  headline: { color: "rgba(254, 250, 224, 0.82)" },
  pressed: { opacity: 0.6 },
});
