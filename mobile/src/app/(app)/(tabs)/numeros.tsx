import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { assistantUsage, officeAnalytics } from "../../../api/analytics";
import { ChipRow } from "../../../components/Chip";
import { ErrorState, SkeletonList } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { Headline, MonthBars, Pair, Ranking } from "../../../features/Numbers";
import { compactNumber, money } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { SCREEN_PADDING, space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

type Metric = "appointments" | "billed" | "patients";

const METRICS: { key: Metric; label: string }[] = [
  { key: "appointments", label: "Turnos" },
  { key: "billed", label: "Facturado" },
  { key: "patients", label: "Pacientes" },
];

const ROLE_LABELS: Record<string, string> = {
  client: "Pacientes",
  professional: "Profesionales",
  admin: "Administración",
};

/** "2026-08-12T..." → "12 de agosto de 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Los números del consultorio entero. Además de los turnos muestra lo que gasta el
 * asistente, que es lo único de la app que cuesta plata por uso.
 */
export default function OfficeNumbersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const office = useAsync(officeAnalytics, []);
  // Va aparte: si el asistente todavía no tiene consultas registradas, no tiene por qué
  // dejar sin números al resto de la pantalla.
  const assistant = useAsync(assistantUsage, []);

  const [metric, setMetric] = useState<Metric>("appointments");

  if (office.loading) {
    return (
      <View style={[styles.page, { backgroundColor: colors.bg, paddingTop: insets.top + space.xxl }]}>
        <SkeletonList rows={5} height={80} />
      </View>
    );
  }

  if (office.error || !office.data) {
    return (
      <View style={[styles.page, { backgroundColor: colors.bg, paddingTop: insets.top + space.xxl }]}>
        <ErrorState message={office.error ?? "No pudimos traer los números"} onRetry={office.reload} />
      </View>
    );
  }

  const { recent, total, months, headcount, channels } = office.data;
  const current = recent.find((month) => month.inProgress) ?? recent[0];
  const spend = assistant.data;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl
          refreshing={office.refreshing}
          onRefresh={() => {
            office.refresh();
            assistant.reload();
          }}
          tintColor={colors.green}
          colors={[colors.green]}
        />
      }
    >
      <AppText variant="title">Números del consultorio</AppText>

      {current ? (
        <>
          <Headline
            label={current.inProgress ? `${current.label}, hasta hoy` : current.label}
            value={money(current.billed)}
            note={
              current.scheduled > 0 ? `Más ${money(current.scheduled)} en turnos todavía sin cerrar.` : "De los turnos asistidos."
            }
          />

          <Section title="Este mes">
            <Pair
              items={[
                { label: "Turnos dados", value: String(current.appointments) },
                { label: "Personas distintas", value: String(current.patients) },
              ]}
            />

            <View style={styles.spaced}>
              <Group>
                <Row title="Profesionales atendiendo" value={String(headcount)} />
                <Row title="Asistieron" value={String(current.assisted)} />
                <Row title="No vinieron" value={String(current.missed)} />
                <Row title="Cancelados" value={String(current.cancelled)} />
                <Row title="Sobreturnos" value={String(current.overbooked)} />
                <Row
                  title="Pacientes compartidos"
                  subtitle="Se atienden con más de un profesional"
                  value={String(current.sharedPatients)}
                  last={!current.topOverbooker}
                />
                {current.topOverbooker ? (
                  <Row
                    title="Quien más sobreturnos da"
                    subtitle={current.topOverbooker.name}
                    value={String(current.topOverbooker.count)}
                    last
                  />
                ) : null}
              </Group>
            </View>
          </Section>
        </>
      ) : null}

      <Section title="Mes a mes">
        <View style={styles.filters}>
          <ChipRow options={METRICS} value={metric} onChange={setMetric} />
        </View>

        <MonthBars
          months={months}
          pick={(month) => month[metric]}
          format={(value) => (metric === "billed" ? money(value) : String(value))}
        />
      </Section>

      <Section title="Cómo se llena la agenda">
        <Group>
          <Row title="Turnos por día" value={total.averagePerDay.toFixed(1).replace(".", ",")} />
          <Row title="Día más cargado" value={total.busiestDay ?? "Sin datos"} />
          <Row title="Los pidió el paciente" value={String(total.fromApp)} />
          <Row title="Los cargó el profesional" value={String(total.fromProfessional)} last={total.imported === 0} />
          {total.imported > 0 ? <Row title="Importados de un calendario" value={String(total.imported)} last /> : null}
        </Group>
      </Section>

      <Section title="Por dónde entran">
        <Pair
          items={[
            { label: "Usan la app", value: String(channels.app) },
            { label: "Usan la página", value: String(channels.web) },
          ]}
        />

        <View style={styles.spaced}>
          <Group>
            <Row title="Solo la app" value={String(channels.onlyApp)} />
            <Row title="Solo la página" value={String(channels.onlyWeb)} />
            <Row title="Las dos" value={String(channels.both)} />
            <Row
              title="Sin registro"
              subtitle="No entraron desde que se mide"
              value={String(channels.unknown)}
              last
            />
          </Group>
        </View>

        <View style={styles.spaced}>
          <Note>
            {channels.since
              ? `Sobre ${channels.accounts} cuentas, desde el ${longDate(channels.since)}.`
              : `Todavía no entró nadie desde que se mide. Son ${channels.accounts} cuentas.`}
          </Note>
        </View>
      </Section>

      <Section title="Profesionales">
        <Group>
          {office.data.professionals.map((person, index) => (
            <Row
              key={person.email}
              title={`${person.name} ${person.surname}`}
              subtitle={person.speciality ?? "Sin especialidad"}
              last={index === office.data!.professionals.length - 1}
              onPress={() => router.push("/(app)/admin/control")}
            />
          ))}
        </Group>
      </Section>

      <Section title="El asistente">
        {assistant.error ? (
          <Note tone="warn">{assistant.error}</Note>
        ) : !spend || spend.historico.consultas === 0 ? (
          <Note>Todavía nadie le preguntó nada al asistente. Cuando lo usen, acá va a aparecer cuánto consume.</Note>
        ) : (
          <>
            <Pair
              items={[
                { label: "Consultas este mes", value: String(spend.mesEnCurso.consultas) },
                { label: "Tokens este mes", value: compactNumber(spend.mesEnCurso.tokens) },
              ]}
            />

            <View style={styles.spaced}>
              <Group>
                <Row title="Consultas en total" value={String(spend.historico.consultas)} />
                <Row title="Tokens en total" value={compactNumber(spend.historico.tokens)} />
                <Row title="Por consulta" value={compactNumber(spend.historico.tokensPorConsulta)} />
                <Row title="Personas que lo usaron" value={String(spend.personasDistintas)} last />
              </Group>
            </View>

            {spend.porRol.length > 0 ? (
              <View style={styles.spaced}>
                <Group>
                  {spend.porRol.map((entry, index) => (
                    <Row
                      key={entry.role}
                      title={ROLE_LABELS[entry.role] ?? entry.role}
                      subtitle={`${compactNumber(entry.tokens)} tokens`}
                      value={`${entry.consultas} ${entry.consultas === 1 ? "consulta" : "consultas"}`}
                      last={index === spend.porRol.length - 1}
                    />
                  ))}
                </Group>
              </View>
            ) : null}

            {spend.herramientas.length > 0 ? (
              <View style={styles.spaced}>
                <AppText variant="caption" tone="muted" style={styles.rankingTitle}>
                  QUÉ SE LE PIDE
                </AppText>
                <Ranking
                  items={spend.herramientas.slice(0, 8).map((tool) => ({ key: tool.name, label: tool.label, count: tool.count }))}
                />
              </View>
            ) : null}
          </>
        )}
      </Section>

      <AppText variant="caption" tone="muted" style={styles.footnote}>
        Lo facturado cuenta solo los turnos marcados como asistidos.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_PADDING },
  spaced: { marginTop: space.md },
  filters: { marginBottom: space.md, marginHorizontal: -SCREEN_PADDING, paddingHorizontal: SCREEN_PADDING },
  rankingTitle: { letterSpacing: 0.8, marginBottom: space.sm },
  footnote: { marginTop: space.xxl },
});
