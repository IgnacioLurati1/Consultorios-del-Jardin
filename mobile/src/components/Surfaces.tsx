import { FontAwesome6 } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { elevation, radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

/**
 * Las tres formas de agrupar contenido, en orden de cuánto pesan.
 *
 * `Section` no dibuja nada: separa con aire y un título chico. Es lo que hay que usar
 * casi siempre. `Group` es una lista de filas con una línea fina entre medio, como las
 * listas agrupadas del sistema. `Card` es lo más pesado y se guarda para cuando el
 * bloque es una cosa en sí misma que se toca o se mira aparte.
 *
 * Una pantalla que es una pila de tarjetas blancas sobre fondo gris se lee como
 * cualquier otra app; agrupar con espacio se lee como esta.
 */

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          {title ? (
            <AppText variant="caption" tone="muted" style={styles.sectionTitle}>
              {title.toUpperCase()}
            </AppText>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation.card, style]}>
      {children}
    </View>
  );
}

/** Contenedor de filas. Redondea las puntas y pinta las líneas entre medio. */
export function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  /** Dato corto alineado a la derecha: una hora, un importe, una cantidad. */
  value?: string;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  onPress?: () => void;
  /** Última fila del grupo: no lleva línea abajo. */
  last?: boolean;
  right?: ReactNode;
  destructive?: boolean;
}

/**
 * Una fila de lista. Lleva ícono solo cuando el ícono dice algo que el texto no dice;
 * una columna de cuadraditos de color delante de cada fila es decoración, no información.
 */
export function Row({ title, subtitle, value, icon, onPress, last, right, destructive }: RowProps) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : colors.text;

  const body = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      {icon ? <FontAwesome6 name={icon} size={16} color={destructive ? colors.danger : colors.muted} style={styles.rowIcon} /> : null}

      <View style={styles.rowText}>
        <AppText variant="body" numberOfLines={1} style={{ color: tint }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </AppText>
      ) : null}

      {right}

      {onPress && !right ? <FontAwesome6 name="chevron-right" size={13} color={colors.muted} /> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => (pressed && Platform.OS === "ios" ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** Aviso corto dentro del contenido: explica algo, no interrumpe. */
export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const { colors } = useTheme();

  const skin = {
    info: { bg: colors.greenSoft, fg: colors.greenDark },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <View style={[styles.note, { backgroundColor: skin.bg }]}>
      <AppText variant="small" style={{ color: skin.fg }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xxl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
    minHeight: 22,
  },
  sectionTitle: { letterSpacing: 0.8 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowIcon: { width: 20, textAlign: "center" },
  rowText: { flex: 1, gap: 2 },
  rowValue: { maxWidth: "40%", textAlign: "right" },
  pressed: { opacity: 0.6 },
  note: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
