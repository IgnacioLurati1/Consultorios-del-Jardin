import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { appointmentsByProfessional, AppointmentKind } from "../../../api/appointments";
import { findActiveByType } from "../../../api/people";
import { Person } from "../../../api/types";
import { ChipRow, StateBadge, Tag } from "../../../components/Chip";
import { PickerField } from "../../../components/Field";
import { Screen } from "../../../components/Screen";
import { OptionSheet } from "../../../components/Sheet";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { fullName, stateOf } from "../../../lib/appointments";
import { hhmm, relativeDay } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

const KINDS: { key: AppointmentKind; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "normal", label: "Turnos" },
  { key: "overbooked", label: "Sobreturnos" },
];

/**
 * Qué está dando cada profesional. Es una pantalla de control, no de gestión: el admin
 * mira, no toca. Por eso las filas no llevan a ningún lado ni tienen acciones.
 *
 * Arranca en los turnos de hoy en adelante: lo que ya pasó no se controla.
 */
export default function ControlScreen() {
  const { colors } = useTheme();

  const [professional, setProfessional] = useState<Person | null>(null);
  const [kind, setKind] = useState<AppointmentKind>("all");
  const [sheet, setSheet] = useState(false);

  const people = useAsync(() => findActiveByType("professional"), []);
  const appointments = useAsync(
    () => (professional ? appointmentsByProfessional(professional.email, 0, false, kind) : Promise.resolve([])),
    [professional?.email, kind]
  );

  const list = appointments.data ?? [];
  const overbooked = list.filter((appointment) => appointment.overbooked).length;

  return (
    <>
      <Screen onRefresh={appointments.refresh} refreshing={appointments.refreshing}>
        <View style={styles.top}>
          <PickerField
            label="Profesional"
            value={professional ? fullName(professional) : null}
            placeholder="Elegir un profesional"
            onPress={() => setSheet(true)}
            hint={people.error ?? undefined}
          />

          <ChipRow options={KINDS} value={kind} onChange={setKind} />
        </View>

        {!professional ? (
          <EmptyState
            icon="user-doctor"
            title="Elegí un profesional"
            description="Vas a ver los turnos que tiene de hoy en adelante, con cuáles son sobreturnos."
          />
        ) : (
          <DataState
            loading={appointments.loading}
            error={appointments.error}
            empty={list.length === 0}
            onRetry={appointments.reload}
            skeleton={<SkeletonList rows={4} height={72} />}
            emptyState={
              <EmptyState
                icon="calendar-xmark"
                title="No tiene turnos por delante"
                description={
                  kind === "overbooked"
                    ? "No está dando sobreturnos en los próximos días."
                    : "No hay turnos cargados de hoy en adelante."
                }
              />
            }
          >
            <Section title={`${list.length} ${list.length === 1 ? "turno" : "turnos"}${overbooked > 0 ? ` · ${overbooked} sobreturno${overbooked === 1 ? "" : "s"}` : ""}`}>
              <Group>
                {list.map((appointment, index) => (
                  <Row
                    key={appointment.numAppointment}
                    title={`${relativeDay(appointment.date)} · ${hhmm(appointment.initialHour)}`}
                    subtitle={
                      appointment.patient
                        ? `${appointment.patient.name} ${appointment.patient.surname} · ${appointment.room.description}`
                        : `Sin paciente · ${appointment.room.description}`
                    }
                    last={index === list.length - 1}
                    right={
                      <View style={styles.badges}>
                        {appointment.overbooked ? <Tag label="Sobreturno" tone="warn" /> : null}
                        <StateBadge state={stateOf(appointment)} />
                      </View>
                    }
                  />
                ))}
              </Group>
            </Section>

            {overbooked > 0 ? (
              <AppText variant="caption" tone="muted" style={styles.footnote}>
                Un sobreturno es un turno que el profesional dio fuera de sus módulos de atención. No es un error, pero
                de a muchos habla de una agenda que no alcanza.
              </AppText>
            ) : null}
          </DataState>
        )}
      </Screen>

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Profesional"
        options={(people.data ?? []).map((person) => ({
          key: person.email,
          label: fullName(person),
          description: person.speciality || "Sin especialidad",
        }))}
        selected={professional?.email}
        onSelect={(chosen) => setProfessional((people.data ?? []).find((person) => person.email === chosen) ?? null)}
        emptyLabel="No hay profesionales habilitados."
      />
    </>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: space.lg, gap: space.md, marginBottom: space.lg },
  badges: { alignItems: "flex-end", gap: space.xs },
  footnote: { marginTop: space.lg },
});
