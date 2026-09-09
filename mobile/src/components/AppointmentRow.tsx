import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Appointment } from "../api/types";
import { cancellationNotice, counterpart, stateAccent, stateInk, stateOf } from "../lib/appointments";
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

  /*
   * El turno que el paciente dio de baja sobre la hora.
   *
   * Es el único cancelado que se pinta. Los demás quedan apagados, que es lo que son: un
   * horario que se liberó con tiempo y que probablemente ya tomó otro. Este dejó el hueco
   * y no hubo tiempo de ofrecérselo a nadie, así que la fila entera se tiñe en vez de
   * confiarle todo el trabajo a un cartel al final del renglón.
   */
  const late = state === "cancelled" && !!cancellationNotice(appointment)?.short;
  const cancelled = state === "cancelled";
  const ink = late ? colors.danger : stateInk(state, colors);

  const label = `${hhmm(appointment.initialHour)}, ${who}${showDay ? `, ${relativeDay(appointment.date)}` : ""}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.row,
        late && { backgroundColor: colors.dangerSoft },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <View style={styles.time}>
        {/* La hora lleva el color del estado. Es el dato que la vista busca primero, así
            que es donde más rinde el color. Tachada cuando el turno ya no va a pasar. */}
        <AppText variant="bodyStrong" style={[styles.hour, { color: ink }, cancelled && styles.tachado]}>
          {hhmm(appointment.initialHour)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {hhmm(appointment.finalHour)}
        </AppText>
      </View>

      {/* La línea que separa la hora del resto lleva el color del estado. Es el mismo
          trazo que ya estaba, pintado: la agenda del día se recorre con la vista y recién
          se lee la que interesa. Ver stateAccent. */}
      <View style={[styles.rule, { backgroundColor: late ? colors.danger : stateAccent(state, colors) }]} />

      <View style={styles.body}>
        <AppText variant="body" numberOfLines={1} style={cancelled && styles.tachado}>
          {who}
        </AppText>

        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {showDay ? `${relativeDay(appointment.date)} · ` : ""}
          {appointment.room?.description ?? "Sin consultorio"}
        </AppText>

        <View style={styles.tags}>
          {/* Sobre la fila teñida el cartel rojo se pinta del mismo rosa que el fondo y la
              pastilla desaparece, así que ahí lleva el fondo de la tarjeta. */}
          {late ? (
            <Tag label="Dio de baja sobre la hora" tone="danger" onSurface />
          ) : (
            <StateBadge state={state} />
          )}
          {appointment.overbooked ? <Tag label="Sobreturno" tone="warn" /> : null}
          {/* `active`, no la existencia: una repetición frenada le sigue colgando al turno. */}
          {appointment.recurrence?.active ? <Tag label="Se repite" tone="green" /> : null}
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
  tachado: { textDecorationLine: "line-through" },
  rule: { width: 3, alignSelf: "stretch", marginVertical: space.xs, borderRadius: radius.full },
  body: { flex: 1, gap: space.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 2 },
  pressed: { opacity: 0.6 },
});
