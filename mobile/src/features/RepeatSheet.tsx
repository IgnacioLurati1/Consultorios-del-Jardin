import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { RecurrenceFrequency } from "../api/types";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { AppText } from "../components/Text";
import { addDays } from "../lib/dates";
import { space } from "../theme/tokens";
import { Choice } from "../components/Choice";
import { DateField } from "./DateField";

/**
 * Convierte un turno en uno que se repite. Son dos decisiones: cada cuánto, y hasta
 * cuándo. La segunda arranca en "sin fecha de corte" porque es lo normal en un
 * tratamiento; la fecha se pone cuando ya se sabe que hay un final.
 */
export function RepeatSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (frequency: RecurrenceFrequency, endDate: string | null) => void;
}) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [forever, setForever] = useState(true);
  const [endDate, setEndDate] = useState<string | null>(null);

  const missingDate = !forever && !endDate;

  return (
    <Sheet visible={visible} onClose={onClose} title="Que este turno se repita">
      <View style={styles.body}>
        <Choice
          label="Cada cuánto"
          options={[
            { key: "weekly", label: "Todas las semanas" },
            { key: "biweekly", label: "Cada dos semanas" },
          ]}
          value={frequency}
          onChange={(key) => setFrequency(key as RecurrenceFrequency)}
        />

        <Choice
          label="Hasta cuándo"
          options={[
            { key: "forever", label: "Sin fecha de corte" },
            { key: "until", label: "Hasta una fecha" },
          ]}
          value={forever ? "forever" : "until"}
          onChange={(key) => setForever(key === "forever")}
        />

        {!forever ? (
          <DateField
            label="Último turno"
            value={endDate}
            onChange={setEndDate}
            minimumDate={addDays(new Date(), 1)}
            hint="Después de ese día no se crea ninguno más."
            error={missingDate ? "Elegí hasta qué día se repite" : null}
          />
        ) : null}

        <AppText variant="caption" tone="muted">
          Se van a ir creando de a poco, a medida que se acerquen. Podés frenarlo cuando quieras.
        </AppText>

        <Button
          label="Empezar a repetirlo"
          block
          disabled={missingDate}
          onPress={() => {
            onSave(frequency, forever ? null : endDate);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl, paddingBottom: space.md },
});
