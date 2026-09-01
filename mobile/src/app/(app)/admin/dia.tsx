import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { agendaDay } from "../../../api/agenda";
import { ChipRow } from "../../../components/Chip";
import { Screen } from "../../../components/Screen";
import { ErrorState, SkeletonList } from "../../../components/States";
import { AppText } from "../../../components/Text";
import { DayGrid } from "../../../features/DayGrid";
import { addDays, mondayOf, sentenceCase, toISODate } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { SCREEN_PADDING, space } from "../../../theme/tokens";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Los días de la semana, de lunes a sábado. El domingo no se ofrece: el consultorio no
 * atiende y sería un chip que nunca tiene nada.
 */
function weekDays(weeksAhead: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = addDays(mondayOf(today), weeksAhead * 7);

  return Array.from({ length: 6 }, (_, offset) => {
    const date = addDays(monday, offset);
    return {
      key: toISODate(date),
      label: `${DAY_NAMES[date.getDay()].slice(0, 3)} ${date.getDate()}`,
      isToday: date.getTime() === today.getTime(),
    };
  });
}

/**
 * Un día del consultorio, con una columna por sala.
 *
 * Es la agenda del edificio y no la de nadie en particular: quién atiende dónde, y con
 * el botón de arriba, los turnos que hay cargados. Solo la ve el admin, que es el único
 * que tiene que poder mirar la agenda de todo el equipo junta.
 */
export default function DayScreen() {
  const [weeksAhead, setWeeksAhead] = useState(0);
  const days = weekDays(weeksAhead);

  const [date, setDate] = useState(() => {
    const current = weekDays(0);
    return (current.find((day) => day.isToday) ?? current[0]).key;
  });

  const [shows, setShows] = useState<"schedules" | "appointments">("schedules");

  const state = useAsync(() => agendaDay(date), [date]);

  function pickWeek(next: string) {
    const ahead = Number(next);
    const upcoming = weekDays(ahead);
    setWeeksAhead(ahead);
    setDate((upcoming.find((day) => day.isToday) ?? upcoming[0]).key);
  }

  return (
    <Screen refreshing={state.refreshing} onRefresh={state.refresh} flush>
      <View style={styles.controls}>
        <ChipRow
          options={[
            { key: "0", label: "Esta semana" },
            { key: "1", label: "La que viene" },
          ]}
          value={String(weeksAhead)}
          onChange={pickWeek}
        />
      </View>

      <View style={styles.controls}>
        <ChipRow options={days.map(({ key, label }) => ({ key, label }))} value={date} onChange={setDate} />
      </View>

      <View style={styles.controls}>
        <ChipRow
          options={[
            { key: "schedules", label: "Horarios" },
            { key: "appointments", label: "Turnos" },
          ]}
          value={shows}
          onChange={setShows}
        />
      </View>

      {state.loading ? (
        <View style={styles.pad}>
          <SkeletonList rows={4} height={72} />
        </View>
      ) : state.error ? (
        <View style={styles.pad}>
          <ErrorState message={state.error} onRetry={state.reload} />
        </View>
      ) : state.data ? (
        <>
          <View style={styles.pad}>
            <AppText variant="displaySmall">{sentenceCase(state.data.day)}</AppText>
          </View>

          <View style={styles.grid}>
            <DayGrid data={state.data} mode={shows} />
          </View>

          <View style={styles.pad}>
            <AppText variant="caption" tone="muted">
              {shows === "schedules"
                ? state.data.schedules.length === 0
                  ? "Nadie atiende este día."
                  : `${state.data.schedules.length} módulos de atención.`
                : state.data.appointments.length === 0
                  ? "Sin turnos este día."
                  : `${state.data.appointments.length} turnos${state.data.cancelled > 0 ? ` · ${state.data.cancelled} cancelados no se dibujan` : ""}.`}
            </AppText>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: SCREEN_PADDING, marginTop: space.md },
  pad: { paddingHorizontal: SCREEN_PADDING, marginTop: space.lg },
  grid: { marginTop: space.lg, paddingLeft: space.sm },
});
