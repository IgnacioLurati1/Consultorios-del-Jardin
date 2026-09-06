import { Fraunces_600SemiBold, useFonts } from "@expo-google-fonts/fraunces";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FeedbackProvider } from "../components/Feedback";
import { Splash } from "../components/Splash";
import { AlertsProvider } from "../session/AlertsProvider";
import { SessionProvider, useSession } from "../session/SessionProvider";
import { useTheme } from "../theme/useTheme";

// La pantalla que pone el sistema se queda hasta que la nuestra esté dibujada. Si se
// fuera antes se vería un parpadeo blanco en el medio.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { colors, dark } = useTheme();
  const { loading } = useSession();
  const [fontsReady] = useFonts({ Fraunces_600SemiBold });
  const [splashOut, setSplashOut] = useState(false);

  const ready = fontsReady && !loading;

  /*
   * La nativa se baja recién cuando la nuestra quedó dibujada, y no cuando la app está
   * lista: entre una cosa y la otra hay un cuadro en blanco, y es justo el cuadro que la
   * pantalla de arranque existe para tapar.
   */
  const hideNative = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      {ready ? (
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
      ) : null}

      {!splashOut ? <Splash ready={ready} onShown={hideNative} onDone={() => setSplashOut(true)} /> : null}
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
