import { Redirect, Stack } from "expo-router";
import { useSession } from "../../session/SessionProvider";
import { useTheme } from "../../theme/useTheme";

/**
 * Todo lo que hay detrás de la sesión. El corte vive acá: si el token se venció y no se
 * pudo renovar, este grupo deja de existir y la app vuelve al login sola, sin que
 * ninguna pantalla tenga que enterarse.
 */
export default function AppLayout() {
  const { session } = useSession();
  const { colors } = useTheme();

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.green,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
        headerBackTitle: "Atrás",
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Pantallas enfocadas: tapan la barra de abajo mientras dura la tarea. */}
      <Stack.Screen name="asistente" options={{ title: "Asistente", presentation: "modal" }} />
      <Stack.Screen name="turno/[num]" options={{ title: "Turno" }} />
      <Stack.Screen name="paciente/[email]" options={{ title: "Paciente" }} />
      <Stack.Screen name="pedir/index" options={{ title: "Pedir un turno" }} />
      <Stack.Screen name="pedir/[email]" options={{ title: "Elegir horario" }} />
      <Stack.Screen name="horarios" options={{ title: "Horarios de atención" }} />
      <Stack.Screen name="repeticiones" options={{ title: "Turnos que se repiten" }} />
      <Stack.Screen name="mis-datos" options={{ title: "Mis datos" }} />
      <Stack.Screen name="contacto" options={{ title: "Escribinos" }} />
      <Stack.Screen name="numeros" options={{ title: "Números" }} />
      <Stack.Screen name="nuevo-turno" options={{ title: "Nuevo turno", presentation: "modal" }} />
      <Stack.Screen name="nuevo-paciente" options={{ title: "Nuevo paciente", presentation: "modal" }} />

      <Stack.Screen name="admin/alta-profesional" options={{ title: "Alta de profesional", presentation: "modal" }} />
      <Stack.Screen name="admin/control" options={{ title: "Control de turnos" }} />
      <Stack.Screen name="admin/provincias" options={{ title: "Provincias" }} />
      <Stack.Screen name="admin/localidades" options={{ title: "Localidades" }} />
      <Stack.Screen name="admin/sucursales" options={{ title: "Sucursales" }} />
      <Stack.Screen name="admin/consultorios" options={{ title: "Consultorios" }} />
    </Stack>
  );
}
