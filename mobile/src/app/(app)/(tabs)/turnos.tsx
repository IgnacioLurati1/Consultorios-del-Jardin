import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myPatientAppointments, myProfessionalAppointments, professionalRange } from "../../../api/appointments";
import { Appointment } from "../../../api/types";
import { AppointmentRow } from "../../../components/AppointmentRow";
import { Button } from "../../../components/Button";
import { ChipRow } from "../../../components/Chip";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { isUpcoming, stateOf } from "../../../lib/appointments";
import { addDays, longDate, relativeDay, toISODate, today } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { radius, SCREEN_PADDING, space, TOUCH } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

export default function AppointmentsTab() {
  const { role } = useUser();
  return role === "professional" ? <ProfessionalAgenda /> : <PatientAppointments />;
}

/* ============================================================
   Paciente: mis turnos
   ============================================================ */

type PatientFilter = "upcoming" | "past" | "cancelled";

const PATIENT_FILTERS: { key: PatientFilter; label: string }[] = [
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Ya pasaron" },
  { key: "cancelled", label: "Cancelados" },
];

function PatientAppointments() {
  const { email } = useUser();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<PatientFilter>("upcoming");

  // Los cancelados no vienen por defecto: se piden solo cuando se los quiere ver.
  const state = useAsync(() => myPatientAppointments(0, filter === "cancelled"), [filter === "cancelled"]);

  useFocusEffect(
    useCallback(() => {
      state.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter === "cancelled"])
  );

  const list = useMemo(() => {
    const all = state.data ?? [];

    if (filter === "cancelled") return all.filter((appointment) => stateOf(appointment) === "cancelled");
    if (filter === "upcoming") return all.filter((appointment) => isUpcoming(appointment));

    return all.filter((appointment) => stateOf(appointment) !== "cancelled" && !isUpcoming(appointment));
  }, [state.data, filter]);

  const empty = {
    upcoming: {
      title: "No tenés turnos pedidos",
      description: "Cuando pidas uno, va a aparecer acá con el día, la hora y el consultorio.",
    },
    past: { title: "Todavía no fuiste a ningún turno", description: "Acá van a quedar los turnos a los que ya asististe." },
    cancelled: { title: "No cancelaste ningún turno", description: undefined },
  }[filter];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      <AppText variant="display">Tus turnos</AppText>

      <View style={styles.filters}>
        <ChipRow options={PATIENT_FILTERS} value={filter} onChange={setFilter} />
      </View>

      <DataState
        loading={state.loading}
        error={state.error}
        empty={list.length === 0}
        onRetry={state.reload}
        skeleton={<SkeletonList rows={4} height={92} />}
        emptyState={
          <EmptyState
            icon={filter === "upcoming" ? "calendar-plus" : "calendar-check"}
            title={empty.title}
            description={empty.description}
            action={
              filter === "upcoming"
                ? { label: "Pedir un turno", onPress: () => router.push("/(app)/(tabs)/pedir-turno") }
                : undefined
            }
          />
        }
      >
        <Group>
          {list.map((appointment, index) => (
            <AppointmentRow
              key={appointment.numAppointment}
              appointment={appointment}
              viewerEmail={email}
              showDay
              last={index === list.length - 1}
              onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
            />
          ))}
        </Group>
      </DataState>

      {filter === "upcoming" && list.length > 0 ? (
        <Section>
          <Button
            label="Pedir otro turno"
            icon="calendar-plus"
            variant="secondary"
            block
            onPress={() => router.push("/(app)/(tabs)/pedir-turno")}
          />
        </Section>
      ) : null}
    </ScrollView>
  );
}

/* ============================================================
   Profesional: la agenda de un día
   ============================================================ */

function ProfessionalAgenda() {
  const { email } = useUser();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [day, setDay] = useState(() => today());
  const [onlyPending, setOnlyPending] = useState(false);

  const agenda = useAsync(() => professionalRange(day, day, true), [day]);
  const pending = useAsync(() => myProfessionalAppointments(0), []);

  useFocusEffect(
    useCallback(() => {
      agenda.reload();
      pending.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [day])
  );

  const toConfirm = (pending.data ?? []).filter(
    (appointment) => stateOf(appointment) === "pending" && isUpcoming(appointment)
  );

  const list: Appointment[] = onlyPending
    ? toConfirm
    : (agenda.data ?? []).filter((appointment) => stateOf(appointment) !== "cancelled");

  function shiftDay(days: number) {
    setDay((current) => toISODate(addDays(new Date(`${current}T00:00:00`), days)));
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}
      refreshControl={
        <RefreshControl refreshing={agenda.refreshing} onRefresh={agenda.refresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      <AppText variant="display">Agenda</AppText>

      <View style={styles.filters}>
        <ChipRow
          options={[
            { key: "day", label: "Un día" },
            { key: "pending", label: toConfirm.length > 0 ? `Sin confirmar (${toConfirm.length})` : "Sin confirmar" },
          ]}
          value={onlyPending ? "pending" : "day"}
          onChange={(key) => setOnlyPending(key === "pending")}
        />
      </View>

      {!onlyPending ? (
        <DayPicker day={day} onShift={shiftDay} onToday={() => setDay(today())} />
      ) : null}

      <DataState
        loading={onlyPending ? pending.loading : agenda.loading}
        error={onlyPending ? pending.error : agenda.error}
        empty={list.length === 0}
        onRetry={onlyPending ? pending.reload : agenda.reload}
        skeleton={<SkeletonList rows={4} height={92} />}
        emptyState={
          onlyPending ? (
            <EmptyState icon="circle-check" title="No tenés turnos esperando" description="Todos los turnos pedidos ya están aceptados o rechazados." />
          ) : (
            <EmptyState
              icon="mug-hot"
              title={`No atendés a nadie el ${relativeDay(day)}`}
              description="No hay turnos cargados para ese día."
              action={{ label: "Cargar un turno", onPress: () => router.push("/(app)/nuevo-turno") }}
            />
          )
        }
      >
        <Group>
          {list.map((appointment, index) => (
            <AppointmentRow
              key={appointment.numAppointment}
              appointment={appointment}
              viewerEmail={email}
              showDay={onlyPending}
              last={index === list.length - 1}
              onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
            />
          ))}
        </Group>
      </DataState>

      <Section>
        <Button label="Cargar un turno" icon="plus" variant="secondary" block onPress={() => router.push("/(app)/nuevo-turno")} />
      </Section>
    </ScrollView>
  );
}

/**
 * Moverse de día. Las flechas son grandes porque es lo que más se toca de esta pantalla,
 * y el día se escribe entero para no tener que descifrar una fecha corta.
 */
function DayPicker({ day, onShift, onToday }: { day: string; onShift: (days: number) => void; onToday: () => void }) {
  const { colors } = useTheme();
  const isToday = day === today();

  return (
    <View style={[styles.dayPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Arrow icon="chevron-left" label="El día anterior" onPress={() => onShift(-1)} />

      <Pressable
        onPress={onToday}
        disabled={isToday}
        accessibilityRole="button"
        accessibilityLabel={isToday ? longDate(day) : `${longDate(day)}. Tocá para volver a hoy`}
        style={styles.dayLabel}
      >
        <AppText variant="subtitle" numberOfLines={1} style={styles.dayText}>
          {relativeDay(day)}
        </AppText>
        {!isToday ? (
          <AppText variant="caption" tone="green">
            Volver a hoy
          </AppText>
        ) : null}
      </Pressable>

      <Arrow icon="chevron-right" label="El día siguiente" onPress={() => onShift(1)} />
    </View>
  );
}

function Arrow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome6>["name"];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: colors.border, borderless: true }}
      style={({ pressed }) => [styles.arrow, pressed && Platform.OS === "ios" && styles.pressed]}
    >
      <FontAwesome6 name={icon} size={16} color={colors.green} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_PADDING },
  filters: { marginTop: space.md, marginHorizontal: -SCREEN_PADDING, paddingHorizontal: SCREEN_PADDING },
  dayPicker: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.md,
    marginBottom: space.lg,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  arrow: { width: TOUCH + 8, height: TOUCH + 4, alignItems: "center", justifyContent: "center" },
  dayLabel: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space.sm, gap: 1 },
  dayText: { textTransform: "capitalize" },
  pressed: { opacity: 0.6 },
});
