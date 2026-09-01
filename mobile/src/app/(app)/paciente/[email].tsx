import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import { medicalHistory } from "../../../api/appointments";
import { findPerson } from "../../../api/people";
import { Tag } from "../../../components/Chip";
import { Screen } from "../../../components/Screen";
import { DataState, EmptyState, ErrorState, Loading } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { AppointmentRow } from "../../../components/AppointmentRow";
import { stateOf } from "../../../lib/appointments";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { space } from "../../../theme/tokens";

/**
 * La ficha de un paciente: sus datos y todo lo que pasó con este profesional. El
 * historial médico es la lista de turnos, con lo que se anotó en cada uno; no existe un
 * "diagnóstico" aparte.
 */
export default function PatientScreen() {
  const { email: raw } = useLocalSearchParams<{ email: string }>();
  const patientEmail = decodeURIComponent(raw ?? "");
  const navigation = useNavigation();
  const { email: viewerEmail } = useUser();

  const person = useAsync(() => findPerson(patientEmail), [patientEmail]);
  const history = useAsync(() => medicalHistory(patientEmail), [patientEmail]);

  useLayoutEffect(() => {
    if (person.data) navigation.setOptions({ title: `${person.data.name} ${person.data.surname}` });
  }, [navigation, person.data]);

  if (person.loading) return <Loading label="Buscando la ficha" />;

  if (person.error || !person.data) {
    return (
      <Screen>
        <ErrorState message={person.error ?? "No encontramos a esa persona"} onRetry={person.reload} />
      </Screen>
    );
  }

  const patient = person.data;
  const attended = (history.data ?? []).filter((appointment) => stateOf(appointment) === "assisted").length;

  return (
    <Screen onRefresh={history.refresh} refreshing={history.refreshing}>
      <View style={styles.head}>
        <AppText variant="display">
          {patient.name} {patient.surname}
        </AppText>

        {patient.anonymous ? (
          <View style={styles.tag}>
            <Tag label="Paciente sin cuenta" />
          </View>
        ) : null}
      </View>

      {patient.anonymous ? (
        <View style={styles.note}>
          <Note tone="warn">
            No tiene cuenta, así que no recibe los mails de confirmación ni los recordatorios. Los avisos se los das vos.
          </Note>
        </View>
      ) : null}

      <Section title="Datos">
        <Group>
          <Row title="Email" value={patient.email} />
          <Row title="Teléfono" value={patient.phoneNumber || "Sin cargar"} />
          <Row title="Documento" value={patient.docNumber ? `${patient.docType} ${patient.docNumber}` : "Sin cargar"} last />
        </Group>
      </Section>

      <Section title={attended > 0 ? `Historial · ${attended} ${attended === 1 ? "sesión" : "sesiones"}` : "Historial"}>
        <DataState
          loading={history.loading}
          error={history.error}
          empty={(history.data ?? []).length === 0}
          onRetry={history.reload}
          emptyState={
            <EmptyState
              icon="clipboard-list"
              title="Todavía no lo atendiste"
              description="Cuando le des un turno, va a quedar acá con lo que anotes."
            />
          }
        >
          <Group>
            {(history.data ?? []).map((appointment, index) => (
              <AppointmentRow
                key={appointment.numAppointment}
                appointment={appointment}
                viewerEmail={viewerEmail}
                showDay
                last={index === (history.data ?? []).length - 1}
                onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
              />
            ))}
          </Group>
        </DataState>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.lg, gap: space.sm },
  tag: { flexDirection: "row" },
  note: { marginTop: space.lg },
});
