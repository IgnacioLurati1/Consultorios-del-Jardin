import { FontAwesome6 } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useUser } from "../../../session/SessionProvider";
import { useTheme } from "../../../theme/useTheme";

/**
 * La barra de abajo. El último lugar siempre es "Más": los tres roles tienen más
 * funciones de las que entran, así que en vez de inventar una barra distinta por rol, los
 * tres tienen la misma forma y cambia lo que hay adentro.
 *
 * El profesional y el admin tienen además "Consultorio", el inicio del paciente con las
 * fotos del lugar. Son cinco lugares en vez de cuatro, y por eso con ellos la etiqueta y
 * el ícono van un punto más chicos: así "Consultorio" y "Pacientes" entran enteros en un
 * teléfono angosto.
 *
 * Las pestañas que no le tocan a un rol no se ocultan del router (siguen siendo rutas a
 * las que se llega desde Más o desde Inicio), solo salen de la barra.
 */

type Slot = "index" | "pedir-turno" | "turnos" | "pacientes" | "usuarios" | "dia" | "numeros" | "consultorio" | "mas";

const VISIBLE: Record<string, Slot[]> = {
  client: ["index", "pedir-turno", "turnos", "mas"],
  professional: ["index", "turnos", "pacientes", "consultorio", "mas"],
  // El día del consultorio y no los números: la agenda se mira todos los días, la
  // facturación una vez por mes. Los números siguen a un toque, desde Inicio.
  admin: ["index", "usuarios", "dia", "consultorio", "mas"],
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const { role } = useUser();

  const visible = VISIBLE[role] ?? VISIBLE.client;
  const shows = (slot: Slot) => (visible.includes(slot) ? undefined : null);
  const crowded = visible.length > 4;
  const iconSize = (size: number) => size - (crowded ? 6 : 4);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: crowded ? styles.labelSmall : styles.label,
        tabBarAllowFontScaling: true,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="house" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pedir-turno"
        options={{
          href: shows("pedir-turno"),
          title: "Pedir",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="calendar-plus" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="turnos"
        options={{
          href: shows("turnos"),
          // El paciente ve los suyos; el profesional ve el día que atiende.
          title: role === "professional" ? "Agenda" : "Turnos",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="calendar-check" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pacientes"
        options={{
          href: shows("pacientes"),
          title: "Pacientes",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="user-injured" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="usuarios"
        options={{
          href: shows("usuarios"),
          title: "Usuarios",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="users" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="dia"
        options={{
          href: shows("dia"),
          title: "El día",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="table-columns" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="numeros"
        options={{
          href: shows("numeros"),
          title: "Números",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="chart-column" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="consultorio"
        options={{
          href: shows("consultorio"),
          title: "Consultorio",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="leaf" size={iconSize(size)} color={color} />,
        }}
      />

      <Tabs.Screen
        name="mas"
        options={{
          title: "Más",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="ellipsis" size={iconSize(size)} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600" },
  labelSmall: { fontSize: 10, fontWeight: "600" },
});
