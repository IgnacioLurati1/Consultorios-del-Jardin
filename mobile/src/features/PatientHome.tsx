import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ReactNode } from "react";
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgendaDay, agendaDay } from "../api/agenda";
import { myPatientAppointments, professionalRange } from "../api/appointments";
import { Appointment } from "../api/types";
import { AppointmentRow } from "../components/AppointmentRow";
import { Button } from "../components/Button";
import { StateBadge } from "../components/Chip";
import { PlaceBand } from "../components/DayBand";
import { Skeleton } from "../components/States";
import { Card, Group, Note, Row, Section } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { AnnouncementBanner } from "./Announcements";
import { fullName, isUpcoming, stateOf } from "../lib/appointments";
import { addDays, hourRange, relativeDay, sentenceCase, today, toISODate } from "../lib/dates";
import { BAND_PHOTOS, DIRECTIONS_URL, GALLERY_PHOTOS, SPECIALITY_TILES } from "../lib/place";
import { OFFICE_INFO } from "../lib/specialities";
import { useAsync } from "../lib/useAsync";
import { useUser } from "../session/SessionProvider";
import { elevation, radius, SCREEN_PADDING, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** Hasta cuántos días para adelante se busca el próximo turno que atiende el profesional. */
const PROFESSIONAL_AHEAD_DAYS = 30;

function byMoment(a: Appointment, b: Appointment): number {
  return a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.initialHour.localeCompare(b.initialHour);
}

/**
 * El inicio del paciente: el lugar arriba y una tarjeta encima.
 *
 * Es lo mismo que la portada de la página vista desde el celular —el consultorio en
 * fotos, las especialidades, dónde queda— con lo único que la página no sabe: qué tiene
 * por delante quien entró. Eso va en la tarjeta montada sobre las fotos, que es lo primero
 * que se lee, y el resto queda abajo para quien quiera recorrerlo.
 *
 * El profesional y el admin la tienen en su propia pestaña, Consultorio, y la tarjeta
 * cambia según quién mira: el paciente ve su próximo turno; el profesional, el próximo que
 * atiende; el admin, el resumen de hoy en el consultorio. Pedir turno desde las
 * especialidades vale para el paciente y el profesional (que también se atiende acá), no
 * para el admin. El contacto es para quien consulta desde afuera: solo el paciente.
 */
export function PatientHome() {
  const { email, role } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const appointments = useAsync((): Promise<Appointment[]> => {
    if (role === "client") return myPatientAppointments(0);
    if (role === "professional") {
      return professionalRange(today(), toISODate(addDays(new Date(), PROFESSIONAL_AHEAD_DAYS)));
    }
    return Promise.resolve([]);
  }, [role]);

  const day = useAsync((): Promise<AgendaDay | null> => (role === "admin" ? agendaDay(today()) : Promise.resolve(null)), [role]);

  const upcoming = (appointments.data ?? []).filter((appointment) => isUpcoming(appointment)).sort(byMoment);
  const next = upcoming[0];
  // La lista de abajo es del paciente. El profesional ya tiene su agenda en Inicio.
  const others = role === "client" ? upcoming.slice(1, 5) : [];
  const waiting = role === "client" && upcoming.some((appointment) => stateOf(appointment) === "pending");

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={appointments.refreshing || day.refreshing}
          onRefresh={() => {
            appointments.refresh();
            day.refresh();
          }}
          tintColor={colors.cream}
          colors={[colors.green]}
        />
      }
    >
      <PlaceBand photos={BAND_PHOTOS} subtitle={OFFICE_INFO.address} onOpenAssistant={() => router.push("/(app)/asistente")} />

      <View style={[styles.pad, styles.lift]}>
        {role === "admin" ? (
          <TodayCard loading={day.loading} failed={!!day.error && !day.data} data={day.data} onRetry={day.reload} />
        ) : (
          <NextAppointment
            viewer={role === "professional" ? "professional" : "patient"}
            loading={appointments.loading}
            failed={!!appointments.error && !appointments.data}
            appointment={next}
            onRetry={appointments.reload}
            onBook={() => openBooking(role)}
          />
        )}
      </View>

      <AnnouncementBanner />

      <View style={styles.pad}>
        {others.length > 0 ? (
          <Section title="Próximos turnos">
            <Group>
              {others.map((appointment, index) => (
                <AppointmentRow
                  key={appointment.numAppointment}
                  appointment={appointment}
                  viewerEmail={email}
                  showDay
                  last={index === others.length - 1}
                  onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
                />
              ))}
            </Group>
          </Section>
        ) : null}

        {waiting ? (
          <View style={styles.gap}>
            <Note>La confirmación de cada turno llega por mail.</Note>
          </View>
        ) : null}

        <Section title="Especialidades">
          <Specialities onPick={role !== "admin" ? (name) => openBooking(role, name) : undefined} />
        </Section>

        <Section title="El consultorio">
          <Gallery />
        </Section>

        <Section title="Visita">
          <Group>
            <Row
              title={OFFICE_INFO.address}
              subtitle="Cómo llegar"
              icon="location-dot"
              onPress={() => Linking.openURL(DIRECTIONS_URL)}
            />
            <Row title={OFFICE_INFO.hours} icon="clock" />
            <Row
              title={`@${OFFICE_INFO.instagram}`}
              subtitle="Instagram"
              icon="instagram"
              last={role !== "client"}
              onPress={() => Linking.openURL(`https://instagram.com/${OFFICE_INFO.instagram}`)}
            />
            {role === "client" ? (
              <Row title="Contacto" subtitle="Consultas por mail" icon="envelope" last onPress={() => router.push("/(app)/contacto")} />
            ) : null}
          </Group>
        </Section>

        <AppText variant="caption" tone="muted" style={styles.foot}>
          Consultorios del Jardín
        </AppText>
      </View>
    </ScrollView>
  );
}

/**
 * Adónde lleva pedir turno. El paciente lo tiene en la barra de abajo; el profesional lo
 * pide como paciente desde la pantalla apilada que también abre desde Más, que tiene el
 * botón para volver.
 */
function openBooking(role: string, especialidad?: string) {
  if (role === "professional") {
    router.push(especialidad ? { pathname: "/(app)/pedir", params: { especialidad } } : "/(app)/pedir");
    return;
  }

  router.push(
    especialidad ? { pathname: "/(app)/(tabs)/pedir-turno", params: { especialidad } } : "/(app)/(tabs)/pedir-turno"
  );
}

/* ---------------- la tarjeta de arriba ---------------- */

function Kicker({ children }: { children: ReactNode }) {
  return (
    <AppText variant="caption" tone="muted" style={styles.kicker}>
      {children}
    </AppText>
  );
}

function LoadingCard({ kicker }: { kicker: string }) {
  return (
    <Card style={elevation.raised}>
      <Kicker>{kicker}</Kicker>
      <Skeleton height={24} width="70%" style={styles.skeleton} />
      <Skeleton height={16} width="50%" style={styles.skeleton} />
    </Card>
  );
}

function FailedCard({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Card style={elevation.raised}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="small" tone="muted" style={styles.cardText}>
        Revisar la conexión y volver a intentar.
      </AppText>
      <Button label="Reintentar" variant="secondary" onPress={onRetry} style={styles.cardButton} />
    </Card>
  );
}

/** Toda la tarjeta se toca, y la flechita del pie lo dice. */
function PressableCard({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => (pressed && Platform.OS === "ios" ? styles.pressed : undefined)}
    >
      <Card style={elevation.raised}>{children}</Card>
    </Pressable>
  );
}

function CardFoot({ children }: { children: ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.cardFoot}>
      <AppText variant="small" tone="muted" style={styles.flex} numberOfLines={1}>
        {children}
      </AppText>
      <FontAwesome6 name="chevron-right" size={13} color={colors.muted} />
    </View>
  );
}

/**
 * El próximo turno. Para el paciente, el que pidió, con quién y de qué especialidad; para
 * el profesional, el próximo que atiende, con quién viene.
 *
 * Sin turno no queda en "no hay nada": al paciente lo invita a pedir uno y al profesional
 * lo lleva a su agenda. Una pantalla que no ofrece qué hacer es un callejón.
 */
function NextAppointment({
  viewer,
  loading,
  failed,
  appointment,
  onRetry,
  onBook,
}: {
  viewer: "patient" | "professional";
  loading: boolean;
  failed: boolean;
  appointment?: Appointment;
  onRetry: () => void;
  onBook: () => void;
}) {
  if (loading) return <LoadingCard kicker="PRÓXIMO TURNO" />;
  if (failed) return <FailedCard title="No se pudieron traer los turnos" onRetry={onRetry} />;

  if (!appointment) {
    return viewer === "professional" ? (
      <Card style={elevation.raised}>
        <Kicker>PRÓXIMO TURNO</Kicker>
        <AppText variant="displaySmall">Sin turnos por delante</AppText>
        <Button
          label="Ver la agenda"
          icon="calendar-check"
          variant="secondary"
          onPress={() => router.push("/(app)/(tabs)/turnos")}
          style={styles.cardButton}
        />
      </Card>
    ) : (
      <Card style={elevation.raised}>
        <Kicker>PRÓXIMO TURNO</Kicker>
        <AppText variant="displaySmall">Sin turnos pedidos</AppText>
        <AppText variant="small" tone="muted" style={styles.cardText}>
          Especialidad, profesional y horario, con confirmación por mail.
        </AppText>
        <Button label="Solicitar turno" icon="calendar-plus" onPress={onBook} style={styles.cardButton} />
      </Card>
    );
  }

  const who =
    viewer === "professional"
      ? appointment.patient
        ? fullName(appointment.patient)
        : "Sin paciente"
      : `${fullName(appointment.professional)}${appointment.professional?.speciality ? ` · ${appointment.professional.speciality}` : ""}`;

  return (
    <PressableCard
      label={`Próximo turno, ${relativeDay(appointment.date)}, ${hourRange(appointment.initialHour, appointment.finalHour)}, ${who}`}
      onPress={() => router.push(`/(app)/turno/${appointment.numAppointment}`)}
    >
      <View style={styles.cardHead}>
        <Kicker>PRÓXIMO TURNO</Kicker>
        <StateBadge state={stateOf(appointment)} />
      </View>

      <AppText variant="displaySmall">{sentenceCase(relativeDay(appointment.date))}</AppText>
      <AppText variant="bodyStrong" style={styles.cardText}>
        {hourRange(appointment.initialHour, appointment.finalHour)}
        {appointment.room?.description ? ` · ${appointment.room.description}` : ""}
      </AppText>

      <CardFoot>{who}</CardFoot>
    </PressableCard>
  );
}

/**
 * La tarjeta del admin: el día de hoy en el consultorio, en una línea. Lleva al día
 * completo, que es donde está el detalle sala por sala.
 *
 * Cuenta a quien atiende por un módulo o por un turno, igual que la agenda del día: un
 * profesional con turnos especiales y sin módulos también está atendiendo.
 */
function TodayCard({
  loading,
  failed,
  data,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  data: AgendaDay | null | undefined;
  onRetry: () => void;
}) {
  if (loading) return <LoadingCard kicker="HOY EN EL CONSULTORIO" />;
  if (failed || !data) return <FailedCard title="No se pudo traer el día" onRetry={onRetry} />;

  const count = data.appointments.length;
  const professionals = new Set([
    ...data.schedules.map((schedule) => schedule.professional.email),
    ...data.appointments.map((appointment) => appointment.professional.email),
  ]).size;
  const rooms = new Set([
    ...data.schedules.map((schedule) => schedule.idRoom),
    ...data.appointments.map((appointment) => appointment.idRoom),
  ]).size;

  const title = count === 0 ? "Sin turnos hoy" : count === 1 ? "Un turno" : `${count} turnos`;
  const detail =
    professionals > 0
      ? `${professionals} ${professionals === 1 ? "profesional" : "profesionales"} · ${rooms} ${rooms === 1 ? "consultorio" : "consultorios"}`
      : null;

  return (
    <PressableCard label={`Hoy en el consultorio, ${title}${detail ? `, ${detail}` : ""}`} onPress={() => router.push("/(app)/(tabs)/dia")}>
      <Kicker>HOY EN EL CONSULTORIO</Kicker>
      <AppText variant="displaySmall">{title}</AppText>
      {detail ? (
        <AppText variant="bodyStrong" style={styles.cardText}>
          {detail}
        </AppText>
      ) : null}

      <CardFoot>Ver el día completo</CardFoot>
    </PressableCard>
  );
}

/* ---------------- el resto ---------------- */

/**
 * Las especialidades. Tocar una lleva a pedir turno con esa especialidad elegida. Sin
 * `onPick` (el admin) quedan como muestra: sin "Ver horarios" y sin tocarse.
 *
 * Van de a dos. Si quedan impares, la última ocupa el renglón entero y se acuesta (ícono al
 * costado): media ficha sola abajo se lee como un hueco, no como una especialidad más.
 */
function Specialities({ onPick }: { onPick?: (name: string) => void }) {
  const { colors, dark } = useTheme();
  const odd = SPECIALITY_TILES.length % 2 === 1;

  return (
    <View style={styles.tiles}>
      {SPECIALITY_TILES.map((tile, index) => {
        const wide = odd && index === SPECIALITY_TILES.length - 1;

        return (
          <Pressable
            key={tile.name}
            onPress={onPick ? () => onPick(tile.name) : undefined}
            disabled={!onPick}
            accessibilityRole={onPick ? "button" : undefined}
            accessibilityLabel={onPick ? `${tile.name}, ver horarios` : tile.name}
            android_ripple={{ color: colors.border }}
            style={({ pressed }) => [
              styles.tile,
              wide && styles.tileWide,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && Platform.OS === "ios" && styles.pressed,
            ]}
          >
            {/* En oscuro el tinte va de fondo y el ícono en crema: el tinte solo, sobre gris
                oscuro, no se distingue. */}
            <View style={[styles.tileIcon, wide && styles.tileIconWide, { backgroundColor: dark ? tile.tint : `${tile.tint}1f` }]}>
              <FontAwesome6 name={tile.icon} size={18} color={dark ? colors.cream : tile.tint} />
            </View>
            <View style={styles.tileText}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {tile.name}
              </AppText>
              {onPick ? (
                <AppText variant="caption" tone="green">
                  Ver horarios
                </AppText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * El lugar por dentro, para deslizar de costado. Sin epígrafes: las fotos se explican
 * solas, y la descripción queda para el lector de pantalla.
 */
function Gallery() {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={GALLERY_WIDTH + space.md}
      decelerationRate="fast"
      contentContainerStyle={styles.gallery}
      style={styles.galleryScroll}
    >
      {GALLERY_PHOTOS.map((photo) => (
        <Image
          key={photo.caption}
          source={photo.source}
          style={[styles.slidePhoto, { backgroundColor: colors.sunken }]}
          contentFit="cover"
          accessible
          accessibilityLabel={photo.caption}
        />
      ))}
    </ScrollView>
  );
}

const GALLERY_WIDTH = 210;

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SCREEN_PADDING },
  /* La tarjeta sube hasta montarse sobre las fotos. */
  lift: { marginTop: -44 },
  gap: { marginTop: space.md },
  flex: { flex: 1 },
  kicker: { letterSpacing: 0.8, marginBottom: space.xs },
  skeleton: { marginTop: space.sm, borderRadius: radius.sm },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  cardText: { marginTop: space.xs },
  cardButton: { marginTop: space.lg },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  pressed: { opacity: 0.7 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileWide: { flexBasis: "100%", flexDirection: "row", alignItems: "center", gap: space.md },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  tileIconWide: { marginBottom: 0 },
  tileText: { gap: space.xs, flexShrink: 1 },
  /* La galería va de borde a borde: se sale del margen de la pantalla para que se note que
     hay más fotos hacia el costado. */
  galleryScroll: { marginHorizontal: -SCREEN_PADDING },
  gallery: { gap: space.md, paddingHorizontal: SCREEN_PADDING },
  slidePhoto: { width: GALLERY_WIDTH, height: 280, borderRadius: radius.lg },
  foot: { marginTop: space.xxxl, textAlign: "center" },
});
