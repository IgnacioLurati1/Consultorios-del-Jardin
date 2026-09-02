import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** El backend corta las observaciones; conviene avisarlo antes y no después de escribir. */
const MAX = 600;

/**
 * Lo que el profesional anota del turno.
 *
 * Lo lee también el paciente, así que el panel lo dice al lado del campo y no en otra
 * pantalla: es lo que hace la diferencia entre una nota para uno mismo y el seguimiento
 * que la persona se lleva de la consulta.
 */
export function ObservationsSheet({
  visible,
  onClose,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initial: string;
  onSave: (text: string) => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(initial);

  // Al reabrirlo tiene que mostrar lo que hay guardado, no lo que se tipeó y descartó.
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Observaciones del turno">
      <View style={styles.body}>
        <TextInput
          value={text}
          onChangeText={(value) => setText(value.slice(0, MAX))}
          placeholder="Qué trabajaron y qué sigue hasta la próxima."
          placeholderTextColor={colors.muted}
          selectionColor={colors.green}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Observaciones del turno"
          style={[styles.input, { backgroundColor: colors.sunken, borderColor: colors.border, color: colors.text }]}
        />

        <View style={styles.footer}>
          <AppText variant="caption" tone={text.length >= MAX ? "warn" : "muted"}>
            {text.length} / {MAX}
          </AppText>
        </View>

        <Note>Esto lo ven el paciente y vos. Sirve para dejarle el seguimiento, un plan o qué mirar hasta la próxima.</Note>

        <Button
          label="Guardar"
          block
          onPress={() => {
            onSave(text.trim());
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  input: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    lineHeight: 22,
  },
  footer: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
});
