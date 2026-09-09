import { FontAwesome6 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myPatientAppointments, myProfessionalAppointments, professionalRange } from "../../../api/appointments";
import { errorMessage } from "../../../api/client";
import { acceptPending, getSettings } from "../../../api/settings";
import { Appointment } from "../../../api/types";
import { AppointmentRow } from "../../../components/AppointmentRow";
import { Button } from "../../../components/Button";
import { ChipRow } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { Sheet } from "../../../components/Sheet";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Note, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { delDia, isUpcoming, stateOf } from "../../../lib/appointments";
import { addDays, longDate, onDay, relativeDay, sentenceCase, toISODate, today } from "../../../lib/dates";
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
  const feedback = useFeedback();

  const [day, setDay] = useState(() => today());
  const [onlyPending, setOnlyPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const agenda = useAsync(() => professionalRange(day, day, true), [day]);
  const pending = useAsync(() => myProfessionalAppointments(0), []);

  /*
   * Cuántos pedidos sin responder hay de verdad.
   *
   * La lista de abajo trae una página de quince turnos, así que lo que se ve no siempre
   * es todo. Y "Confirmar todos" no confirma lo que se ve: confirma todo lo que esté
   * esperando. El número del cartel tiene que ser ese, o estaría pidiendo permiso para
   * una cosa y haciendo otra.
   */
  const settings = useAsync(() => getSettings(), []);
  const waiting = settings.data?.pending ?? 0;

  useFocusEffect(
    useCallback(() => {
      agenda.reload();
      pending.reload();
      settings.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [day])
  );

  function confirmAll() {
    setBusy(true);
    acceptPending()
      .then((accepted) => {
        feedback.done(
          accepted === 0
            ? "No tenías pedidos esperando"
            : accepted === 1
              ? "Confirmaste un turno"
              : `Confirmaste ${accepted} turnos`
        );
        setConfirming(false);
        pending.reload();
        agenda.reload();
        settings.reload();
      })
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  const toConfirm = (pending.data ?? []).filter(
    (appointment) => stateOf(appointment) === "pending" && isUpcoming(appointment)
  );

  const list: Appointment[] = onlyPending
    ? toConfirm
    : delDia(agenda.data ?? []);

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
              title={`No atendés a nadie ${onDay(day)}`}
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

      {/* Una acción por vista. Mirando los pedidos que esperan, cargar un turno nuevo no
          es lo que nadie vino a hacer. */}
      {onlyPending ? (
        toConfirm.length > 0 ? (
          <Section>
            <Button label="Confirmar todos" icon="circle-check" block onPress={() => setConfirming(true)} />
          </Section>
        ) : null
      ) : list.length > 0 ? (
        <Section>
          <Button label="Cargar un turno" icon="plus" variant="secondary" block onPress={() => router.push("/(app)/nuevo-turno")} />
        </Section>
      ) : null}

      {/*
        Preguntar antes de confirmar todo.
        ----------------------------------
        Aceptar de a uno no lo pregunta y acá sí, porque no es lo mismo: esto le dice que
        sí a gente que quizás no pensabas atender, y para volver atrás hay que abrir turno
        por turno y rechazarlos a mano.
      */}
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title="¿Confirmar todos?">
        <View style={{ gap: space.lg, paddingBottom: space.md }}>
          <AppText variant="body">
            {waiting === 1
              ? "Vas a aceptar el pedido que tenés esperando."
              : `Vas a aceptar los ${waiting} pedidos que tenés esperando.`}
          </AppText>

          {waiting > toConfirm.length ? (
            <Note>
              Son todos los que quedaron sin responder, también los de días que ya pasaron. Acá abajo se ven{" "}
              {toConfirm.length}.
            </Note>
          ) : null}

          <Note tone="warn">Al confirmar de esta forma no se enviarán mails a los pacientes.</Note>

          <Button
            label="Sí, confirmar todos"
            icon="circle-check"
            block
            loading={busy}
            disabled={busy}
            onPress={confirmAll}
          />
          <Button label="Volver" variant="ghost" block onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
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
        <AppText variant="subtitle" numberOfLines={1}>
          {sentenceCase(relativeDay(day))}
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
  pressed: { opacity: 0.6 },
});
