import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { errorMessage } from "../api/client";
import { removeFromMyWaitlist, WaitingPatient } from "../api/waitlist";
import { Button } from "../components/Button";
import { useFeedback } from "../components/Feedback";
import { Sheet } from "../components/Sheet";
import { Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { describeDaysTitle, formatMoment } from "../lib/waitlist";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/**
 * Quiénes esperan al profesional, con la opción de sacar a alguien. Es la ventana de la
 * página, en panel.
 *
 * Sacar a alguien no le avisa a la persona: es una decisión de la agenda del profesional y
 * contársela no le deja nada para hacer.
 */
export function WaitlistPeopleSheet({
  visible,
  onClose,
  list,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  list: WaitingPatient[];
  /** Cómo quedó la lista después de sacar a alguien, para que la pantalla de atrás se entere. */
  onChanged: (list: WaitingPatient[]) => void;
}) {
  const { colors } = useTheme();
  const feedback = useFeedback();
  const [removing, setRemoving] = useState<number | null>(null);

  async function remove(person: WaitingPatient) {
    setRemoving(person.id);

    try {
      await removeFromMyWaitlist(person.id);
      onChanged(list.filter((item) => item.id !== person.id));
      feedback.done(`${person.patient.name} fuera de la lista de espera`);
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setRemoving(null);
    }
  }

  function confirmRemove(person: WaitingPatient) {
    Alert.alert(
      "Quitar de la lista",
      `${person.patient.name} ${person.patient.surname} sale de la lista de espera. No recibe ningún aviso.`,
      [
        { text: "Volver", style: "cancel" },
        { text: "Quitar", style: "destructive", onPress: () => remove(person) },
      ]
    );
  }

  const count = list.length;

  return (
    <Sheet visible={visible} onClose={onClose} title="Lista de espera">
      <AppText variant="small" tone="muted" style={styles.lead}>
        {count === 0 ? "Sin personas en espera" : count === 1 ? "Una persona en espera" : `${count} personas en espera`}
      </AppText>

      <View style={styles.list}>
        {list.map((person) => (
          <View key={person.id} style={[styles.person, { backgroundColor: colors.sunken }]}>
            <AppText variant="bodyStrong">
              {person.patient.surname}, {person.patient.name}
            </AppText>
            <AppText variant="small">
              {describeDaysTitle(person.days)}, de {person.fromHour} a {person.toHour}
            </AppText>
            <AppText variant="caption" tone="muted">
              Se anotó el {formatMoment(person.createdAt)} ·{" "}
              {person.noticesSent === 0 ? "todavía sin avisos" : person.noticesSent === 1 ? "un aviso" : `${person.noticesSent} avisos`}{" "}
              · sale el {formatMoment(person.expiresAt)}
            </AppText>

            <View style={styles.action}>
              <Button
                label="Quitar de la lista"
                variant="ghost"
                loading={removing === person.id}
                onPress={() => confirmRemove(person)}
              />
            </View>
          </View>
        ))}
      </View>

      {count > 0 ? (
        <View style={styles.note}>
          <Note>Al liberarse un horario, el aviso llega a todos a la vez. Quitar a alguien no le envía aviso.</Note>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: space.md },
  list: { gap: space.sm },
  person: { gap: 2, padding: space.md, borderRadius: radius.md },
  action: { alignItems: "flex-start", marginTop: space.xs, marginLeft: -space.md },
  note: { marginTop: space.lg, marginBottom: space.md },
});
