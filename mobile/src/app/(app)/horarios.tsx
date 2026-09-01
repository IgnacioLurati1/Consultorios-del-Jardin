import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import {
  createSchedule,
  findActiveRooms,
  removeSchedule,
  schedulesOf,
  updateScheduleDuration,
} from "../../api/catalog";
import { findActiveByType } from "../../api/people";
import { Person, Schedule } from "../../api/types";
import { Button } from "../../components/Button";
import { Choice } from "../../components/Choice";
import { PickerField } from "../../components/Field";
import { useFeedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { OptionSheet, Sheet } from "../../components/Sheet";
import { DataState, EmptyState } from "../../components/States";
import { Group, Note, Row, Section } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { TimeField } from "../../features/DateField";
import { fullName } from "../../lib/appointments";
import { hhmm } from "../../lib/dates";
import { DAY_LABELS, DAYS } from "../../lib/specialities";
import { useAsync } from "../../lib/useAsync";
import { useUser } from "../../session/SessionProvider";
import { space } from "../../theme/tokens";

/** Lo único editable de un módulo: cuánto dura cada turno adentro. */
const DURATIONS = [30, 45, 60];

/**
 * Los horarios de atención: en qué franja de qué día atiende cada uno, en qué
 * consultorio y cada cuántos minutos entra un turno. De acá salen los horarios que el
 * paciente ve libres.
 *
 * El profesional edita los suyos. El admin elige a quién mirar, porque los horarios son
 * lo que arma la ocupación del consultorio.
 */
export default function SchedulesScreen() {
  const { email, role } = useUser();
  const feedback = useFeedback();

  const [target, setTarget] = useState<string>(role === "admin" ? "" : email);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const people = useAsync(() => (role === "admin" ? findActiveByType("professional") : Promise.resolve([] as Person[])), [role]);
  const schedules = useAsync(() => (target ? schedulesOf(target) : Promise.resolve([] as Schedule[])), [target]);

  const chosen = (people.data ?? []).find((person) => person.email === target);
  const byDay = DAYS.map((day) => ({
    day,
    modules: (schedules.data ?? [])
      .filter((schedule) => schedule.day === day)
      .sort((a, b) => a.initialHour.localeCompare(b.initialHour)),
  })).filter((entry) => entry.modules.length > 0);

  async function changeDuration(schedule: Schedule, duration: number) {
    try {
      await updateScheduleDuration(schedule.day, schedule.initialHour, target, duration);
      feedback.done(`Los turnos de ese módulo pasan a durar ${duration} minutos`);
      schedules.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    }
  }

  function confirmRemove(schedule: Schedule) {
    Alert.alert(
      "Sacar este módulo",
      `Los ${DAY_LABELS[schedule.day].toLowerCase()} de ${hhmm(schedule.initialHour)} a ${hhmm(schedule.finalHour)} dejan de ofrecerse. Los turnos que ya estén dados no se tocan.`,
      [
        { text: "Dejarlo", style: "cancel" },
        {
          text: "Sacarlo",
          style: "destructive",
          onPress: async () => {
            try {
              await removeSchedule(target, schedule.day, schedule.initialHour);
              feedback.done("Módulo dado de baja");
              schedules.reload();
            } catch (problem) {
              feedback.problem(errorMessage(problem));
            }
          },
        },
      ]
    );
  }

  return (
    <>
      <Screen onRefresh={schedules.refresh} refreshing={schedules.refreshing}>
        {role === "admin" ? (
          <View style={styles.top}>
            <PickerField
              label="Profesional"
              value={chosen ? fullName(chosen) : null}
              placeholder="Elegir un profesional"
              onPress={() => setPickerOpen(true)}
            />
          </View>
        ) : null}

        {!target ? (
          <EmptyState icon="user-doctor" title="Elegí un profesional" description="Vas a ver sus módulos de atención, día por día." />
        ) : (
          <DataState
            loading={schedules.loading}
            error={schedules.error}
            empty={byDay.length === 0}
            onRetry={schedules.reload}
            emptyState={
              <EmptyState
                icon="calendar-days"
                title="Todavía no hay horarios"
                description="Sin módulos cargados no se puede pedir ningún turno."
                action={role !== "admin" ? { label: "Agregar un horario", onPress: () => setFormOpen(true) } : undefined}
              />
            }
          >
            {byDay.map(({ day, modules }) => (
              <Section key={day} title={DAY_LABELS[day]}>
                <Group>
                  {modules.map((schedule, index) => (
                    <Row
                      key={`${day}-${schedule.initialHour}`}
                      title={`${hhmm(schedule.initialHour)} a ${hhmm(schedule.finalHour)}`}
                      subtitle={`${schedule.room?.description ?? "Sin consultorio"} · turnos de ${schedule.duration} min`}
                      last={index === modules.length - 1}
                      onPress={
                        role === "admin"
                          ? undefined
                          : () =>
                              Alert.alert(`${DAY_LABELS[day]} de ${hhmm(schedule.initialHour)} a ${hhmm(schedule.finalHour)}`, "¿Qué querés hacer?", [
                                ...DURATIONS.filter((duration) => duration !== schedule.duration).map((duration) => ({
                                  text: `Turnos de ${duration} min`,
                                  onPress: () => changeDuration(schedule, duration),
                                })),
                                { text: "Sacar el módulo", style: "destructive" as const, onPress: () => confirmRemove(schedule) },
                                { text: "Cancelar", style: "cancel" as const },
                              ])
                      }
                    />
                  ))}
                </Group>
              </Section>
            ))}

            {role !== "admin" ? (
              <Section>
                <Note>Tocá un módulo para cambiar cuánto dura cada turno o para sacarlo.</Note>
              </Section>
            ) : null}
          </DataState>
        )}

        {role !== "admin" ? (
          <Section>
            <Button label="Agregar un horario" icon="plus" block onPress={() => setFormOpen(true)} />
          </Section>
        ) : null}
      </Screen>

      <OptionSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Profesional"
        options={(people.data ?? []).map((person) => ({
          key: person.email,
          label: fullName(person),
          description: person.speciality || "Sin especialidad",
        }))}
        selected={target}
        onSelect={setTarget}
        emptyLabel="No hay profesionales habilitados."
      />

      <Sheet visible={formOpen} onClose={() => setFormOpen(false)} title="Nuevo horario">
        {formOpen ? (
          <ScheduleForm
            email={target}
            done={() => {
              setFormOpen(false);
              schedules.reload();
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function ScheduleForm({ email, done }: { email: string; done: () => void }) {
  const feedback = useFeedback();

  const [day, setDay] = useState<string>("lunes");
  const [initialHour, setInitialHour] = useState<string | null>(null);
  const [finalHour, setFinalHour] = useState<string | null>(null);
  const [duration, setDuration] = useState(45);
  const [room, setRoom] = useState("");
  const [roomSheet, setRoomSheet] = useState(false);
  const [daySheet, setDaySheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const rooms = useAsync(findActiveRooms, []);
  const chosenRoom = (rooms.data ?? []).find((item) => String(item.idRoom) === room);

  async function save() {
    if (busy) return;

    const found = {
      initialHour: initialHour ? null : "Elegí a qué hora arranca",
      finalHour: !finalHour
        ? "Elegí a qué hora termina"
        : initialHour && finalHour <= initialHour
          ? "Tiene que terminar después de arrancar"
          : null,
      room: room ? null : "Elegí el consultorio",
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);

    try {
      await createSchedule({ day, initialHour: initialHour!, finalHour: finalHour!, room, personEmail: email, duration });
      feedback.done("Horario agregado");
      done();
    } catch (problem) {
      setErrors({ initialHour: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <PickerField label="Día" value={DAY_LABELS[day]} placeholder="Elegir un día" onPress={() => setDaySheet(true)} required />

      <View style={styles.times}>
        <View style={styles.time}>
          <TimeField label="Desde" value={initialHour} onChange={setInitialHour} error={errors.initialHour} required />
        </View>
        <View style={styles.time}>
          <TimeField label="Hasta" value={finalHour} onChange={setFinalHour} error={errors.finalHour} required />
        </View>
      </View>

      <PickerField
        label="Consultorio"
        value={chosenRoom?.description}
        placeholder="Elegir un consultorio"
        onPress={() => setRoomSheet(true)}
        error={errors.room}
        required
      />

      <Choice
        label="Cuánto dura cada turno"
        options={DURATIONS.map((minutes) => ({ key: String(minutes), label: `${minutes} minutos` }))}
        value={String(duration)}
        onChange={(key) => setDuration(Number(key))}
      />

      <AppText variant="caption" tone="muted">
        La franja se parte en turnos de esa duración. Lo que sobre al final no se ofrece.
      </AppText>

      <Button label="Agregar" onPress={save} loading={busy} block />

      <OptionSheet
        visible={daySheet}
        onClose={() => setDaySheet(false)}
        title="Día"
        options={DAYS.map((item) => ({ key: item, label: DAY_LABELS[item] }))}
        selected={day}
        onSelect={setDay}
      />

      <OptionSheet
        visible={roomSheet}
        onClose={() => setRoomSheet(false)}
        title="Consultorio"
        options={(rooms.data ?? []).map((item) => ({
          key: String(item.idRoom),
          label: item.description,
          description: item.office?.description,
        }))}
        selected={room}
        onSelect={setRoom}
        emptyLabel="No hay consultorios habilitados."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: space.lg, marginBottom: space.md },
  form: { gap: space.lg, paddingBottom: space.md },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
});
