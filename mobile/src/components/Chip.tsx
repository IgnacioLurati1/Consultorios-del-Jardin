import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StateKey, STATE_LABELS, stateColors } from "../lib/appointments";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { tapFeedback } from "./Feedback";
import { AppText } from "./Text";

/** Filtro de una sola opción, en fila. Lo que está elegido se pinta con el verde. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const active = option.key === value;

        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (!active) tapFeedback();
              onChange(option.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            android_ripple={{ color: colors.border, borderless: false }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.green : colors.surface,
                borderColor: active ? colors.green : colors.border,
              },
              pressed && Platform.OS === "ios" && styles.pressed,
            ]}
          >
            <AppText variant="caption" chrome style={{ color: active ? colors.onGreen : colors.text }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** El estado de un turno, dicho con palabras y con color. */
export function StateBadge({ state }: { state: StateKey }) {
  const { colors } = useTheme();
  const skin = stateColors(state, colors);

  return (
    <View style={[styles.badge, { backgroundColor: skin.bg }]}>
      <AppText variant="caption" chrome style={{ color: skin.fg }}>
        {STATE_LABELS[state]}
      </AppText>
    </View>
  );
}

/** Etiqueta neutra para un dato suelto: "Sobreturno", "Se repite", una especialidad. */
export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "warn" | "danger" }) {
  const { colors } = useTheme();

  const skin = {
    neutral: { bg: colors.sunken, fg: colors.muted },
    green: { bg: colors.greenSoft, fg: colors.greenDark },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: skin.bg }]}>
      <AppText variant="caption" chrome style={{ color: skin.fg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    minHeight: TOUCH - 8,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.7 },
});
