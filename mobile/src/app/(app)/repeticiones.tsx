import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import { findRecurrences, FREQUENCY_LABELS, stopRecurrence, updateRecurrence } from "../../api/misc";
import { Recurrence } from "../../api/types";
import { Button } from "../../components/Button";
import { Tag } from "../../components/Chip";
import { useFeedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { Sheet } from "../../components/Sheet";
import { DataState, EmptyState } from "../../components/States";
import { Group, Note, Row, Section } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { Choice } from "../../components/Choice";
import { DateField } from "../../features/DateField";
import { addDays, hourRange, numericDate, relativeDay, sentenceCase } from "../../lib/dates";
import { DAY_LABELS } from "../../lib/specialities";
import { useAsync } from "../../lib/useAsync";
import { space } from "../../theme/tokens";

/**
 * Los turnos que se generan solos. Cada uno es una receta: un día de la semana, un
 * horario y cada cuánto se repite. El backend va creando los turnos a medida que se
 * acercan, no todos de una.
 */
export default function RecurrencesScreen() {
  const feedback = useFeedback();
  const state = useAsync(findRecurrences, []);
  const [editing, setEditing] = useState<Recurrence | null>(null);

  function confirmStop(recurrence: Recurrence) {
    Alert.alert("Dejar de repetirlo", "Los turnos que ya se crearon quedan como están. No se genera ninguno más.", [
      { text: "Seguir repitiendo", style: "cancel" },
      {
        text: "Frenarlo",
        style: "destructive",
        onPress: async () => {
          try {
            await stopRecurrence(recurrence.idRecurrence);
            feedback.done("No se va a generar más");
            state.reload();
          } catch (problem) {
            feedback.problem(errorMessage(problem));
          }
        },
      },
    ]);
  }

  return (
    <>
      <Screen onRefresh={state.refresh} refreshing={state.refreshing}>
        <DataState
          loading={state.loading}
          error={state.error}
          empty={(state.data ?? []).length === 0}
          onRetry={state.reload}
          emptyState={
            <EmptyState
              icon="repeat"
              title="No hay turnos repitiéndose"
              description="Podés marcar cualquier turno como repetible desde su detalle, y se va a volver a crear solo."
            />
          }
        >
          {(state.data ?? []).map((recurrence) => (
            <Section
              key={recurrence.idRecurrence}
              title={recurrence.patient ? `${recurrence.patient.name} ${recurrence.patient.surname}` : "Sin paciente"}
            >
              <Group>
                <Row
                  title={FREQUENCY_LABELS[recurrence.frequency]}
                  subtitle={`Los ${dayNameOf(recurrence.startDate)}, ${hourRange(recurrence.initialHour, recurrence.finalHour)}`}
                  icon="repeat"
                />
                <Row title="Consultorio" value={recurrence.room?.description ?? "Sin asignar"} />
                <Row
                  title="Hasta cuándo"
                  value={recurrence.endDate ? numericDate(recurrence.endDate) : "Sin corte"}
                  last={recurrence.upcoming.length === 0}
                />

                {recurrence.upcoming.slice(0, 3).map((appointment, index) => (
                  <Row
                    key={appointment.numAppointment}
                    title={sentenceCase(relativeDay(appointment.date))}
                    subtitle="Ya está creado"
                    icon="calendar-check"
                    last={index === Math.min(recurrence.upcoming.length, 3) - 1}
                    onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
                  />
                ))}
              </Group>

              {recurrence.overbooked ? (
                <View style={styles.tag}>
                  <Tag label="Se crea como sobreturno" tone="warn" />
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button label="Cambiar" variant="secondary" onPress={() => setEditing(recurrence)} style={styles.action} />
                <Button label="Frenar" variant="danger" onPress={() => confirmStop(recurrence)} style={styles.action} />
              </View>
            </Section>
          ))}

          <Section>
            <Note>
              Si un horario ya está ocupado cuando toca generarlo, ese turno se saltea y la repetición sigue con el
              siguiente.
            </Note>
          </Section>
        </DataState>
      </Screen>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="Cambiar la repetición">
        {editing ? (
          <EditRecurrence
            recurrence={editing}
            done={() => {
              setEditing(null);
              state.reload();
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function EditRecurrence({ recurrence, done }: { recurrence: Recurrence; done: () => void }) {
  const feedback = useFeedback();

  const [frequency, setFrequency] = useState(recurrence.frequency);
  const [forever, setForever] = useState(!recurrence.endDate);
  const [endDate, setEndDate] = useState<string | null>(recurrence.endDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingDate = !forever && !endDate;

  async function save() {
    if (busy || missingDate) return;
    setBusy(true);

    try {
      await updateRecurrence(recurrence.idRecurrence, { frequency, endDate: forever ? null : endDate });
      feedback.done("Guardamos el cambio");
      done();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Choice
        label="Cada cuánto"
        options={[
          { key: "weekly", label: "Todas las semanas" },
          { key: "biweekly", label: "Cada dos semanas" },
        ]}
        value={frequency}
        onChange={(key) => setFrequency(key as Recurrence["frequency"])}
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
          error={missingDate ? "Elegí hasta qué día se repite" : null}
        />
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted">
          El cambio afecta solo a los turnos que todavía no se generaron.
        </AppText>
      )}

      <Button label="Guardar" onPress={save} loading={busy} disabled={missingDate} block />
    </View>
  );
}

/** El día de la semana sale de la fecha del turno que originó la repetición. */
function dayNameOf(startDate: string): string {
  const names = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const day = names[new Date(`${startDate.slice(0, 10)}T12:00:00`).getDay()];
  return DAY_LABELS[day].toLowerCase();
}

const styles = StyleSheet.create({
  tag: { flexDirection: "row", marginTop: space.md },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.md },
  action: { flex: 1 },
  form: { gap: space.lg, paddingBottom: space.md },
});
