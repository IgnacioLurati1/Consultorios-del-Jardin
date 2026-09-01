import { FontAwesome6 } from "@expo/vector-icons";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  loading?: boolean;
  disabled?: boolean;
  /** Ocupa todo el ancho. Es lo normal para la acción principal de una pantalla. */
  block?: boolean;
  style?: ViewStyle;
}

/**
 * Un botón. El feedback de toque es inmediato y sin animación: en una app de turnos lo
 * que importa es que la acción se sienta hecha, no que rebote.
 */
export function Button({ label, onPress, variant = "primary", icon, loading, disabled, block, style }: Props) {
  const { colors } = useTheme();
  const off = disabled || loading;

  const skin: Record<Variant, { bg: string; border: string; fg: string }> = {
    primary: { bg: colors.green, border: colors.green, fg: colors.onGreen },
    secondary: { bg: colors.surface, border: colors.border, fg: colors.text },
    ghost: { bg: "transparent", border: "transparent", fg: colors.greenDark },
    danger: { bg: colors.dangerSoft, border: colors.dangerSoft, fg: colors.danger },
  };

  const { bg, border, fg } = skin[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      android_ripple={variant === "ghost" ? undefined : { color: colors.border }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border },
        block && styles.block,
        off && styles.off,
        pressed && Platform.OS === "ios" && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <FontAwesome6 name={icon} size={15} color={fg} /> : null}
          <AppText variant="bodyStrong" chrome style={{ color: fg }}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH + 4,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  block: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pressed: { opacity: 0.7 },
  off: { opacity: 0.5 },
});
