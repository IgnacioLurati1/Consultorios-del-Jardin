import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { availableSlots, bookAppointment } from "../../../api/appointments";
import { findActiveOffices } from "../../../api/catalog";
import { findPerson } from "../../../api/people";
import { Slot } from "../../../api/types";
import { Button } from "../../../components/Button";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { Sheet } from "../../../components/Sheet";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Note, Row } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { errorMessage } from "../../../api/client";
import { addDays, hhmm, hourRange, longDate, relativeDay, toISODate } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { radius, space, TOUCH } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/** Hasta dónde se puede pedir: los próximos 14 días. Más allá, la agenda todavía se mueve. */
const DAYS_AHEAD = 14;

/**
 * Los horarios libres de un profesional, agrupados por día. En un teléfono la grilla
 * semanal de la web no entra sin achicar los números hasta que dejan de poder tocarse,
 * así que cada día es una fila de horarios que se tocan.
 */
export default function SlotsScreen() {
  const { email: raw } = useLocalSearchParams<{ email: string }>();
  const professionalEmail = decodeURIComponent(raw ?? "");
  const navigation = useNavigation();
  const feedback = useFeedback();
  const { colors } = useTheme();

  const [chosen, setChosen] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);

  const state = useAsync(async () => {
    const [professional, offices] = await Promise.all([findPerson(professionalEmail), findActiveOffices()]);
    const office = offices[0];
    if (!office) return { professional, office: null, slots: [] as Slot[] };

    return { professional, office, slots: await availableSlots(professionalEmail, String(office.idOffice)) };
  }, [professionalEmail]);

  const professional = state.data?.professional;

  useLayoutEffect(() => {
    if (professional) navigation.setOptions({ title: `${professional.name} ${professional.surname}` });
  }, [navigation, professional]);

  /** Los horarios que quedan, agrupados por día y recortados a lo que se puede pedir. */
  const days = useMemo(() => {
    const limit = toISODate(addDays(new Date(), DAYS_AHEAD));
    const byDay = new Map<string, Slot[]>();

    for (const slot of state.data?.slots ?? []) {
      const day = String(slot.date).slice(0, 10);
      if (day > limit) continue;
      if (taken.includes(`${day} ${slot.initialHour}`)) continue;

      byDay.set(day, [...(byDay.get(day) ?? []), slot]);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, slots]) => ({ day, slots: slots.sort((a, b) => a.initialHour.localeCompare(b.initialHour)) }));
  }, [state.data, taken]);

  async function confirm() {
    if (!chosen || !state.data?.office || booking) return;

    setBooking(true);

    try {
      await bookAppointment({
        date: String(chosen.date).slice(0, 10),
        initialHour: chosen.initialHour,
        professionalEmail,
        officeId: String(state.data.office.idOffice),
      });

      // El horario que se acaba de pedir ya no está libre: se saca sin volver a pedir
      // toda la agenda.
      setTaken((current) => [...current, `${String(chosen.date).slice(0, 10)} ${chosen.initialHour}`]);
      setChosen(null);

      feedback.done("Pedimos tu turno. Te avisamos por mail cuando lo confirmen.");
      router.replace("/(app)/(tabs)/turnos");
    } catch (problem) {
      feedback.problem(errorMessage(problem, "No pudimos pedir el turno"));
    } finally {
      setBooking(false);
    }
  }

  return (
    <>
      <Screen>
        {professional ? (
          <AppText variant="small" tone="muted" style={styles.lead}>
            {professional.speciality || "Sin especialidad cargada"}
            {state.data?.office ? ` · ${state.data.office.description}` : ""}
          </AppText>
        ) : null}

        <DataState
          loading={state.loading}
          error={state.error}
          empty={days.length === 0}
          onRetry={state.reload}
          skeleton={<View style={styles.skeleton}><SkeletonList rows={3} height={110} /></View>}
          emptyState={
            <EmptyState
              icon="calendar-xmark"
              title="No hay horarios libres"
              description="Este profesional no tiene lugar en los próximos días. Probá con otro o escribinos."
              action={{ label: "Ver otros profesionales", onPress: () => router.back() }}
            />
          }
        >
          <View style={styles.days}>
            {days.map(({ day, slots }) => (
              <View key={day}>
                <AppText variant="subtitle" style={styles.dayTitle}>
                  {relativeDay(day)}
                </AppText>

                <View style={styles.slots}>
                  {slots.map((slot) => (
                    <Pressable
                      key={`${day}-${slot.initialHour}`}
                      onPress={() => setChosen(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`${hhmm(slot.initialHour)} del ${longDate(day)}`}
                      android_ripple={{ color: colors.border }}
                      style={({ pressed }) => [
                        styles.slot,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        pressed && Platform.OS === "ios" && styles.pressed,
                      ]}
                    >
                      <AppText variant="bodyStrong" chrome style={styles.slotText}>
                        {hhmm(slot.initialHour)}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <Note>
              El turno queda pedido y el profesional lo confirma. Te llega un mail cuando lo acepta, y otro el día
              anterior para recordártelo.
            </Note>
          </View>
        </DataState>
      </Screen>

      <Sheet visible={!!chosen} onClose={() => setChosen(null)} title="¿Pedimos este turno?">
        {chosen ? (
          <View style={styles.confirm}>
            <Group>
              <Row title="Profesional" value={professional ? `${professional.name} ${professional.surname}` : ""} />
              <Row title="Día" value={longDate(chosen.date)} />
              <Row title="Horario" value={hourRange(chosen.initialHour, chosen.finalHour)} />
              <Row title="Dónde" value={state.data?.office?.description ?? ""} last />
            </Group>

            <Button label="Pedir el turno" onPress={confirm} loading={booking} block />
          </View>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: space.lg },
  skeleton: { marginTop: space.lg },
  days: { marginTop: space.xl, gap: space.xl },
  dayTitle: { textTransform: "capitalize", marginBottom: space.md },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  slot: {
    minWidth: 78,
    minHeight: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  slotText: { fontVariant: ["tabular-nums"] },
  confirm: { gap: space.xl, paddingBottom: space.md },
  pressed: { opacity: 0.6 },
});
