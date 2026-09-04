import { FontAwesome6 } from "@expo/vector-icons";
import { ScrollView, StyleSheet, View } from "react-native";
import type { AgendaAppointment, AgendaDay, AgendaSchedule } from "../api/agenda";
import { AppText } from "../components/Text";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { roomLook } from "../lib/roomLook";

/**
 * Dos puntos por minuto. Con menos, un turno de media hora no da para tres renglones
 * legibles, y esta pantalla se lee todos los días.
 */
const PX_PER_MINUTE = 2;

/**
 * Aire arriba y abajo. Las horas van centradas sobre su línea, así que sin este margen
 * la primera queda cortada al ras y no se puede leer a qué hora empieza el día.
 */
const PAD = 14;
const COLUMN_WIDTH = 148;
const GUTTER_WIDTH = 46;
const HEADER_HEIGHT = 46;

/**
 * Un color por profesional, estable entre las dos vistas y entre las salas.
 *
 * Es lo que deja seguir a una persona con la vista cuando atiende en dos salas el mismo
 * día, que es justamente lo que esta pantalla existe para mostrar. Sale del email y no
 * del orden en la lista: si mañana entra alguien nuevo, los demás conservan su color.
 */
const PALETTE = ["#3b7658", "#6c788e", "#b7791f", "#8c5b8f", "#2f6f8f", "#a45a44", "#5f7a3c", "#8a6d3b"];

function colorFor(email: string): string {
  let hash = 0;
  for (let index = 0; index < email.length; index++) hash = (hash * 31 + email.charCodeAt(index)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function minutes(hour: string): number {
  const [h, m] = hour.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

interface Span {
  initialHour: string;
  finalHour: string;
}

/**
 * Reparte en carriles lo que se pisa dentro de una misma sala.
 *
 * Dos módulos no deberían solaparse en la misma sala —el alta lo impide— pero dos turnos
 * sí pueden. Cuando pasa, van lado a lado en vez de uno encima del otro: un choque que
 * no se ve es un choque que no se arregla.
 */
function pack<T extends Span>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort(
    (a, b) => minutes(a.initialHour) - minutes(b.initialHour) || minutes(a.finalHour) - minutes(b.finalHour)
  );

  const lastOf: number[] = [];
  const placed = sorted.map((item) => {
    let lane = lastOf.findIndex((end) => end <= minutes(item.initialHour));
    if (lane === -1) {
      lastOf.push(minutes(item.finalHour));
      lane = lastOf.length - 1;
    } else {
      lastOf[lane] = minutes(item.finalHour);
    }
    return { item, lane };
  });

  return placed.map((entry) => ({ ...entry, lanes: lastOf.length }));
}

/** Qué clase de turno es, en una palabra. Los normales no dicen nada: son la mayoría. */
function kindOf(appointment: AgendaAppointment): string {
  if (appointment.overbooked) return "sobreturno";
  if (appointment.recurring) return "repetido";
  return "";
}

/**
 * El día completo, con una columna por consultorio.
 *
 * Es la vuelta de la grilla habitual: la de siempre pregunta qué hace un profesional en
 * la semana, y esta qué pasa en el edificio un día. Las columnas se van al costado
 * porque en un teléfono no entran de otra forma; la columna de horas se queda quieta, que
 * es lo que hace que se pueda leer a qué altura está cada bloque.
 */
/**
 * La marca de la sala al lado de su nombre: un punto de su color, o el dibujo del lugar
 * si se llama "Jardín", "Calle" o "Planta Alta". Ver roomLook.
 */
function RoomMark({ name, color, border }: { name?: string | null; color: string; border: string }) {
  const look = roomLook(name);
  if (!look) return null;

  if (look.icon) {
    const glyph = { leaf: "leaf", road: "road", stairs: "stairs" }[look.icon];
    return <FontAwesome6 name={glyph as any} size={11} color={color} />;
  }

  return <View style={[styles.dot, { backgroundColor: look.background, borderColor: border }]} />;
}

export function DayGrid({ data, mode }: { data: AgendaDay; mode: "schedules" | "appointments" }) {
  const { colors } = useTheme();

  const from = minutes(data.opening);
  const to = minutes(data.closing);
  const height = Math.max(to - from, 60) * PX_PER_MINUTE + PAD * 2;

  /** Dónde cae un minuto del día dentro de la columna. */
  const offsetOf = (value: number) => PAD + (value - from) * PX_PER_MINUTE;

  const marks: number[] = [];
  for (let mark = Math.ceil(from / 60) * 60; mark <= to; mark += 60) marks.push(mark);

  const items: (AgendaSchedule | AgendaAppointment)[] = mode === "schedules" ? data.schedules : data.appointments;

  if (data.rooms.length === 0) {
    return <AppText tone="muted">No hay consultorios activos para dibujar la grilla.</AppText>;
  }

  return (
    <View style={styles.frame}>
      {/* La columna de horas no entra al scroll horizontal: es la referencia. */}
      <View style={[styles.gutter, { width: GUTTER_WIDTH, paddingTop: HEADER_HEIGHT, borderRightColor: colors.border }]}>
        <View style={{ height }}>
          {marks.map((mark) => (
            <AppText
              key={mark}
              variant="caption"
              tone="muted"
              style={[styles.hour, { top: offsetOf(mark) - 9 }]}
            >
              {String(Math.floor(mark / 60)).padStart(2, "0")}
            </AppText>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row" }}>
            {data.rooms.map((room) => (
              <View
                key={room.idRoom}
                style={[
                  styles.head,
                  { width: COLUMN_WIDTH, height: HEADER_HEIGHT, borderColor: colors.border, backgroundColor: colors.sunken },
                ]}
              >
                {/* Un punto del color de la sala cuando se llama como uno: es como las
                    distingue el que trabaja ahí. Ver roomAccent. */}
                <View style={styles.headName}>
                  <RoomMark name={room.description} color={colors.muted} border={colors.border} />
                  <AppText variant="caption" chrome numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                    {room.description}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {room.office.description}
                </AppText>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row" }}>
            {data.rooms.map((room) => (
              <View key={room.idRoom} style={[styles.column, { width: COLUMN_WIDTH, height, borderColor: colors.border }]}>
                {marks.map((mark) => (
                  <View
                    key={mark}
                    style={[styles.line, { top: offsetOf(mark), backgroundColor: colors.hairline }]}
                  />
                ))}

                {pack(items.filter((item) => item.idRoom === room.idRoom)).map(({ item, lane, lanes }) => {
                  const color = colorFor(item.professional.email);
                  const width = COLUMN_WIDTH / lanes - 4;
                  const isAppointment = "numAppointment" in item;

                  return (
                    <View
                      key={isAppointment ? `t-${item.numAppointment}` : `h-${item.professional.email}-${item.initialHour}`}
                      style={[
                        styles.block,
                        {
                          top: offsetOf(minutes(item.initialHour)),
                          height: Math.max((minutes(item.finalHour) - minutes(item.initialHour)) * PX_PER_MINUTE, 34),
                          left: (COLUMN_WIDTH / lanes) * lane + 2,
                          width,
                          borderColor: colors.border,
                          borderLeftColor: color,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.blockTop}>
                        <AppText variant="caption" tone="muted" style={styles.blockHour}>
                          {item.initialHour}
                        </AppText>
                        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.blockMeta}>
                          {isAppointment ? kindOf(item) : `${item.duration} min`}
                        </AppText>
                      </View>

                      <AppText variant="caption" numberOfLines={1} style={{ color: colors.text, fontWeight: "700" }}>
                        {item.professional.surname}
                      </AppText>

                      {isAppointment ? (
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {item.patient ? `${item.patient.surname}, ${item.patient.name}` : "Sin paciente"}
                        </AppText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: "row" },
  gutter: { borderRightWidth: StyleSheet.hairlineWidth },
  hour: { position: "absolute", right: space.sm, fontVariant: ["tabular-nums"] },
  headName: { flexDirection: "row", alignItems: "center", gap: 6 },
  // El borde tenue evita que el blanco y el negro —que también son nombres de color— se
  // pierdan contra el fondo del tema que toque.
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  head: {
    justifyContent: "center",
    gap: 1,
    paddingHorizontal: space.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  column: { position: "relative", borderLeftWidth: StyleSheet.hairlineWidth },
  line: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  block: {
    position: "absolute",
    overflow: "hidden",
    gap: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  blockTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.xs },
  blockHour: { fontVariant: ["tabular-nums"], fontWeight: "700" },
  blockMeta: { flexShrink: 1 },
});
