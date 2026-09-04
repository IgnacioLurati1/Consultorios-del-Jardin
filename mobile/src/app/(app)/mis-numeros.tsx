import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { myAnalytics, type Denials } from "../../api/analytics";
import { ChipRow } from "../../components/Chip";
import { Screen } from "../../components/Screen";
import { ErrorState, SkeletonList } from "../../components/States";
import { Group, Note, Row, Section } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { Headline, MonthBars, Pair } from "../../features/Numbers";
import { money } from "../../lib/dates";
import { useAsync } from "../../lib/useAsync";
import { space } from "../../theme/tokens";

type Metric = "appointments" | "billed" | "patients";

const METRICS: { key: Metric; label: string }[] = [
  { key: "appointments", label: "Turnos" },
  { key: "billed", label: "Cobrado" },
  { key: "patients", label: "Pacientes" },
];

/**
 * Los números del profesional. Arranca por lo que se pregunta primero (cuánto se
 * facturó este mes) y recién después abre el detalle: los meses anteriores, la carga de
 * la agenda y de dónde salen los turnos.
 */
/**
 * Cómo se reparten los pedidos rechazados entre los dos motivos. La fila muestra el
 * total, así que acá van las dos mitades: con solo los vencidos, los rechazados a mano
 * había que sacarlos restando.
 */
function splitOf({ denied, expired }: Denials): string {
  if (denied === 0) return "Ninguno";
  if (expired === 0) return "Todos rechazados a mano";
  if (expired === denied) return "Todos vencidos sin respuesta";
  return `${denied - expired} a mano · ${expired} vencidos sin respuesta`;
}
export default function MyNumbersScreen() {
  const state = useAsync(myAnalytics, []);
  const [metric, setMetric] = useState<Metric>("appointments");

  if (state.loading) {
    return (
      <Screen>
        <View style={styles.skeleton}>
          <SkeletonList rows={5} height={80} />
        </View>
      </Screen>
    );
  }

  if (state.error || !state.data) {
    return (
      <Screen>
        <ErrorState message={state.error ?? "No pudimos traer tus números"} onRetry={state.reload} />
      </Screen>
    );
  }

  const { recent, total, months, debt } = state.data;
  const current = recent.find((month) => month.inProgress) ?? recent[0];
  const previous = recent.find((month) => month !== current);

  return (
    <Screen onRefresh={state.refresh} refreshing={state.refreshing}>
      {current ? (
        <>
          <Headline
            label={current.inProgress ? `${current.label}, hasta hoy` : current.label}
            value={money(current.billed)}
            note={
              current.scheduled > 0
                ? `Faltan ${money(current.scheduled)} por cobrar de turnos ya agendados.`
                : "Pagos completos y parciales, se hayan atendido o no."
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
                <Row title="Asistieron" value={String(current.assisted)} />
                <Row title="No vinieron" value={String(current.missed)} />
                <Row title="Cancelados" value={String(current.cancelled)} />
                <Row title="Sobreturnos" value={String(current.overbooked)} />
                <Row
                  title="Pedidos rechazados"
                  subtitle={splitOf(current.denials)}
                  value={String(current.denials.denied)}
                  last={!current.debt}
                />
                {/* Lo que quedó sin cobrar del mes. En rojo solo cuando hay algo que
                    cobrar: un cero en rojo asusta sin motivo. */}
                {current.debt ? (
                  <Row
                    title="Te quedaron debiendo"
                    subtitle={
                      current.debt.appointments === 0
                        ? "Cobraste todo lo que atendiste"
                        : `${current.debt.appointments} ${current.debt.appointments === 1 ? "turno" : "turnos"} · ${
                            current.debt.people
                          } ${current.debt.people === 1 ? "persona" : "personas"}`
                    }
                    value={money(current.debt.amount)}
                    destructive={current.debt.amount > 0}
                    last
                  />
                ) : null}
              </Group>
            </View>
          </Section>
        </>
      ) : null}

      {previous ? (
        <Section title={`Contra ${previous.label.toLowerCase()}`}>
          <Group>
            <Row title="Turnos" value={`${previous.appointments} → ${current?.appointments ?? 0}`} />
            <Row title="Cobrado" value={`${money(previous.billed)} → ${money(current?.billed ?? 0)}`} last />
          </Group>
        </Section>
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

      {/* Quien te debe es plata tuya con tus pacientes, igual que lo facturado: el
          backend directamente no manda esto cuando el que mira es un administrador. */}
      {debt ? (
        <Section title="Lo que falta cobrar">
          <Group>
            <Row
              title="Te quedaron debiendo"
              value={debt.people === 1 ? "1 persona" : `${debt.people} personas`}
            />
            <Row
              title="En turnos"
              value={debt.appointments === 1 ? "1 turno" : `${debt.appointments} turnos`}
            />
            <Row title="Por un total de" value={money(debt.amount)} last />
          </Group>

          {debt.people > 0 ? (
            <View style={styles.spaced}>
              <Note>Se registra desde la ficha de cada turno, en Cobro. Los pagos parciales cuentan por lo que falta.</Note>
            </View>
          ) : null}
        </Section>
      ) : null}

      <Section title="Tu agenda">
        <Group>
          <Row title="Turnos por día" value={total.averagePerDay.toFixed(1).replace(".", ",")} />
          <Row title="Tu día más cargado" value={total.busiestDay ?? "Sin datos"} />
          <Row
            title="Ese día, en promedio"
            value={total.busiestDayAverage ? total.busiestDayAverage.toFixed(1).replace(".", ",") : "0"}
            last
          />
        </Group>
      </Section>

      <Section title="De dónde salen los turnos">
        <Group>
          <Row title="Los pidió el paciente" value={String(total.fromApp)} />
          <Row title="Los cargaste vos" value={String(total.fromProfessional)} last />
        </Group>

        <View style={styles.spaced}>
          <Note>
            Son {total.months} {total.months === 1 ? "mes" : "meses"} de historia. La comparación mes a mes recién sirve
            con unos cuantos meses cargados.
          </Note>
        </View>
      </Section>

      <AppText variant="caption" tone="muted" style={styles.footnote}>
        Lo facturado cuenta solo los turnos marcados como asistidos: si no cerrás un turno, no suma.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: { marginTop: space.xl },
  spaced: { marginTop: space.md },
  filters: { marginBottom: space.md, marginHorizontal: -space.xl, paddingHorizontal: space.xl },
  footnote: { marginTop: space.xxl },
});
