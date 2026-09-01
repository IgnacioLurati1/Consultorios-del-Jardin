import { FontAwesome6 } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useUser } from "../../../session/SessionProvider";
import { useTheme } from "../../../theme/useTheme";

/**
 * La barra de abajo. Siempre cuatro lugares, y el último siempre es "Más": los tres
 * roles tienen más funciones de las que entran, así que en vez de inventar una barra
 * distinta por rol, los tres tienen la misma forma y cambia lo que hay adentro.
 *
 * Las pestañas que no le tocan a un rol no se ocultan del router (siguen siendo rutas a
 * las que se llega desde Más o desde Inicio), solo salen de la barra.
 */

type Slot = "index" | "pedir-turno" | "turnos" | "pacientes" | "usuarios" | "numeros" | "mas";

const VISIBLE: Record<string, Slot[]> = {
  client: ["index", "pedir-turno", "turnos", "mas"],
  professional: ["index", "turnos", "pacientes", "mas"],
  admin: ["index", "usuarios", "numeros", "mas"],
};

export default function TabsLayout() {
  const { colors } = useTheme();
  const { role } = useUser();

  const visible = VISIBLE[role] ?? VISIBLE.client;
  const shows = (slot: Slot) => (visible.includes(slot) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: styles.label,
        tabBarAllowFontScaling: true,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="house" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pedir-turno"
        options={{
          href: shows("pedir-turno"),
          title: "Pedir",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="calendar-plus" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="turnos"
        options={{
          href: shows("turnos"),
          // El paciente ve los suyos; el profesional ve el día que atiende.
          title: role === "professional" ? "Agenda" : "Turnos",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="calendar-check" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pacientes"
        options={{
          href: shows("pacientes"),
          title: "Pacientes",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="user-injured" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="usuarios"
        options={{
          href: shows("usuarios"),
          title: "Usuarios",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="users" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="numeros"
        options={{
          href: shows("numeros"),
          title: "Números",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="chart-column" size={size - 4} color={color} />,
        }}
      />

      <Tabs.Screen
        name="mas"
        options={{
          title: "Más",
          tabBarIcon: ({ color, size }) => <FontAwesome6 name="ellipsis" size={size - 4} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600" },
});
