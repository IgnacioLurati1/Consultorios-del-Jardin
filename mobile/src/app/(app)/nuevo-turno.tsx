import { router } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { createProfessionalAppointment } from "../../api/appointments";
import { errorMessage } from "../../api/client";
import { createRecurrence, FREQUENCY_LABELS } from "../../api/misc";
import { RecurrenceFrequency } from "../../api/types";
import { findActiveRooms, schedulesOf } from "../../api/catalog";
import { findActiveByType } from "../../api/people";
import { Button } from "../../components/Button";
import { Choice } from "../../components/Choice";
import { Field, PickerField } from "../../components/Field";
import { useFeedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { OptionSheet } from "../../components/Sheet";
import { Loading } from "../../components/States";
import { Note } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { DateField, TimeField } from "../../features/DateField";
import { RepeatSheet } from "../../features/RepeatSheet";
import { fullName } from "../../lib/appointments";
import { hhmm, numericDate, today } from "../../lib/dates";
import { DAYS } from "../../lib/specialities";
import { useAsync } from "../../lib/useAsync";
import { useUser } from "../../session/SessionProvider";
import { radius, space, TOUCH } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

/** Un horario que el profesional puede dar ese día, ya calculado a partir de su módulo. */
interface ModuleSlot {
  initialHour: string;
  finalHour: string;
  roomId: string;
  roomName: string;
}

/**
 * Cargar un turno desde el lado del profesional.
 *
 * Son dos casos distintos y por eso son dos formularios. El turno normal tiene que caer
 * justo en un módulo de atención, así que en vez de pedirle la hora a mano se le
 * muestran los horarios que su agenda permite ese día: elegir uno resuelve hora,
 * duración y consultorio de una vez. El sobreturno existe justamente para saltarse esa
 * regla, así que ahí se elige todo a mano.
 */
export default function NewAppointmentScreen() {
  const { email } = useUser();
  const { colors } = useTheme();
  const feedback = useFeedback();

  const [overbooked, setOverbooked] = useState(false);
  const [date, setDate] = useState<string>(today());
  const [slot, setSlot] = useState<ModuleSlot | null>(null);
  const [initialHour, setInitialHour] = useState<string | null>(null);
  const [finalHour, setFinalHour] = useState<string | null>(null);
  const [room, setRoom] = useState<string>("");
  const [value, setValue] = useState("");
  const [patient, setPatient] = useState<string>("");

  const [roomSheet, setRoomSheet] = useState(false);
  const [patientSheet, setPatientSheet] = useState(false);

  // Que el turno nazca repetible, sin tener que abrirlo después para marcarlo. Se elige
  // con el mismo panel que se usa desde la ficha del turno.
  const [repeatSheet, setRepeatSheet] = useState(false);
  const [repeat, setRepeat] = useState<{ frequency: RecurrenceFrequency; endDate: string | null } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const setup = useAsync(
    async () => ({
      schedules: await schedulesOf(email),
      rooms: await findActiveRooms(),
      patients: await findActiveByType("client"),
    }),
    [email]
  );

  /** Los horarios que caen dentro de los módulos de ese día, uno por turno posible. */
  const slots = useMemo<ModuleSlot[]>(() => {
    if (!setup.data) return [];

    const weekday = DAYS[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
    const list: ModuleSlot[] = [];

    for (const schedule of setup.data.schedules) {
      if (schedule.day !== weekday) continue;

      const start = minutes(schedule.initialHour);
      const end = minutes(schedule.finalHour);

      for (let at = start; at + schedule.duration <= end; at += schedule.duration) {
        list.push({
          initialHour: clock(at),
          finalHour: clock(at + schedule.duration),
          roomId: String(schedule.room.idRoom),
          roomName: schedule.room.description,
        });
      }
    }

    return list.sort((a, b) => a.initialHour.localeCompare(b.initialHour));
  }, [setup.data, date]);

  if (setup.loading) return <Loading label="Cargando tu agenda" />;

  const rooms = setup.data?.rooms ?? [];
  const patients = setup.data?.patients ?? [];
  const chosenRoom = rooms.find((item) => String(item.idRoom) === room);
  const chosenPatient = patients.find((item) => item.email === patient);

  async function save() {
    if (busy) return;

    const hours = overbooked ? { initialHour, finalHour, roomId: room } : slot;

    const found: Record<string, string | null> = {
      date: date ? null : "Elegí el día",
      slot: overbooked ? null : slot ? null : "Elegí un horario de tu agenda",
      initialHour: overbooked && !initialHour ? "Elegí a qué hora empieza" : null,
      finalHour: overbooked
        ? !finalHour
          ? "Elegí a qué hora termina"
          : initialHour && finalHour <= initialHour
            ? "Tiene que terminar después de empezar"
            : null
        : null,
      room: overbooked && !room ? "Elegí el consultorio" : null,
      value: value.trim() === "" || Number.isFinite(Number(value)) ? null : "El valor tiene que ser un número",
    };

    setErrors(found);
    if (Object.values(found).some(Boolean) || !hours) return;

    setBusy(true);

    try {
      const created = await createProfessionalAppointment({
        date,
        initialHour: overbooked ? initialHour! : slot!.initialHour,
        finalHour: overbooked ? finalHour! : slot!.finalHour,
        room: overbooked ? room : slot!.roomId,
        value: Number(value || 0),
        patientEmail: patient || undefined,
        overbooked,
      });

      if (repeat && created?.numAppointment) {
        // La repetición se pide aparte, con el mismo endpoint que usa la ficha del turno.
        // Si falla, el turno ya está creado y sigue siendo uno común: hay que decirlo.
        try {
          await createRecurrence(created.numAppointment, repeat.frequency, repeat.endDate);
          feedback.done("Turno cargado, y se va a repetir");
        } catch (problem) {
          feedback.done(`Turno cargado, pero no se pudo repetir: ${errorMessage(problem)}`);
        }
      } else {
        feedback.done(patient ? "Turno cargado. Le avisamos al paciente." : "Turno cargado");
      }

      router.back();
    } catch (problem) {
      setErrors({ date: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={styles.form}>
          <Choice
            label="Qué estás cargando"
            options={[
              { key: "normal", label: "Un turno", description: "Dentro de tus horarios de atención." },
              { key: "over", label: "Un sobreturno", description: "Fuera de tus módulos: elegís hora y consultorio." },
            ]}
            value={overbooked ? "over" : "normal"}
            onChange={(key) => {
              setOverbooked(key === "over");
              setSlot(null);
            }}
          />

          <DateField
            label="Día"
            value={date}
            onChange={(picked) => {
              setDate(picked);
              setSlot(null);
            }}
            minimumDate={new Date()}
            error={errors.date}
            required
          />

          {!overbooked ? (
            <View style={styles.slotBlock}>
              <AppText variant="caption" tone="muted" chrome>
                Horario *
              </AppText>

              {slots.length === 0 ? (
                <Note tone="warn">
                  Ese día no tenés módulos de atención cargados. Podés cargarlo como sobreturno, o agregar el horario
                  desde la pantalla de horarios.
                </Note>
              ) : (
                <View style={styles.slots}>
                  {slots.map((option) => {
                    const active = slot?.initialHour === option.initialHour && slot?.roomId === option.roomId;

                    return (
                      <Pressable
                        key={`${option.initialHour}-${option.roomId}`}
                        onPress={() => setSlot(option)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${option.initialHour} en ${option.roomName}`}
                        android_ripple={{ color: colors.border }}
                        style={({ pressed }) => [
                          styles.slot,
                          {
                            backgroundColor: active ? colors.green : colors.surface,
                            borderColor: active ? colors.green : colors.border,
                          },
                          pressed && Platform.OS === "ios" && styles.pressed,
                        ]}
                      >
                        <AppText variant="bodyStrong" chrome style={{ color: active ? colors.onGreen : colors.text }}>
                          {option.initialHour}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {errors.slot ? (
                <AppText variant="caption" tone="danger">
                  {errors.slot}
                </AppText>
              ) : slot ? (
                <AppText variant="caption" tone="muted">
                  Hasta las {slot.finalHour}, en {slot.roomName}.
                </AppText>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.times}>
                <View style={styles.time}>
                  <TimeField label="Empieza" value={initialHour} onChange={setInitialHour} error={errors.initialHour} required />
                </View>
                <View style={styles.time}>
                  <TimeField label="Termina" value={finalHour} onChange={setFinalHour} error={errors.finalHour} required />
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
            </>
          )}

          <PickerField
            label="Paciente"
            value={chosenPatient ? fullName(chosenPatient) : null}
            placeholder="Sin asignar todavía"
            onPress={() => setPatientSheet(true)}
            hint="Podés dejarlo vacío y asignarlo después."
          />

          <Field
            label="Valor"
            value={value}
            onChangeText={setValue}
            placeholder="0"
            keyboardType="number-pad"
            hint="Lo que vale la sesión. Se usa para tus números."
            error={errors.value}
          />

          <Note>Este dato es privado entre el paciente y vos.</Note>

          <PickerField
            label="Que se repita"
            value={
              repeat
                ? `${FREQUENCY_LABELS[repeat.frequency]}${repeat.endDate ? `, hasta el ${numericDate(repeat.endDate)}` : ", sin corte"}`
                : null
            }
            placeholder="No se repite"
            onPress={() => setRepeatSheet(true)}
            hint={repeat ? "Tocá para cambiarlo." : "Podés hacer que se agende solo cada semana."}
          />

          <Button label="Cargar el turno" onPress={save} loading={busy} block />
        </View>
      </Screen>

      <OptionSheet
        visible={roomSheet}
        onClose={() => setRoomSheet(false)}
        title="Consultorio"
        options={rooms.map((item) => ({ key: String(item.idRoom), label: item.description, description: item.office?.description }))}
        selected={room}
        onSelect={setRoom}
        emptyLabel="No hay consultorios habilitados."
      />

      <RepeatSheet
        visible={repeatSheet}
        onClose={() => setRepeatSheet(false)}
        onSave={(frequency, endDate) => setRepeat({ frequency, endDate })}
        saveLabel="Listo"
      />

      <OptionSheet
        visible={patientSheet}
        onClose={() => setPatientSheet(false)}
        title="Paciente"
        options={[
          { key: "", label: "Sin asignar", description: "Se lo cargás después." },
          ...patients.map((item) => ({ key: item.email, label: fullName(item), description: item.anonymous ? "Sin cuenta" : item.email })),
        ]}
        selected={patient}
        onSelect={setPatient}
      />
    </KeyboardAvoidingView>
  );
}

function minutes(hour: string): number {
  const [h, m] = hhmm(hour).split(":").map(Number);
  return h * 60 + m;
}

function clock(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  form: { marginTop: space.xl, gap: space.lg },
  slotBlock: { gap: space.sm },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  slot: {
    minWidth: 76,
    minHeight: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
  pressed: { opacity: 0.7 },
});
