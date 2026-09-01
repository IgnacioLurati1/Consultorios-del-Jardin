import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../../components/Screen";
import { Group, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { OFFICE_INFO } from "../../../lib/specialities";
import { useSession, useUser } from "../../../session/SessionProvider";
import { radius, space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/**
 * El desborde de la barra de abajo. Los tres roles tienen más funciones de las que
 * entran en cuatro lugares, así que acá está todo lo que no entró, agrupado por para qué
 * sirve y no por quién lo hizo.
 */
export default function MoreScreen() {
  const { role, email } = useUser();
  const { signOut } = useSession();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  function confirmSignOut() {
    // Confirmación destructiva: es el único uso que tiene un cartel del sistema en la app.
    Alert.alert("Cerrar sesión", "Vas a tener que volver a entrar con tu email y contraseña.", [
      { text: "Quedarme", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <Screen style={{ paddingTop: insets.top + space.lg }}>
      <AppText variant="display">Más</AppText>
      <AppText variant="small" tone="muted" style={styles.subtitle}>
        {email}
      </AppText>

      {role === "professional" ? (
        <Section title="Tu trabajo">
          <Group>
            <Row title="Horarios de atención" subtitle="Los módulos en los que atendés" icon="calendar-days" onPress={() => router.push("/(app)/horarios")} />
            <Row title="Turnos que se repiten" subtitle="Los que se generan solos" icon="repeat" onPress={() => router.push("/(app)/repeticiones")} />
            <Row title="Tus números" subtitle="Facturación, pacientes y carga de la agenda" icon="chart-column" onPress={() => router.push("/(app)/numeros")} />
            <Row title="Cargar un turno" subtitle="Con un paciente tuyo, o un sobreturno" icon="plus" last onPress={() => router.push("/(app)/nuevo-turno")} />
          </Group>
        </Section>
      ) : null}

      {role === "professional" ? (
        <Section title="Atenderte vos">
          <Group>
            <Row
              title="Pedir un turno"
              subtitle="Con otro profesional del consultorio"
              icon="calendar-plus"
              last
              onPress={() => router.push("/(app)/pedir")}
            />
          </Group>
        </Section>
      ) : null}

      {role === "admin" ? (
        <>
          <Section title="Administrar">
            <Group>
              <Row title="Control de turnos" subtitle="Qué está dando cada profesional" icon="eye" onPress={() => router.push("/(app)/admin/control")} />
              <Row title="Alta de profesional" subtitle="Crear una cuenta ya habilitada" icon="user-plus" onPress={() => router.push("/(app)/admin/alta-profesional")} />
              <Row title="Horarios" subtitle="Los módulos de atención de cada uno" icon="calendar-days" last onPress={() => router.push("/(app)/horarios")} />
            </Group>
          </Section>

          <Section title="Catálogo">
            <Group>
              <Row title="Provincias" icon="map" onPress={() => router.push("/(app)/admin/provincias")} />
              <Row title="Localidades" icon="location-dot" onPress={() => router.push("/(app)/admin/localidades")} />
              <Row title="Sucursales" icon="building" onPress={() => router.push("/(app)/admin/sucursales")} />
              <Row title="Consultorios" icon="door-open" last onPress={() => router.push("/(app)/admin/consultorios")} />
            </Group>
          </Section>
        </>
      ) : null}

      <Section title="Tu cuenta">
        <Group>
          <Row title="Mis datos" subtitle="Teléfono, documento y contraseña" icon="user-pen" onPress={() => router.push("/(app)/mis-datos")} />
          <Row title="Asistente" subtitle="Preguntale lo que necesites" icon="comment-dots" onPress={() => router.push("/(app)/asistente")} />
          <Row title="Cerrar sesión" icon="right-from-bracket" destructive last onPress={confirmSignOut} />
        </Group>
      </Section>

      <Section title="El consultorio">
        <Group>
          <Row title="Escribinos" subtitle="Dudas, cambios de turno, reclamos" icon="envelope" onPress={() => router.push("/(app)/contacto")} />
          <Row
            title="Cómo llegar"
            subtitle={OFFICE_INFO.address}
            icon="location-dot"
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(OFFICE_INFO.address)}`)}
          />
          <Row
            title="Instagram"
            subtitle={`@${OFFICE_INFO.instagram}`}
            icon="instagram"
            last
            onPress={() => Linking.openURL(`https://instagram.com/${OFFICE_INFO.instagram}`)}
          />
        </Group>

        <View style={[styles.hours, { backgroundColor: colors.greenSoft }]}>
          <FontAwesome6 name="clock" size={14} color={colors.greenDark} />
          <AppText variant="small" tone="green" style={styles.hoursText}>
            {OFFICE_INFO.hours}
          </AppText>
        </View>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space.xs },
  hours: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
  },
  hoursText: { flex: 1 },
});
