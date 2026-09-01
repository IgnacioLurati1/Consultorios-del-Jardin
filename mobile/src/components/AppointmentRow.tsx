import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Appointment } from "../api/types";
import { counterpart, stateOf } from "../lib/appointments";
import { hhmm, relativeDay } from "../lib/dates";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { StateBadge, Tag } from "./Chip";
import { AppText } from "./Text";

/**
 * La fila de un turno. Lo primero que se lee es la hora, alineada a la izquierda en una
 * columna fija: en una agenda lo que se busca con la vista es el horario, no el nombre.
 * Recién después viene con quién.
 */
export function AppointmentRow({
  appointment,
  viewerEmail,
  onPress,
  showDay,
  last,
}: {
  appointment: Appointment;
  viewerEmail: string;
  onPress: () => void;
  /** En listas de varios días hace falta decir cuál; en la agenda de hoy, no. */
  showDay?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const state = stateOf(appointment);
  const who = counterpart(appointment, viewerEmail);

  const label = `${hhmm(appointment.initialHour)}, ${who}${showDay ? `, ${relativeDay(appointment.date)}` : ""}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <View style={styles.time}>
        <AppText variant="bodyStrong" style={styles.hour}>
          {hhmm(appointment.initialHour)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {hhmm(appointment.finalHour)}
        </AppText>
      </View>

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      <View style={styles.body}>
        <AppText variant="body" numberOfLines={1}>
          {who}
        </AppText>

        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {showDay ? `${relativeDay(appointment.date)} · ` : ""}
          {appointment.room?.description ?? "Sin consultorio"}
        </AppText>

        <View style={styles.tags}>
          <StateBadge state={state} />
          {appointment.overbooked ? <Tag label="Sobreturno" tone="warn" /> : null}
          {appointment.recurrence ? <Tag label="Se repite" tone="green" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH + 24,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  time: { width: 48, alignItems: "flex-start", gap: 1 },
  hour: { fontVariant: ["tabular-nums"] },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: space.xs, borderRadius: radius.full },
  body: { flex: 1, gap: space.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 2 },
  pressed: { opacity: 0.6 },
});
