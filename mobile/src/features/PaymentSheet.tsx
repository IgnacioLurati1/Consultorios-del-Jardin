import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { PaymentState } from "../api/types";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { Sheet } from "../components/Sheet";
import { Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { PAYMENT_OPTIONS } from "../lib/appointments";
import { money } from "../lib/dates";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/**
 * Si el turno se cobró, y cuánto.
 *
 * El monto solo aparece con el pago parcial, que es el único caso donde hay algo que
 * escribir: en los otros dos el número sale del valor del turno. Lo que se valida acá es
 * lo mismo que valida el backend, dicho antes de guardar: un número mayor que cero, que
 * no pase el valor de la consulta, y que tampoco lo iguale —si pagó todo, es "Pagó", y un
 * pago parcial que cubre el total deja un turno que figura debiendo cero—.
 */
export function PaymentSheet({
  visible,
  onClose,
  value,
  initialState,
  initialAmount,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  /** Lo que vale el turno. Es contra esto que se valida el pago parcial. */
  value: number;
  initialState: PaymentState | null;
  initialAmount: number | null;
  onSave: (state: PaymentState, amount: number | null) => void;
}) {
  const { colors } = useTheme();
  const [state, setState] = useState<PaymentState>(initialState ?? "unpaid");
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");

  // Al reabrirla tiene que mostrar lo guardado, no lo que se tipeó y se descartó.
  useEffect(() => {
    if (!visible) return;
    setState(initialState ?? "unpaid");
    setAmount(initialAmount ? String(initialAmount) : "");
  }, [visible, initialState, initialAmount]);

  const paid = Number(amount);

  function problem(): string | null {
    if (state !== "partial") return null;
    if (value <= 0) return "Para registrar un pago parcial el turno tiene que tener un valor cargado.";
    if (!amount.trim() || !Number.isFinite(paid) || paid <= 0) return "Escribí cuánto pagó.";
    if (paid > value) return `El turno vale ${money(value)}: no puede haber pagado más que eso.`;
    if (paid === value) return `Pagó ${money(value)}, o sea todo: marcalo como "Pagó".`;
    return null;
  }

  const issue = problem();

  return (
    <Sheet visible={visible} onClose={onClose} title="Cobro del turno">
      <View style={styles.body}>
        <Choice label="Cómo quedó" value={state} onChange={(key) => setState(key as PaymentState)} options={PAYMENT_OPTIONS} />

        {state === "partial" ? (
          <View style={styles.amount}>
            <AppText variant="caption" tone="muted" chrome>
              ¿Cuánto pagó?
            </AppText>

            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.muted}
              selectionColor={colors.green}
              keyboardType="number-pad"
              accessibilityLabel="Cuánto pagó"
              style={[styles.input, { backgroundColor: colors.sunken, borderColor: colors.border, color: colors.text }]}
            />

            <AppText variant="caption" tone="muted">
              {value > 0 ? `El turno vale ${money(value)}.` : "Este turno no tiene valor cargado."}
              {!issue && paid > 0 && value > 0 ? ` Quedan debiendo ${money(value - paid)}.` : ""}
            </AppText>
          </View>
        ) : null}

        {issue ? <Note tone="danger">{issue}</Note> : null}

        {initialState === null ? (
          <Note>
            Este turno es anterior al registro de cobros, así que no figura como impago en ningún lado hasta que elijas
            algo acá.
          </Note>
        ) : null}

        <Button
          label="Guardar"
          block
          disabled={!!issue}
          onPress={() => {
            onSave(state, state === "partial" ? paid : null);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.md },
  amount: { gap: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
  },
});
