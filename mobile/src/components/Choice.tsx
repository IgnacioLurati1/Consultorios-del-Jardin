import { FontAwesome6 } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

/**
 * Elección entre dos o tres opciones, una debajo de la otra. Se usa esto y no un
 * desplegable porque las opciones son pocas y conviene verlas todas sin abrir nada.
 */
export function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string; description?: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.choice}>
      <AppText variant="caption" tone="muted" chrome>
        {label}
      </AppText>

      <View style={styles.options}>
        {options.map((option) => {
          const active = option.key === value;

          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              android_ripple={{ color: colors.border }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: active ? colors.greenSoft : colors.surface,
                  borderColor: active ? colors.green : colors.border,
                },
                pressed && Platform.OS === "ios" && styles.pressed,
              ]}
            >
              <FontAwesome6
                name={active ? "circle-dot" : "circle"}
                size={16}
                color={active ? colors.green : colors.muted}
              />

              <View style={styles.optionText}>
                <AppText variant="body" tone={active ? "green" : "default"}>
                  {option.label}
                </AppText>
                {option.description ? (
                  <AppText variant="caption" tone="muted">
                    {option.description}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { gap: space.sm },
  options: { gap: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  optionText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
