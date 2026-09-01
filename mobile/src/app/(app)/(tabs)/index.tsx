import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { myPatientAppointments, myProfessionalAppointments, professionalRange } from "../../../api/appointments";
import { officeAnalytics } from "../../../api/analytics";
import { Appointment } from "../../../api/types";
import { AppointmentRow } from "../../../components/AppointmentRow";
import { Button } from "../../../components/Button";
import { BandHeadline, DayBand } from "../../../components/DayBand";
import { DataState, EmptyState, SkeletonList } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { WeekSummary } from "../../../features/WeekSummary";
import { isUpcoming, stateOf } from "../../../lib/appointments";
import { money, today } from "../../../lib/dates";
import { useAsync } from "../../../lib/useAsync";
import { useUser } from "../../../session/SessionProvider";
import { SCREEN_PADDING, space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/**
 * Inicio. Es la misma pantalla para los tres roles porque la pregunta es la misma
 * ("¿qué tengo hoy?"), pero la respuesta cambia bastante, así que cada rol tiene su
 * cuerpo.
 */
export default function HomeScreen() {
  const { role } = useUser();

  if (role === "professional") return <ProfessionalHome />;
  if (role === "admin") return <AdminHome />;
  return <PatientHome />;
}

/* ============================================================
   Paciente
   ============================================================ */

function PatientHome() {
  const { email } = useUser();
  const state = useAsync(() => myPatientAppointments(0), []);

  const upcoming = (state.data ?? []).filter((appointment) => isUpcoming(appointment));
  const next = upcoming[0];

  return (
    <Frame
      refreshing={state.refreshing}
      onRefresh={state.refresh}
      band={
        <BandHeadline>
          {state.loading
            ? "Buscando tus turnos"
            : next
              ? `Tu próximo turno es con ${next.professional.name} ${next.professional.surname}.`
              : "No tenés turnos pedidos."}
        </BandHeadline>
      }
    >
      <DataState
        loading={state.loading}
        error={state.error}
        empty={upcoming.length === 0}
        onRetry={state.reload}
        skeleton={<View style={styles.pad}><SkeletonList rows={3} height={84} /></View>}
        emptyState={
          <EmptyState
            icon="calendar-plus"
            title="Todavía no tenés turnos"
            description="Elegí una especialidad y un horario que te sirva. Te confirmamos por mail."
            action={{ label: "Pedir un turno", onPress: () => router.push("/(app)/(tabs)/pedir-turno") }}
          />
        }
      >
        <View style={styles.pad}>
          <Section title={upcoming.length === 1 ? "Tu turno" : "Tus próximos turnos"}>
            <Group>
              {upcoming.slice(0, 5).map((appointment, index) => (
                <AppointmentRow
                  key={appointment.numAppointment}
                  appointment={appointment}
                  viewerEmail={email}
                  showDay
                  last={index === Math.min(upcoming.length, 5) - 1}
                  onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
                />
              ))}
            </Group>

            {upcoming.some((appointment) => stateOf(appointment) === "pending") ? (
              <View style={styles.gap}>
                <Note>
                  Los turnos que dicen "a confirmar" todavía los tiene que aceptar el profesional. Te avisamos por mail
                  en cuanto lo haga.
                </Note>
              </View>
            ) : null}
          </Section>

          <Section>
            <Button
              label="Pedir otro turno"
              icon="calendar-plus"
              variant="secondary"
              block
              onPress={() => router.push("/(app)/(tabs)/pedir-turno")}
            />
          </Section>
        </View>
      </DataState>
    </Frame>
  );
}

/* ============================================================
   Profesional
   ============================================================ */

function ProfessionalHome() {
  const { email } = useUser();

  const day = useAsync(() => professionalRange(today(), today()), []);
  const all = useAsync(() => myProfessionalAppointments(0), []);

  const agenda = (day.data ?? []).filter((appointment) => stateOf(appointment) !== "cancelled");
  const toConfirm = (all.data ?? []).filter(
    (appointment) => stateOf(appointment) === "pending" && isUpcoming(appointment)
  );

  return (
    <Frame
      refreshing={day.refreshing}
      onRefresh={() => {
        day.refresh();
        all.reload();
      }}
      band={<BandHeadline>{headlineFor(agenda, day.loading)}</BandHeadline>}
    >
      <View style={styles.pad}>
        {toConfirm.length > 0 ? (
          <Section title="Te están esperando">
            <Group>
              <Row
                title={toConfirm.length === 1 ? "Un turno sin confirmar" : `${toConfirm.length} turnos sin confirmar`}
                subtitle="Aceptalos o rechazalos para que la persona sepa a qué atenerse."
                icon="clock"
                last
                onPress={() => router.push("/(app)/(tabs)/turnos")}
              />
            </Group>
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
                title="Hoy no atendés a nadie"
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

        <Section title="Tu consultorio">
          <Group>
            <Row title="Horarios de atención" subtitle="Los módulos en los que atendés" icon="calendar-days" onPress={() => router.push("/(app)/horarios")} />
            <Row title="Turnos que se repiten" subtitle="Los que se generan solos cada semana" icon="repeat" onPress={() => router.push("/(app)/repeticiones")} />
            <Row title="Tus números" subtitle="Facturación, pacientes y carga de la agenda" icon="chart-column" onPress={() => router.push("/(app)/mis-numeros")} />
            <Row title="Cargar un turno" subtitle="Con un paciente tuyo, o un sobreturno" icon="plus" last onPress={() => router.push("/(app)/nuevo-turno")} />
          </Group>
        </Section>
      </View>
    </Frame>
  );
}

function headlineFor(agenda: Appointment[], loading: boolean): string {
  if (loading) return "Mirando tu agenda";
  if (agenda.length === 0) return "Hoy no tenés turnos.";
  if (agenda.length === 1) return "Hoy atendés a una persona.";
  return `Hoy atendés a ${agenda.length} personas.`;
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
              : "No pudimos traer los números del consultorio."}
        </BandHeadline>
      }
    >
      <View style={styles.pad}>
        {month ? (
          <Section title={`${month.label}, hasta hoy`}>
            <Group>
              <Row title="Turnos dados" value={String(month.appointments)} last={false} />
              <Row title="Asistieron" value={String(month.assisted)} last={false} />
              <Row title="Sobreturnos" value={String(month.overbooked)} last={false} />
              <Row title="Facturado" value={money(month.billed)} last />
            </Group>
          </Section>
        ) : null}

        <Section title="Administrar">
          <Group>
            <Row title="Usuarios" subtitle="Altas, bajas y solicitudes de profesionales" icon="users" onPress={() => router.push("/(app)/(tabs)/usuarios")} />
            <Row title="Control de turnos" subtitle="Qué está dando cada profesional" icon="eye" onPress={() => router.push("/(app)/admin/control")} />
            <Row title="Horarios" subtitle="Los módulos de atención de cada uno" icon="calendar-days" onPress={() => router.push("/(app)/horarios")} />
            <Row title="El día completo" subtitle="Quién atiende y qué turnos hay, consultorio por consultorio" icon="table-columns" onPress={() => router.push("/(app)/admin/dia")} />
            <Row title="Números del consultorio" subtitle="Facturación, pacientes y uso del asistente" icon="chart-column" last onPress={() => router.push("/(app)/(tabs)/numeros")} />
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
