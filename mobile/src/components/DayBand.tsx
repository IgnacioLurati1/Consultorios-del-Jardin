import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { longDate, sentenceCase } from "../lib/dates";
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

      <AppText variant="display" tone="cream">
        {sentenceCase(longDate(new Date()))}
      </AppText>

      {children}
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
  headline: { color: "rgba(254, 250, 224, 0.82)" },
  pressed: { opacity: 0.6 },
});
