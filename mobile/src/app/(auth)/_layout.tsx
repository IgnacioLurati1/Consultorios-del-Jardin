import { Redirect, Stack } from "expo-router";
import { useSession } from "../../session/SessionProvider";
import { useTheme } from "../../theme/useTheme";

/**
 * Las pantallas de antes de entrar. El corte se hace acá y no adentro de cada pantalla:
 * si hay sesión, este grupo entero no existe.
 */
export default function AuthLayout() {
  const { session } = useSession();
  const { colors } = useTheme();

  if (session) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.green,
        headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: "Crear cuenta" }} />
      <Stack.Screen name="recuperar" options={{ title: "Recuperar contraseña" }} />
      <Stack.Screen name="contacto" options={{ title: "Escribinos" }} />
    </Stack>
  );
}
