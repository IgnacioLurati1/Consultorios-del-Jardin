import { FontAwesome6 } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

interface Props extends TextInputProps {
  label: string;
  /** Qué está mal, en una frase. Va debajo del campo, no en un cartel. */
  error?: string | null;
  /** Aclaración de qué se espera. No reemplaza a la etiqueta. */
  hint?: string;
  required?: boolean;
}

/**
 * Un campo de texto. La etiqueta va arriba y siempre visible: el placeholder como
 * etiqueta desaparece justo cuando la persona empieza a escribir, que es cuando más
 * falta hace.
 */
export const Field = forwardRef<TextInput, Props>(function Field(
  { label, error, hint, required, style, secureTextEntry, ...rest },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isPassword = !!secureTextEntry;
  const borderColor = error ? colors.danger : focused ? colors.green : colors.border;

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="muted" chrome>
        {label}
        {required ? " *" : ""}
      </AppText>

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor }]}>
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          secureTextEntry={isPassword && !revealed}
          accessibilityLabel={label}
          {...rest}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            style={styles.reveal}
          >
            <FontAwesome6 name={revealed ? "eye-slash" : "eye"} size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

/**
 * Un campo que no se escribe: se toca y abre algo (una lista, un calendario). Se ve
 * igual que el de texto para que la persona no tenga que aprender dos formas.
 */
export function PickerField({
  label,
  value,
  placeholder,
  onPress,
  error,
  hint,
  required,
  icon = "chevron-down",
  disabled,
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
  hint?: string;
  required?: boolean;
  icon?: React.ComponentProps<typeof FontAwesome6>["name"];
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="muted" chrome>
        {label}
        {required ? " *" : ""}
      </AppText>

      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value || placeholder}`}
        android_ripple={{ color: colors.border }}
        style={({ pressed }) => [
          styles.box,
          styles.pickerBox,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
          disabled && styles.disabled,
          pressed && Platform.OS === "ios" && styles.pressed,
        ]}
      >
        <AppText variant="body" tone={value ? "default" : "muted"} numberOfLines={1} style={styles.pickerValue}>
          {value || placeholder}
        </AppText>
        <FontAwesome6 name={icon} size={13} color={colors.muted} />
      </Pressable>

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: TOUCH + 4,
    paddingHorizontal: space.md,
  },
  pickerBox: { justifyContent: "space-between", gap: space.md },
  pickerValue: { flex: 1 },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    paddingVertical: space.md,
  },
  reveal: { paddingLeft: space.sm },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
