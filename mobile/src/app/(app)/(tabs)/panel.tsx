import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myProfessionalAppointments, professionalRange, unpaidAppointments } from "../../../api/appointments";
import { officeAnalytics } from "../../../api/analytics";
import { errorMessage } from "../../../api/client";
import { settleUnpaid } from "../../../api/settings";
import { Appointment } from "../../../api/types";
import { myWaitlist, WaitingPatient } from "../../../api/waitlist";
import { AppointmentRow } from "../../../components/AppointmentRow";
import { Button } from "../../../components/Button";
import { Tag } from "../../../components/Chip";
import { useFeedback } from "../../../components/Feedback";
import { BandHeadline, DayBand } from "../../../components/DayBand";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { AnnouncementBanner } from "../../../features/Announcements";
import { OfficeSettings } from "../../../features/OfficeSettings";
import { WaitlistPeopleSheet } from "../../../features/WaitlistPeopleSheet";
import { WeekSummary } from "../../../features/WeekSummary";
import { delDia, describePayment, fullName, isUpcoming, pendingAmount, stateOf } from "../../../lib/appointments";
import { money, numericDate, today } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { SCREEN_PADDING, space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/**
 * Panel: lo de todos los días del profesional y del admin. Es la misma pantalla para los
 * dos porque la pregunta es la misma ("¿qué tengo hoy?"), pero la respuesta cambia
 * bastante, así que cada rol tiene su cuerpo. El paciente no la tiene: su Inicio ya es
 * todo lo que necesita.
 */
export default function PanelScreen() {
  const { role } = useUser();

  // De mantener los avisos al día se ocupa el layout de la sesión, que está arriba de
  // todas las pantallas: acá miraba solo al abrir la pantalla, y entonces el número no se
  // movía mientras uno estaba en cualquier otra.

  if (role === "professional") return <ProfessionalHome />;
  if (role === "admin") return <AdminHome />;
  return <Redirect href="/(app)/(tabs)" />;
}

/* ============================================================
   Profesional
   ============================================================ */

function ProfessionalHome() {
  const { email } = useUser();

  // Con los cancelados: de esos queda solo la baja sobre la hora. Ver `delDia`.
  const day = useAsync(() => professionalRange(today(), today(), true), []);
  const all = useAsync(() => myProfessionalAppointments(0), []);
  const unpaid = useAsync(() => unpaidAppointments(), []);
  // Contra un servidor de antes no hay lista, y eso es lo mismo que una lista vacía: la
  // caja no se dibuja.
  const waitlist = useAsync(() => myWaitlist().catch(() => [] as WaitingPatient[]), []);
  const feedback = useFeedback();

  // Arranca cerrada. Es una cuenta pendiente, no algo que haya que hacer hoy: se abre
  // cuando uno viene a reclamar, y mientras tanto alcanza con el número del renglón.
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  /** Cómo quedó la lista después de sacar a alguien desde el panel, hasta la próxima carga. */
  const [waiting, setWaiting] = useState<WaitingPatient[] | null>(null);
  const people = waiting ?? waitlist.data ?? [];

  // El total viene aparte de la lista porque no siempre coinciden: la lista tiene tope, y
  // el que trajo dos años de agenda puede tener más turnos sin cobrar de los que entran.
  const unpaidList = unpaid.data?.appointments ?? [];
  const unpaidCount = unpaid.data?.total.appointments ?? 0;
  const owed = unpaid.data?.total.amount ?? 0;

  const agenda = delDia(day.data ?? []);
  const toConfirm = (all.data ?? []).filter(
    (appointment) => stateOf(appointment) === "pending" && isUpcoming(appointment)
  );

  /**
   * Da por cobrado todo lo que quedó sin saldar, como en el panel de la página.
   *
   * Se pregunta antes, a diferencia de confirmar los pedidos: declara plata como cobrada,
   * y para volver atrás hay que abrir los turnos de a uno. El cartel dice el número y el
   * monto porque es lo único que deja darse cuenta de que se tocó el botón equivocado.
   */
  function confirmSettle() {
    Alert.alert(
      unpaidCount === 1 ? "¿Darlo por cobrado?" : "¿Darlos todos por cobrados?",
      `${unpaidCount === 1 ? "Se marca como cobrado 1 turno" : `Se marcan como cobrados ${unpaidCount} turnos`}${
        owed > 0 ? `, ${money(owed)}` : ""
      }. Para revertirlo, cada turno se cambia a mano.`,
      [
        { text: "Volver", style: "cancel" },
        { text: unpaidCount === 1 ? "Sí, darlo por cobrado" : "Sí, darlos por cobrados", onPress: settle },
      ]
    );
  }

  async function settle() {
    setSettling(true);

    try {
      const { settled, amount } = await settleUnpaid();
      const plata = amount > 0 ? `, ${money(amount)}` : "";
      feedback.done(settled === 1 ? `Turno dado por cobrado${plata}` : `${settled} turnos dados por cobrados${plata}`);
      unpaid.reload();
      day.reload();
      all.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setSettling(false);
    }
  }

  return (
    <Frame
      refreshing={day.refreshing}
      onRefresh={() => {
        day.refresh();
        all.reload();
        unpaid.reload();
        setWaiting(null);
        waitlist.reload();
      }}
      band={<BandHeadline>{headlineFor(agenda, day.loading)}</BandHeadline>}
    >
      <View style={styles.pad}>
        {toConfirm.length > 0 ? (
          <Section title="Pedidos pendientes">
            <Group>
              <Row
                title={toConfirm.length === 1 ? "Un turno sin confirmar" : `${toConfirm.length} turnos sin confirmar`}
                subtitle="Aceptar o rechazar"
                icon="clock"
                last
                onPress={() => router.push("/(app)/(tabs)/turnos")}
              />
            </Group>
          </Section>
        ) : null}

        {/* Es gente que ya pidió algo y todavía no lo tiene, así que va junto a los pedidos
            y antes de la plata, como en la página. Sin nadie esperando no se dibuja. */}
        {people.length > 0 ? (
          <Section title="Lista de espera">
            <Group>
              <Row
                title={
                  people.length === 1
                    ? "Una persona espera que se libere un horario"
                    : `${people.length} personas esperan que se libere un horario`
                }
                subtitle={
                  people
                    .slice(0, 3)
                    .map((person) => `${person.patient.name} ${person.patient.surname}`)
                    .join(", ") + (people.length > 3 ? "…" : "")
                }
                subtitleIsData
                icon="bell"
                last
                onPress={() => setWaitlistOpen(true)}
              />
            </Group>
          </Section>
        ) : null}

        {/* Debajo de los pedidos y de la misma forma, pero es otra cosa: un pedido espera
            una respuesta hoy, una consulta sin cobrar espera una conversación. Por eso se
            abre plegada y muestra solo el número. Los colores son los del cobro: rojo lo
            que no se pagó, ámbar lo que se pagó a medias. */}
        {unpaidCount > 0 ? (
          <Section title="Sin cobrar">
            <Group>
              <Row
                title={unpaidCount === 1 ? "Un turno atendido sin cobrar" : `${unpaidCount} turnos atendidos sin cobrar`}
                subtitle={
                  unpaidList.length < unpaidCount
                    ? `Faltan ${money(owed)}. Acá se ven los ${unpaidList.length} más recientes`
                    : owed > 0
                      ? `Faltan ${money(owed)}`
                      : "Con pagos parciales registrados"
                }
                subtitleIsData
                icon={unpaidOpen ? "chevron-up" : "chevron-down"}
                // Plata que falta cobrar: la flecha no lleva a otra pantalla, abre la
                // lista, y el color dice de qué se trata lo que hay adentro.
                tone="danger"
                last
                onPress={() => setUnpaidOpen(!unpaidOpen)}
              />
            </Group>

            {/* Afuera de la fila que despliega: son dos acciones distintas que conviene no
                confundir de un toque. */}
            <View style={{ marginTop: space.md }}>
              <Button
                label={unpaidCount === 1 ? "Considerar cobrado" : "Considerar todos cobrados"}
                icon="money-bill-wave"
                variant="secondary"
                block
                loading={settling}
                onPress={confirmSettle}
              />
            </View>

            {unpaidOpen ? (
              <View style={{ marginTop: space.md }}>
                <Group>
                  {unpaidList.map((appointment, index) => {
                    const payment = describePayment(appointment);

                    return (
                      <Row
                        key={appointment.numAppointment}
                        title={appointment.patient ? fullName(appointment.patient) : "Sin paciente"}
                        subtitle={`${numericDate(appointment.date)} · debe ${money(pendingAmount(appointment))}`}
                        subtitleIsData
                        right={payment ? <Tag label={payment.label} tone={payment.tone} /> : undefined}
                        last={index === unpaidList.length - 1}
                        onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
                      />
                    );
                  })}
                </Group>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Hoy">
          <DataState
            loading={day.loading}
            error={day.error}
            empty={agenda.length === 0}
            onRetry={day.reload}
            skeleton={<SkeletonList rows={3} height={84} />}
            emptyState={
              <EmptyState
                compact
                icon="mug-hot"
                title="Sin turnos hoy"
                description="No hay turnos cargados para el día de hoy."
                action={{ label: "Cargar un turno", onPress: () => router.push("/(app)/nuevo-turno") }}
              />
            }
          >
            <Group>
              {agenda.map((appointment, index) => (
                <AppointmentRow
                  key={appointment.numAppointment}
                  appointment={appointment}
                  viewerEmail={email}
                  last={index === agenda.length - 1}
                  onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
                />
              ))}
            </Group>
          </DataState>
        </Section>

        <Section title="Consultorio">
          <Group>
            <Row title="Ver mis turnos" subtitle="La agenda completa" icon="calendar-check" onPress={() => router.push("/(app)/(tabs)/turnos")} />
            <Row title="Horarios de atención" subtitle="Módulos de atención" icon="calendar-days" onPress={() => router.push("/(app)/horarios")} />
            <Row title="Números" subtitle="Facturación, pacientes y carga de la agenda" icon="chart-column" onPress={() => router.push("/(app)/mis-numeros")} />
            <Row title="Cargar un turno" subtitle="Normal o especial" icon="plus" last onPress={() => router.push("/(app)/nuevo-turno")} />
          </Group>
        </Section>

        {/* Cierra el panel: lo que se decide una vez y despues se olvida. */}
        <OfficeSettings />

        <WaitlistPeopleSheet
          visible={waitlistOpen}
          onClose={() => setWaitlistOpen(false)}
          list={people}
          onChanged={setWaiting}
        />
      </View>
    </Frame>
  );
}

function headlineFor(agenda: Appointment[], loading: boolean): string {
  if (loading) return "Mirando la agenda";

  // Las bajas sobre la hora están en la lista de abajo, pero acá no cuentan: nadie viene a
  // un turno que se dio de baja, y el encabezado dice a cuánta gente se atiende hoy.
  const vienen = agenda.filter((appointment) => stateOf(appointment) !== "cancelled").length;

  if (vienen === 0) return "Hoy no hay turnos.";
  if (vienen === 1) return "Hoy hay una persona con turno.";
  return `Hoy hay ${vienen} personas con turno.`;
}

/* ============================================================
   Admin
   ============================================================ */

function AdminHome() {
  const state = useAsync(() => officeAnalytics(), []);
  const month = state.data?.recent?.find((entry) => entry.inProgress) ?? state.data?.recent?.[0];

  return (
    <Frame
      refreshing={state.refreshing}
      onRefresh={state.refresh}
      band={
        <BandHeadline>
          {state.loading
            ? "Mirando el consultorio"
            : state.data
              ? `${state.data.headcount} ${state.data.headcount === 1 ? "profesional atendiendo" : "profesionales atendiendo"}.`
              : "No se pudieron traer los números del consultorio."}
        </BandHeadline>
      }
    >
      <View style={styles.pad}>
        {month ? (
          <Section title={`${month.label}, hasta hoy`}>
            <Group>
              <Row title="Turnos dados" value={String(month.appointments)} last={false} />
              <Row title="Asistieron" value={String(month.assisted)} last={false} />
              <Row title="Turnos especiales" value={String(month.overbooked)} last={false} />
              <Row title="Facturado" value={money(month.billed)} last />
            </Group>
          </Section>
        ) : null}

        <Section title="Administrar">
          <Group>
            <Row title="Usuarios" subtitle="Altas, bajas y solicitudes de profesionales" icon="users" onPress={() => router.push("/(app)/(tabs)/usuarios")} />
            <Row title="Control de turnos" subtitle="Qué está dando cada profesional" icon="eye" onPress={() => router.push("/(app)/admin/control")} />
            <Row title="Horarios" subtitle="Los módulos de atención de cada uno" icon="calendar-days" onPress={() => router.push("/(app)/horarios")} />
            <Row title="El día completo" subtitle="Consultorio por consultorio" icon="table-columns" onPress={() => router.push("/(app)/(tabs)/dia")} />
            <Row title="Avisos" subtitle="Carteles y notificaciones" icon="bullhorn" onPress={() => router.push("/(app)/admin/avisos")} />
            <Row title="Números del consultorio" subtitle="Facturación, pacientes y uso del asistente" icon="chart-column" onPress={() => router.push("/(app)/(tabs)/numeros")} />
            <Row title="Alquileres" subtitle="Cuotas, pagos y precios" icon="money-bill-wave" last onPress={() => router.push("/(app)/admin/alquileres")} />
          </Group>
        </Section>

        {/* Debajo de lo que el admin usa todos los días y arriba del catálogo, que casi
            no se toca: es información para mirar de paso, no un lugar al que se entra. */}
        <WeekSummary />

        <Section title="Catálogo">
          <Group>
            <Row title="Provincias" icon="map" onPress={() => router.push("/(app)/admin/provincias")} />
            <Row title="Localidades" icon="location-dot" onPress={() => router.push("/(app)/admin/localidades")} />
            <Row title="Sucursales" icon="building" onPress={() => router.push("/(app)/admin/sucursales")} />
            <Row title="Consultorios" icon="door-open" last onPress={() => router.push("/(app)/admin/consultorios")} />
          </Group>
        </Section>
      </View>
    </Frame>
  );
}

/* ============================================================
   Marco común
   ============================================================ */

function Frame({
  band,
  children,
  refreshing,
  onRefresh,
}: {
  band: React.ReactNode;
  children: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} colors={[colors.green]} />
      }
    >
      <DayBand onOpenAssistant={() => router.push("/(app)/asistente")}>{band}</DayBand>

      {/* Va en el marco y no en cada rol: lo que el consultorio tiene para decir es lo
          primero que hay que leer, sea quien sea el que entró. */}
      <AnnouncementBanner />

      {children}
      <View style={styles.pad}>
        <AppText variant="caption" tone="muted" style={styles.foot}>
          Consultorios del Jardín
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SCREEN_PADDING },
  gap: { marginTop: space.md },
  foot: { marginTop: space.xxxl, textAlign: "center" },
});
