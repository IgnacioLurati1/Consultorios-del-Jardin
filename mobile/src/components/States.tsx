import { FontAwesome6 } from "@expo/vector-icons";
import { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { Button } from "./Button";
import { AppText } from "./Text";

/**
 * Los cuatro estados por los que pasa cualquier pantalla que pide datos: cargando,
 * vacía, rota y lista. Están juntos acá para que ninguna pantalla se olvide de uno.
 */

/** Bloque gris que respira, del tamaño del contenido que viene. */
export function Skeleton({ height = 64, width, style }: { height?: number; width?: number | string; style?: any }) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ height, width: (width as any) ?? "100%", backgroundColor: colors.border, borderRadius: radius.md, opacity: pulse }, style]}
    />
  );
}

/** Varias líneas del mismo alto: imita la lista que se está por dibujar. */
export function SkeletonList({ rows = 4, height = 64 }: { rows?: number; height?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </View>
  );
}

interface EmptyProps {
  title: string;
  /** Qué hacer para que deje de estar vacío. Sin esto, un vacío es una pared. */
  description?: string;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  action?: { label: string; onPress: () => void };
  /**
   * Va adentro de una sección, no ocupando la pantalla entera. Respira menos: si no, un
   * bloque vacío pesa más que los que sí tienen contenido.
   */
  compact?: boolean;
}

export function EmptyState({ title, description, icon = "leaf", action, compact }: EmptyProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.centered, compact && styles.centeredCompact]}>
      <View style={[styles.badge, { backgroundColor: colors.greenSoft }]}>
        <FontAwesome6 name={icon} size={20} color={colors.green} />
      </View>

      <AppText variant="subtitle" style={styles.centerText}>
        {title}
      </AppText>

      {description ? (
        <AppText variant="small" tone="muted" style={styles.centerText}>
          {description}
        </AppText>
      ) : null}

      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

/**
 * Algo falló. Se muestra el mensaje que mandó el servidor, que ya viene escrito para
 * leer, y un botón para volver a intentar: casi siempre es un problema de señal.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={styles.centered}>
      <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
        <FontAwesome6 name="cloud-arrow-down" size={20} color={colors.danger} />
      </View>

      <AppText variant="subtitle" style={styles.centerText}>
        No pudimos traer esto
      </AppText>

      <AppText variant="small" tone="muted" style={styles.centerText}>
        {message}
      </AppText>

      {onRetry ? <Button label="Probar de nuevo" onPress={onRetry} variant="secondary" style={styles.action} /> : null}
    </View>
  );
}

/** Carga corta y sin forma conocida: un spinner alcanza y no miente sobre el layout. */
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.green} />
      {label ? (
        <AppText variant="small" tone="muted" style={styles.centerText}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Envuelve el ciclo entero: mientras carga muestra el esqueleto, si falló el error con
 * reintento, si no hay nada el vacío, y si hay datos los hijos.
 */
export function DataState({
  loading,
  error,
  empty,
  onRetry,
  skeleton,
  emptyState,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  skeleton?: ReactNode;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <>{skeleton ?? <SkeletonList />}</>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <>{emptyState}</>;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingVertical: space.xxxl + space.md,
    paddingHorizontal: space.lg,
  },
  centeredCompact: { paddingVertical: space.xxl },
  centerText: { textAlign: "center" },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  action: { marginTop: space.xs },
});
