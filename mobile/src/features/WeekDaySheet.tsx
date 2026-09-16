import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  agendaDay,
  type AgendaAppointment,
  type AgendaPerson,
  type AgendaWeekDay,
} from "../api/agenda";
import { StateBadge } from "../components/Chip";
import { Sheet } from "../components/Sheet";
import { SkeletonList } from "../components/States";
import { Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import type { StateKey } from "../lib/appointments";
import { longDate, sentenceCase } from "../lib/dates";
import { useAsync } from "../lib/useAsync";
import { space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

const hhmm = (hour: string) => hour.slice(0, 5);

const fullName = (person: AgendaPerson) => `${person.name} ${person.surname}`;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Qué clase de turno es, en una palabra. Los normales no dicen nada: son la mayoría. */
function kindOf(appointment: AgendaAppointment): string {
  if (appointment.overbooked) return "turno especial";
  if (appointment.imported) return "importado";
  if (appointment.recurring) return "repetido";
  return "";
}

interface Attending {
  person: AgendaPerson;
  modules: { room: string; from: string; to: string }[];
  appointments: number;
}

/**
 * Un día de la semana entero, al tocar su tarjeta.
 *
 * La tarjeta resume y corta los nombres a dos líneas. Acá entra todo: quién abre y quién
 * cierra sin cortar, quién atiende en qué sala y a qué hora, y cada turno con su paciente
 * y su estado. Es lo mismo que la ventana del día de la página.
 */
export function WeekDaySheet({
  day,
  onClose,
}: {
  day: AgendaWeekDay | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={!!day}
      onClose={onClose}
      title={day ? sentenceCase(longDate(day.date)) : ""}
    >
      {day ? <DayDetail day={day} /> : null}
    </Sheet>
  );
}

/** Va aparte para que el pedido del día corra solo con la hoja abierta. */
function DayDetail({ day }: { day: AgendaWeekDay }) {
  const { colors } = useTheme();
  const state = useAsync(() => agendaDay(day.date), [day.date]);
  const data = state.data;

  const roomName = useMemo(() => {
    const names = new Map<number, string>();
    const offices = new Set(data?.rooms.map((room) => room.office.idOffice));

    // La sede va solo si hay más de una: con una sola, repetirla en cada renglón es ruido.
    for (const room of data?.rooms ?? [])
      names.set(
        room.idRoom,
        offices.size > 1
          ? `${room.description} · ${room.office.description}`
          : room.description,
      );

    return (idRoom: number) => names.get(idRoom) ?? "Sin sala";
  }, [data]);

  // Quién atiende: los módulos de cada uno, y también quien solo tiene turnos sueltos.
  const attending = useMemo(() => {
    const byEmail = new Map<string, Attending>();
    const entry = (person: AgendaPerson) => {
      const found = byEmail.get(person.email) ?? {
        person,
        modules: [],
        appointments: 0,
      };
      byEmail.set(person.email, found);
      return found;
    };

    for (const schedule of data?.schedules ?? [])
      entry(schedule.professional).modules.push({
        room: roomName(schedule.idRoom),
        from: hhmm(schedule.initialHour),
        to: hhmm(schedule.finalHour),
      });

    for (const appointment of data?.appointments ?? [])
      entry(appointment.professional).appointments++;

    return [...byEmail.values()]
      .map((item) => ({
        ...item,
        modules: item.modules.sort((a, b) => a.from.localeCompare(b.from)),
      }))
      .sort(
        (a, b) =>
          (a.modules[0]?.from ?? "99").localeCompare(
            b.modules[0]?.from ?? "99",
          ) || fullName(a.person).localeCompare(fullName(b.person)),
      );
  }, [data, roomName]);

  const appointments = useMemo(
    () =>
      [...(data?.appointments ?? [])].sort(
        (a, b) =>
          a.initialHour.localeCompare(b.initialHour) ||
          roomName(a.idRoom).localeCompare(roomName(b.idRoom)),
      ),
    [data, roomName],
  );

  const counts = [
    plural(day.appointments, "turno", "turnos"),
    plural(day.patients, "paciente", "pacientes"),
    plural(day.professionals, "profesional", "profesionales"),
  ];
  if (data && data.cancelled > 0)
    counts.push(plural(data.cancelled, "cancelado", "cancelados"));

  const divider = { borderTopColor: colors.hairline };

  return (
    <View style={styles.body}>
      <AppText variant="small" tone="muted">
        {day.isToday ? "Hoy · " : ""}
        {counts.join(" · ")}
      </AppText>

      {day.earliest || day.peak ? (
        <View style={styles.summary}>
          {day.earliest ? (
            <Fact
              label="ABRE"
              value={day.earliest.hour}
              detail={day.earliest.professionals.map(fullName).join(", ")}
            />
          ) : null}
          {day.latest ? (
            <Fact
              label="CIERRA"
              value={day.latest.hour}
              detail={day.latest.professionals.map(fullName).join(", ")}
            />
          ) : null}
          {day.peak ? (
            <Fact
              label="MÁS CARGADO"
              value={`${day.peak.from} a ${day.peak.to}`}
              detail={plural(
                day.peak.appointments,
                "turno a la vez",
                "turnos a la vez",
              )}
            />
          ) : null}
        </View>
      ) : null}

      {state.error ? (
        <Note tone="danger">{state.error}</Note>
      ) : !data ? (
        <SkeletonList rows={3} height={56} />
      ) : (
        <>
          <View style={[styles.section, divider]}>
            <AppText variant="caption" tone="muted" chrome>
              QUIÉN ATIENDE
            </AppText>
            {attending.length === 0 ? (
              <AppText variant="small" tone="muted">
                Nadie atiende este día.
              </AppText>
            ) : (
              attending.map(({ person, modules, appointments: count }) => (
                <View key={person.email} style={styles.item}>
                  <AppText variant="bodyStrong">{fullName(person)}</AppText>
                  <AppText variant="caption" tone="muted">
                    {[person.speciality, plural(count, "turno", "turnos")]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                  {modules.length === 0 ? (
                    <AppText variant="small" tone="muted">
                      Sin horario fijo este día
                    </AppText>
                  ) : (
                    modules.map((module) => (
                      <AppText
                        key={`${module.room}-${module.from}`}
                        variant="small"
                        style={styles.tabular}
                      >
                        {module.from} a {module.to}
                        <AppText variant="small" tone="muted">
                          {` · ${module.room}`}
                        </AppText>
                      </AppText>
                    ))
                  )}
                </View>
              ))
            )}
          </View>

          <View style={[styles.section, divider]}>
            <AppText variant="caption" tone="muted" chrome>
              TURNOS
            </AppText>
            {appointments.length === 0 ? (
              <AppText variant="small" tone="muted">
                Sin turnos cargados.
              </AppText>
            ) : (
              appointments.map((appointment) => {
                const kind = kindOf(appointment);
                return (
                  <View
                    key={appointment.numAppointment}
                    style={styles.appointment}
                  >
                    <View style={styles.hour}>
                      <AppText variant="bodyStrong" style={styles.tabular}>
                        {hhmm(appointment.initialHour)}
                      </AppText>
                      <AppText
                        variant="caption"
                        tone="muted"
                        style={styles.tabular}
                      >
                        {hhmm(appointment.finalHour)}
                      </AppText>
                    </View>
                    <View style={styles.people}>
                      <AppText variant="bodyStrong">
                        {appointment.patient
                          ? fullName(appointment.patient)
                          : "Sin paciente"}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {`con ${fullName(appointment.professional)} · ${roomName(appointment.idRoom)}${kind ? ` · ${kind}` : ""}`}
                      </AppText>
                      <View style={styles.badge}>
                        <StateBadge state={appointment.state as StateKey} />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" tone="muted" chrome>
        {label}
      </AppText>
      <AppText variant="subtitle" style={styles.tabular}>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: space.md,
    columnGap: space.lg,
  },
  fact: { flexBasis: "40%", flexGrow: 1, gap: 1 },
  section: {
    gap: space.md,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { gap: 2 },
  appointment: { flexDirection: "row", gap: space.md },
  hour: { width: 48 },
  people: { flex: 1, gap: 1 },
  badge: { flexDirection: "row", marginTop: space.xs },
  tabular: { fontVariant: ["tabular-nums"] },
});
