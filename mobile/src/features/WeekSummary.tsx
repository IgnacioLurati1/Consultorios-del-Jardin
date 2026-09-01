import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { agendaWeek, type AgendaEdge, type AgendaWeekDay } from "../api/agenda";
import { ChipRow } from "../components/Chip";
import { SkeletonList } from "../components/States";
import { Card, Section } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { sentenceCase } from "../lib/dates";
import { useAsync } from "../lib/useAsync";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** Los nombres de los que empatan en esa punta del día. Si son tres, van los tres. */
function names(edge: AgendaEdge): string {
  return edge.professionals.map((person) => `${person.name} ${person.surname}`).join(", ");
}

/**
 * Cómo viene la semana.
 *
 * Es lo que se pregunta el que abre y cierra el edificio: a qué hora hay que estar, qué
 * día se llena y cuánta gente va a pasar. Va en el inicio del admin porque no es un
 * informe para leer: es la respuesta de todos los días.
 *
 * Si el pedido falla, el bloque no se dibuja. Es información de apoyo: un cartel de error
 * en medio del inicio sería peor que no mostrar nada.
 */
export function WeekSummary() {
  const [weeksAhead, setWeeksAhead] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const state = useAsync(() => agendaWeek(weeksAhead), [weeksAhead]);

  if (state.error) return null;

  return (
    <Section title={weeksAhead === 0 ? "Cómo viene la semana" : "La semana que viene"}>
      <View style={styles.chips}>
        <ChipRow
          options={[
            { key: "0", label: "Esta semana" },
            { key: "1", label: "La que viene" },
          ]}
          value={String(weeksAhead)}
          onChange={(next) => {
            setWeeksAhead(Number(next));
            setOpen(null);
          }}
        />
      </View>

      {state.loading || !state.data ? (
        <SkeletonList rows={3} height={96} />
      ) : (
        <View style={styles.days}>
          {/* El domingo solo aparece si ese día pasa algo: en general es una tarjeta vacía. */}
          {state.data.days
            .filter((day) => day.day !== "domingo" || day.appointments > 0 || day.earliest)
            .map((day) => (
              <DayCard
                key={day.date}
                day={day}
                open={open === day.date}
                onTogglePeak={() => setOpen(open === day.date ? null : day.date)}
              />
            ))}
        </View>
      )}
    </Section>
  );
}

function DayCard({ day, open, onTogglePeak }: { day: AgendaWeekDay; open: boolean; onTogglePeak: () => void }) {
  const { colors } = useTheme();
  const quiet = !day.earliest && day.appointments === 0;

  return (
    <Card style={day.isToday ? { borderColor: colors.green } : undefined}>
      <View style={styles.head}>
        <AppText variant="subtitle">
          {sentenceCase(day.day)} {Number(day.date.slice(8))}
        </AppText>
        {day.isToday ? (
          <View style={[styles.today, { backgroundColor: colors.greenSoft }]}>
            <AppText variant="caption" chrome style={{ color: colors.greenDark }}>
              HOY
            </AppText>
          </View>
        ) : null}
      </View>

      {quiet ? (
        <AppText variant="small" tone="muted" style={styles.gap}>
          Nadie atiende y no hay turnos.
        </AppText>
      ) : (
        <>
          {day.earliest && day.latest ? (
            <View style={[styles.edges, styles.gap]}>
              <View style={styles.edge}>
                <AppText variant="caption" tone="muted">
                  ABRE
                </AppText>
                <AppText variant="bodyStrong">{day.earliest.hour}</AppText>
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {names(day.earliest)}
                </AppText>
              </View>

              <View style={styles.edge}>
                <AppText variant="caption" tone="muted">
                  CIERRA
                </AppText>
                <AppText variant="bodyStrong">{day.latest.hour}</AppText>
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {names(day.latest)}
                </AppText>
              </View>
            </View>
          ) : null}

          {day.peak ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`De ${day.peak.from} a ${day.peak.to}, ${day.peak.appointments} turnos a la vez`}
                onPress={onTogglePeak}
                style={[styles.peak, styles.gap, { backgroundColor: colors.greenSoft }]}
              >
                <AppText variant="bodyStrong" style={{ color: colors.greenDark }}>
                  {day.peak.from} a {day.peak.to}
                </AppText>
                <AppText variant="caption" style={{ color: colors.greenDark }}>
                  {day.peak.appointments} {day.peak.appointments === 1 ? "turno" : "turnos"} a la vez ·{" "}
                  {open ? "tocá para cerrar" : "tocá para ver de quiénes son"}
                </AppText>
              </Pressable>

              {open ? (
                <View style={[styles.list, styles.gap]}>
                  {day.peak.items.map((item) => (
                    <View key={item.numAppointment} style={styles.item}>
                      <AppText variant="caption" tone="muted" style={styles.itemHour}>
                        {item.initialHour}
                      </AppText>
                      <View style={styles.itemText}>
                        <AppText variant="small">
                          {item.patient ? `${item.patient.name} ${item.patient.surname}` : "Sin paciente"}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          con {item.professional.name} {item.professional.surname} · {item.room}
                          {item.overbooked ? " · sobreturno" : ""}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <AppText variant="small" tone="muted" style={styles.gap}>
              Sin turnos cargados.
            </AppText>
          )}

          <View style={[styles.counts, styles.gap, { borderTopColor: colors.hairline }]}>
            <AppText variant="caption" tone="muted">
              {day.patients} {day.patients === 1 ? "paciente" : "pacientes"} · {day.professionals}{" "}
              {day.professionals === 1 ? "profesional" : "profesionales"}
            </AppText>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { marginBottom: space.md, marginHorizontal: -space.xs },
  days: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  today: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.full },
  gap: { marginTop: space.md },
  edges: { flexDirection: "row", gap: space.lg },
  edge: { flex: 1, gap: 1 },
  peak: { gap: 1, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md },
  list: { gap: space.md },
  item: { flexDirection: "row", gap: space.md },
  itemHour: { width: 44, fontVariant: ["tabular-nums"] },
  itemText: { flex: 1, gap: 1 },
  counts: { paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
