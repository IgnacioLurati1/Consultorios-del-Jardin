import { FontAwesome6 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

type Kind = "done" | "problem";

interface Message {
  id: number;
  kind: Kind;
  text: string;
}

interface FeedbackValue {
  /** Salió bien. Un golpecito y un cartel corto: nunca una ventana que haya que cerrar. */
  done: (text: string) => void;
  /** Falló algo que no tiene un lugar propio donde mostrarse (un formulario lo muestra en su campo). */
  problem: (text: string) => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const VISIBLE_MS = 3200;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: Kind, text: string) => {
    if (timer.current) clearTimeout(timer.current);

    setMessage({ id: Date.now(), kind, text });

    // El aviso es visual y dura poco: quien usa lector de pantalla tiene que escucharlo.
    AccessibilityInfo.announceForAccessibility(text);

    Haptics.notificationAsync(
      kind === "done" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {
      // Hay teléfonos sin motor de vibración. No es motivo para no mostrar el aviso.
    });

    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const value = useMemo<FeedbackValue>(
    () => ({ done: (text) => show("done", text), problem: (text) => show("problem", text) }),
    [show]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {message ? <Toast key={message.id} message={message} /> : null}
    </FeedbackContext.Provider>
  );
}

function Toast({ message }: { message: Message }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [enter]);

  const done = message.kind === "done";

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.toast,
        elevation.raised,
        {
          top: insets.top + space.sm,
          backgroundColor: done ? colors.greenSoft : colors.dangerSoft,
          borderColor: done ? colors.green : colors.danger,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <FontAwesome6
        name={done ? "circle-check" : "circle-exclamation"}
        size={16}
        color={done ? colors.greenDark : colors.danger}
      />
      <View style={styles.toastText}>
        <AppText variant="small" style={{ color: done ? colors.greenDark : colors.danger }}>
          {message.text}
        </AppText>
      </View>
    </Animated.View>
  );
}

export function useFeedback(): FeedbackValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback se usa adentro de FeedbackProvider");
  return value;
}

/** Golpecito corto para confirmar algo que la persona eligió (un filtro, una opción). */
export function tapFeedback(): void {
  Haptics.selectionAsync().catch(() => {});
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toastText: { flex: 1 },
});
