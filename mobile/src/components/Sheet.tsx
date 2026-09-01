import { FontAwesome6 } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { AppText } from "./Text";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Panel que sube desde abajo para elegir una cosa y volver: una especialidad, un
 * consultorio, qué hacer con un turno. La pantalla de atrás se sigue viendo, que es todo
 * el punto de que sea un panel y no otra pantalla.
 *
 * Si adentro hiciera falta navegar o hubiera un segundo paso, tiene que ser una pantalla.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />

      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg, borderColor: colors.border },
          elevation.raised,
        ]}
      >
        <View style={[styles.grip, { backgroundColor: colors.border }]} />

        <View style={styles.head}>
          <AppText variant="subtitle" style={styles.title}>
            {title}
          </AppText>

          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={({ pressed }) => (pressed && Platform.OS === "ios" ? styles.pressed : undefined)}
          >
            <FontAwesome6 name="xmark" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface Option {
  key: string;
  label: string;
  description?: string;
}

/** El caso más común de panel: elegir uno de una lista. */
export function OptionSheet({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
  emptyLabel = "No hay opciones para elegir",
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selected?: string | null;
  onSelect: (key: string) => void;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.length === 0 ? (
        <AppText variant="small" tone="muted" style={styles.empty}>
          {emptyLabel}
        </AppText>
      ) : (
        options.map((option, index) => {
          const active = option.key === selected;

          return (
            <Pressable
              key={option.key}
              onPress={() => {
                onSelect(option.key);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              android_ripple={{ color: colors.border }}
              style={({ pressed }) => [
                styles.option,
                index < options.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                pressed && Platform.OS === "ios" && styles.pressed,
              ]}
            >
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

              {active ? <FontAwesome6 name="check" size={15} color={colors.green} /> : null}
            </Pressable>
          );
        })
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%",
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: radius.full, marginBottom: space.sm },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  title: { flex: 1 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: space.xl },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 8,
    paddingVertical: space.md,
  },
  optionText: { flex: 1, gap: 2 },
  empty: { paddingVertical: space.xl, textAlign: "center" },
  pressed: { opacity: 0.6 },
});
