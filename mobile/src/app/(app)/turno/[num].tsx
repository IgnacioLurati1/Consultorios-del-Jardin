import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  acceptAppointment,
  cancelAppointment,
  findAppointment,
  updateRecord,
} from "../../../api/appointments";
import { errorMessage } from "../../../api/client";
import { createRecurrence, FREQUENCY_LABELS, stopRecurrence } from "../../../api/misc";
import { RecurrenceFrequency } from "../../../api/types";
import { Button } from "../../../components/Button";
import { StateBadge, Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { OptionSheet } from "../../../components/Sheet";
import { ErrorState, Loading } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { fullName, isUpcoming, stateOf } from "../../../lib/appointments";
import { hourRange, longDate, money, numericDate, sentenceCase } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { space } from "../../../theme/tokens";
import { ObservationsSheet } from "../../../features/ObservationsSheet";
import { RepeatSheet } from "../../../features/RepeatSheet";

/**
 * Un turno, con lo que cada uno puede hacerle. El paciente lo mira y lo cancela; el
 * profesional además lo acepta, lo cierra y decide si se repite; el admin solo mira,
 * porque el turno no es suyo.
 */
export default function AppointmentScreen() {
  const { num } = useLocalSearchParams<{ num: string }>();
  const number = Number(num);
  const { email, role } = useUser();
  const feedback = useFeedback();

  const state = useAsync(() => findAppointment(number), [number]);
  const [busy, setBusy] = useState(false);
  const [observationsOpen, setObservationsOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const appointment = state.data;

  if (state.loading) return <Loading label="Buscando el turno" />;

  if (state.error || !appointment) {
    return (
      <Screen>
        <ErrorState message={state.error ?? "No encontramos ese turno"} onRetry={state.reload} />
      </Screen>
    );
  }

  const key = stateOf(appointment);
  const mine = appointment.professional.email === email;
  const isProfessional = role === "professional" && mine;
  const upcoming = isUpcoming(appointment);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);

    try {
      await action();
      feedback.done(message);
      state.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    const asPatient = appointment!.patient?.email === email;

    Alert.alert(
      "Cancelar el turno",
      asPatient
        ? "Se le avisa al profesional por mail. Después vas a tener que pedir otro."
        : "Se le avisa al paciente por mail que ese horario ya no va.",
      [
        { text: "Dejarlo como está", style: "cancel" },
        {
          text: "Cancelar el turno",
          style: "destructive",
          onPress: () =>
            run(async () => {
              await cancelAppointment(number);
              router.back();
            }, "Cancelamos el turno"),
        },
      ]
    );
  }

  return (
    <>
      <Screen bottomSpace={space.lg}>
        <View style={styles.head}>
          <AppText variant="display">
            {sentenceCase(longDate(appointment.date))}
          </AppText>

          <AppText variant="title" tone="green">
            {hourRange(appointment.initialHour, appointment.finalHour)}
          </AppText>

          <View style={styles.tags}>
            <StateBadge state={key} />
            {appointment.overbooked ? <Tag label="Sobreturno" tone="warn" /> : null}
            {appointment.recurrence?.active ? <Tag label="Se repite" tone="green" /> : null}
          </View>
        </View>

        <Section title="El turno">
          <Group>
            <Row title="Profesional" value={fullName(appointment.professional)} />
            <Row title="Especialidad" value={appointment.professional.speciality || "Sin cargar"} />
            <Row title="Paciente" value={appointment.patient ? fullName(appointment.patient) : "Sin asignar"} />
            <Row title="Consultorio" value={appointment.room?.description ?? "Sin asignar"} />
            <Row title="Fecha" value={numericDate(appointment.date)} last={!isProfessional} />
            {isProfessional ? <Row title="Valor" value={money(appointment.value)} last /> : null}
          </Group>
        </Section>

        {isProfessional ? (
          <Section title="Lo que anotaste">
            <Group>
              <Row
                title={appointment.observations ? "Observaciones" : "Todavía no anotaste nada"}
                subtitle={appointment.observations ?? "Lo que escribas acá solo lo ves vos."}
                icon="pen"
                last
                onPress={() => setObservationsOpen(true)}
              />
            </Group>
          </Section>
        ) : null}

        {/* Vale `active` y no que la repetición exista: al frenarla, el turno le sigue
            apuntando (queda como registro de lo que pasó) y con solo mirar el objeto la
            ficha seguía diciendo que se repite. */}
        {appointment.recurrence?.active ? (
          <Section title="Se repite">
            <Group>
              <Row
                title={FREQUENCY_LABELS[appointment.recurrence.frequency]}
                subtitle={
                  appointment.recurrence.endDate
                    ? `Hasta el ${numericDate(appointment.recurrence.endDate)}`
                    : "Sin fecha de corte"
                }
                icon="repeat"
                last
              />
            </Group>

            {isProfessional ? (
              <View style={styles.spaced}>
                <Button
                  label="Dejar de repetirlo"
                  variant="secondary"
                  block
                  onPress={() =>
                    run(async () => {
                      await stopRecurrence(appointment.recurrence!.idRecurrence);
                    }, "No se va a generar más")
                  }
                />
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Qué podés hacer">
          <View style={styles.actions}>
            {isProfessional && key === "pending" ? (
              <Button
                label="Aceptar el turno"
                icon="check"
                block
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await acceptAppointment(number);
                  }, "Turno confirmado. Le avisamos al paciente.")
                }
              />
            ) : null}

            {isProfessional && key === "accepted" && !upcoming ? (
              <Button label="Cerrar el turno" icon="clipboard-check" block onPress={() => setCloseOpen(true)} />
            ) : null}

            {isProfessional && !appointment.recurrence?.active && key !== "cancelled" ? (
              <Button label="Hacer que se repita" icon="repeat" variant="secondary" block onPress={() => setRepeatOpen(true)} />
            ) : null}

            {isProfessional && appointment.patient ? (
              <Button
                label="Ver la ficha del paciente"
                icon="user-injured"
                variant="secondary"
                block
                onPress={() => router.push(`/(app)/paciente/${encodeURIComponent(appointment.patient!.email)}`)}
              />
            ) : null}

            {key !== "cancelled" && key !== "assisted" && key !== "missed" && role !== "admin" ? (
              <Button label="Cancelar el turno" icon="xmark" variant="danger" block onPress={confirmCancel} />
            ) : null}
          </View>

          {key === "cancelled" ? (
            <Note tone="danger">Este turno está cancelado. Si hace falta, hay que pedir uno nuevo.</Note>
          ) : key === "pending" && !isProfessional ? (
            <Note>Todavía lo tiene que confirmar el profesional. Te llega un mail en cuanto lo haga.</Note>
          ) : null}
        </Section>
      </Screen>

      <ObservationsSheet
        visible={observationsOpen}
        onClose={() => setObservationsOpen(false)}
        initial={appointment.observations ?? ""}
        onSave={(text) =>
          run(async () => {
            await updateRecord(number, { observations: text });
          }, "Guardamos lo que anotaste")
        }
      />

      <RepeatSheet
        visible={repeatOpen}
        onClose={() => setRepeatOpen(false)}
        onSave={(frequency: RecurrenceFrequency, endDate: string | null) =>
          run(async () => {
            const result = await createRecurrence(number, frequency, endDate);
            feedback.done(`Dejamos ${result.created} turnos creados`);
          }, "Listo, se va a repetir")
        }
      />

      <OptionSheet
        visible={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="¿Cómo terminó el turno?"
        options={[
          { key: "assisted", label: "Asistió", description: "La persona vino y se la atendió." },
          { key: "missed", label: "No vino", description: "El turno se perdió." },
        ]}
        onSelect={(choice) =>
          run(async () => {
            await updateRecord(number, { state: choice });
          }, choice === "assisted" ? "Anotamos que asistió" : "Anotamos que no vino")
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, paddingTop: space.lg },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  actions: { gap: space.md },
  spaced: { marginTop: space.md },
});
