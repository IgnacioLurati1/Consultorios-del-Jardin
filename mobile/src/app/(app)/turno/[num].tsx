import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  acceptAppointment,
  cancelAppointment,
  findAppointment,
  updatePayment,
  updateRecord,
} from "../../../api/appointments";
import { errorMessage } from "../../../api/client";
import { waitlistMatches } from "../../../api/waitlist";
import { createRecurrence, FREQUENCY_LABELS, stopRecurrence } from "../../../api/misc";
import { PaymentState, RecurrenceFrequency } from "../../../api/types";
import { Button } from "../../../components/Button";
import { StateBadge, Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { OptionSheet } from "../../../components/Sheet";
import { ErrorState, Loading } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { cancellationNotice, describePayment, fullName, isUpcoming, pendingAmount, stateOf } from "../../../lib/appointments";
import { hourRange, longDate, money, numericDate, sentenceCase, momentOfDay } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { space } from "../../../theme/tokens";
import { ObservationsSheet } from "../../../features/ObservationsSheet";
import { RepeatSheet } from "../../../features/RepeatSheet";
import { PaymentSheet } from "../../../features/PaymentSheet";

/**
 * Un turno, con lo que cada uno puede hacerle. El paciente lo mira y lo cancela; el
 * profesional además lo acepta, lo cierra y decide si se repite; el admin solo mira,
 * porque el turno no es suyo.
 */
export default function AppointmentScreen() {
  const { num } = useLocalSearchParams<{ num: string }>();
  const number = Number(num);
  const { email, role } = useUser();
  const feedback = useFeedback();

  const state = useAsync(() => findAppointment(number), [number]);
  const [busy, setBusy] = useState(false);
  const [observationsOpen, setObservationsOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const appointment = state.data;

  if (state.loading) return <Loading label="Buscando el turno" />;

  if (state.error || !appointment) {
    return (
      <Screen>
        <ErrorState message={state.error ?? "No se encontró el turno"} onRetry={state.reload} />
      </Screen>
    );
  }

  const key = stateOf(appointment);
  const mine = appointment.professional.email === email;
  const isProfessional = role === "professional" && mine;
  const upcoming = isUpcoming(appointment);
  // Solo tiene valor cuando la baja la hizo el paciente. La del profesional no se guarda.
  const notice = cancellationNotice(appointment);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);

    try {
      await action();
      feedback.done(message);
      state.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  // Los turnos anteriores a que existiera el registro de cobro no dicen nada: null.
  const payment = describePayment(appointment);
  const owed = pendingAmount(appointment);

  async function confirmCancel() {
    const asPatient = appointment!.patient?.email === email;

    const cancel = (notifyWaitlist?: boolean) =>
      run(async () => {
        await cancelAppointment(number, notifyWaitlist);
        router.back();
      }, "Turno cancelado");

    // Cuánta gente de la lista de espera busca este horario. Solo del lado de quien
    // atiende: cuando baja el paciente el aviso sale solo. Si no se puede preguntar es
    // cero, y la baja es la de siempre: la lista de espera no puede frenar una cancelación.
    const waiting = isProfessional ? await waitlistMatches(number).catch(() => 0) : 0;

    // Con gente esperando hay algo que decidir, igual que en la página: si se cancela
    // porque ese día no se va a estar, avisarles es mandarlos a una puerta cerrada.
    if (waiting > 0) {
      Alert.alert(
        "Cancelar el turno",
        `${
          waiting === 1
            ? "Una persona en la lista de espera busca este horario. ¿Avisarle?"
            : `${waiting} personas en la lista de espera buscan este horario. ¿Avisarles?`
        }`,
        [
          { text: "Volver", style: "cancel" },
          { text: "Cancelar sin avisar", style: "destructive", onPress: () => cancel(false) },
          { text: "Cancelar y avisar", style: "destructive", onPress: () => cancel(true) },
        ]
      );
      return;
    }

    Alert.alert(
      "Cancelar el turno",
      asPatient
        ? "El profesional recibe el aviso por mail."
        : "El paciente recibe el aviso por mail.",
      [
        { text: "Dejarlo como está", style: "cancel" },
        { text: "Cancelar el turno", style: "destructive", onPress: () => cancel() },
      ]
    );
  }

  return (
    <>
      <Screen bottomSpace={space.lg}>
        <View style={styles.head}>
          <AppText variant="display">
            {sentenceCase(longDate(appointment.date))}
          </AppText>

          <AppText variant="title" tone="green">
            {hourRange(appointment.initialHour, appointment.finalHour)}
          </AppText>

          <View style={styles.tags}>
            <StateBadge state={key} />
            {appointment.overbooked ? <Tag label="Turno especial" tone="warn" /> : null}
            {/* La marca es para el profesional, que es quien decide qué hacer con una baja
                sobre la hora. Al paciente no se le pone un cartel encima de algo que ya
                hizo: la fecha de su baja la ve igual, unas filas más abajo. */}
            {isProfessional && notice?.short ? <Tag label="Baja con poco aviso" tone="danger" /> : null}
            {appointment.recurrence?.active ? <Tag label="Se repite" tone="green" /> : null}
            {/* Solo del lado del profesional: el cobro es asunto suyo con el paciente, y
                el paciente ya sabe si pagó o no. */}
            {isProfessional && payment ? <Tag label={payment.label} tone={payment.tone} /> : null}
          </View>
        </View>

        <Section title="El turno">
          <Group>
            <Row title="Profesional" value={fullName(appointment.professional)} />
            <Row title="Especialidad" value={appointment.professional.speciality || "Sin cargar"} />
            <Row title="Paciente" value={appointment.patient ? fullName(appointment.patient) : "Sin asignar"} />
            <Row title="Consultorio" value={appointment.room?.description ?? "Sin asignar"} />
            <Row title="Fecha" value={numericDate(appointment.date)} last={!isProfessional} />
            {isProfessional ? <Row title="Valor" value={money(appointment.value)} last={appointment.origin !== "import"} /> : null}
            {/* De dónde salió el turno se dice solo cuando explica algo. En uno importado
                explica por qué no tiene paciente y por qué puede no tener valor. */}
            {isProfessional && appointment.origin === "import" ? (
              <Row title="Origen" value="Importado de un calendario" last />
            ) : null}
          </Group>
        </Section>

        {notice ? (
          <Section title="La baja">
            <Group>
              <Row
                title={isProfessional ? "Lo dio de baja el paciente" : "Baja registrada"}
                value={momentOfDay(notice.at)}
                subtitle={
                  notice.short
                    ? notice.hours < 0
                      ? "Llegó después de la hora del turno."
                      : "Con menos de 24 horas de aviso, ese horario ya no se le puede ofrecer a nadie."
                    : undefined
                }
                subtitleIsData
                last
              />
            </Group>
          </Section>
        ) : null}

        {isProfessional ? (
          <Section title="Registro de la consulta">
            <Group>
              <Row
                title={appointment.observations ? "Observaciones" : "Sin observaciones"}
                subtitle={appointment.observations ?? "Lo que se anota acá lo lee también el paciente."}
                subtitleIsData={Boolean(appointment.observations)}
                icon="pen"
                last
                onPress={() => setObservationsOpen(true)}
              />
            </Group>
          </Section>
        ) : appointment.observations ? (
          // Lo que anotó el profesional es lo que la persona se lleva de la consulta: un
          // plan, indicaciones, qué mirar hasta la próxima. Escondérselo lo vuelve inútil
          // justo para quien lo necesita.
          <Section title="Seguimiento">
            <Group>
              <View style={styles.followup}>
                <AppText variant="body">{appointment.observations}</AppText>
                <AppText variant="caption" tone="muted">
                  Lo escribió {fullName(appointment.professional)} después de la consulta.
                </AppText>
              </View>
            </Group>
          </Section>
        ) : null}

        {/* Va después del registro de la consulta y antes de la repetición, con el mismo
            orden que en la web. Es una decisión aparte de cómo terminó el turno: se toma
            en otro momento, cuando la persona paga. */}
        {isProfessional && key !== "cancelled" ? (
          <Section title="Cobro">
            <Group>
              <Row
                title={payment ? payment.label : "Sin registrar"}
                subtitle={
                  payment
                    ? owed > 0
                      ? `Queda debiendo ${money(owed)} de ${money(appointment.value)}`
                      : "No queda nada por cobrar"
                    : "Turno anterior al registro de cobros. Falta indicar cómo quedó."
                }
                subtitleIsData={Boolean(payment)}
                icon="money-bill-wave"
                last
                onPress={() => setPaymentOpen(true)}
              />
            </Group>
          </Section>
        ) : null}

        {/* Vale `active` y no que la repetición exista: al frenarla, el turno le sigue
            apuntando (queda como registro de lo que pasó) y con solo mirar el objeto la
            ficha seguía diciendo que se repite. */}
        {appointment.recurrence?.active ? (
          <Section title="Se repite">
            <Group>
              <Row
                title={FREQUENCY_LABELS[appointment.recurrence.frequency]}
                subtitle={
                  appointment.recurrence.endDate
                    ? `Hasta el ${numericDate(appointment.recurrence.endDate)}`
                    : "Sin fecha de corte"
                }
                subtitleIsData
                icon="repeat"
                last
              />
            </Group>

            {isProfessional ? (
              <View style={styles.spaced}>
                <Button
                  label="Dejar de repetirlo"
                  variant="secondary"
                  block
                  onPress={() =>
                    run(async () => {
                      await stopRecurrence(appointment.recurrence!.idRecurrence);
                    }, "No se va a generar más")
                  }
                />
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Acciones">
          <View style={styles.actions}>
            {isProfessional && key === "pending" ? (
              <Button
                label="Aceptar el turno"
                icon="check"
                block
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await acceptAppointment(number);
                  }, "Turno confirmado. El paciente recibe el aviso.")
                }
              />
            ) : null}

            {isProfessional && key === "accepted" && !upcoming ? (
              <Button label="Cerrar el turno" icon="clipboard-check" block onPress={() => setCloseOpen(true)} />
            ) : null}

            {isProfessional && !appointment.recurrence?.active && key !== "cancelled" ? (
              <Button label="Hacer que se repita" icon="repeat" variant="secondary" block onPress={() => setRepeatOpen(true)} />
            ) : null}

            {isProfessional && appointment.patient ? (
              <Button
                label="Ver la ficha del paciente"
                icon="user-injured"
                variant="secondary"
                block
                onPress={() => router.push(`/(app)/paciente/${encodeURIComponent(appointment.patient!.email)}`)}
              />
            ) : null}

            {key !== "cancelled" && key !== "assisted" && key !== "missed" && role !== "admin" ? (
              <Button label="Cancelar el turno" icon="xmark" variant="danger" block onPress={confirmCancel} />
            ) : null}
          </View>

          {key === "cancelled" ? (
            <Note tone="danger">Este turno está cancelado. Si hace falta, hay que pedir uno nuevo.</Note>
          ) : key === "pending" && !isProfessional ? (
            <Note>Pendiente de confirmación del profesional. El aviso llega por mail.</Note>
          ) : null}
        </Section>
      </Screen>

      <ObservationsSheet
        visible={observationsOpen}
        onClose={() => setObservationsOpen(false)}
        initial={appointment.observations ?? ""}
        onSave={(text) =>
          run(async () => {
            await updateRecord(number, { observations: text });
          }, "Observaciones guardadas")
        }
      />

      <RepeatSheet
        visible={repeatOpen}
        onClose={() => setRepeatOpen(false)}
        onSave={(frequency: RecurrenceFrequency, endDate: string | null) =>
          run(async () => {
            const result = await createRecurrence(number, frequency, endDate);
            feedback.done(`${result.created} turnos creados`);
          }, "Repetición activada")
        }
      />

      <PaymentSheet
        visible={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        value={appointment.value ?? 0}
        initialState={appointment.paymentState ?? null}
        initialAmount={appointment.paidAmount ?? null}
        onSave={(paymentState: PaymentState, paidAmount: number | null) =>
          run(async () => {
            await updatePayment(number, paymentState, paidAmount);
          }, paymentState === "paid" ? "Turno cobrado" : paymentState === "partial" ? "Pago parcial registrado" : "Queda sin cobrar")
        }
      />

      <OptionSheet
        visible={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="¿Cómo terminó el turno?"
        options={[
          { key: "assisted", label: "Asistió", description: "La persona vino y se la atendió." },
          { key: "missed", label: "No vino", description: "El turno se perdió." },
        ]}
        onSelect={(choice) =>
          run(async () => {
            await updateRecord(number, { state: choice });
          }, choice === "assisted" ? "Asistencia registrada" : "Inasistencia registrada")
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, paddingTop: space.lg },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  actions: { gap: space.md },
  spaced: { marginTop: space.md },
  followup: { padding: space.lg, gap: space.sm },
});
