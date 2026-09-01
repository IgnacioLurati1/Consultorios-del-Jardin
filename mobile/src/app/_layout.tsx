import { Fraunces_600SemiBold, useFonts } from "@expo-google-fonts/fraunces";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FeedbackProvider } from "../components/Feedback";
import { AlertsProvider } from "../session/AlertsProvider";
import { SessionProvider, useSession } from "../session/SessionProvider";
import { useTheme } from "../theme/useTheme";

// La pantalla de arranque se queda hasta que estén la fuente y la sesión. Si se fuera
// antes, se vería un parpadeo blanco y después la tipografía cambiando de golpe.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { colors, dark } = useTheme();
  const { loading } = useSession();
  const [fontsReady] = useFonts({ Fraunces_600SemiBold });

  const ready = fontsReady && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.green,
          headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: "600" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <FeedbackProvider>
            {/* Adentro de la sesión porque solo tiene sentido para el profesional que ya
                entró, y afuera de las pantallas porque los avisos se reprograman aunque
                no se esté mirando ninguna. */}
            <AlertsProvider>
              <Root />
            </AlertsProvider>
          </FeedbackProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
