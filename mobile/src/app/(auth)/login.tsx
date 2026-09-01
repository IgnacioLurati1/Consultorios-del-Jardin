import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { AppText } from "../../components/Text";
import { OFFICE_INFO } from "../../lib/specialities";
import { useSession } from "../../session/SessionProvider";
import { palette, radius, SCREEN_PADDING, space } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

const leaf = require("../../../assets/images/leaf.png");

/**
 * La única pantalla de la app con fondo oscuro. Es la portada: el verde profundo y la
 * tipografía de la marca aparecen una vez, acá, y de la sesión para adentro manda el
 * papel claro. Que sea la excepción es lo que la hace valer.
 */
export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!canSubmit || busy) return;

    setError(null);
    setBusy(true);

    try {
      await signIn(email, password);
      router.replace("/(app)/(tabs)");
    } catch (problem) {
      setError(errorMessage(problem, "No pudimos iniciar sesión"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: palette.light.ink }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + space.xxxl }]}>
          <Image source={leaf} style={styles.leaf} contentFit="contain" accessibilityIgnoresInvertColors />

          <AppText variant="display" tone="cream" style={styles.heroTitle}>
            {OFFICE_INFO.name}
          </AppText>

          <AppText variant="small" style={styles.heroLine}>
            Tus turnos, tu agenda y tus datos, en el teléfono.
          </AppText>
        </View>

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.bg, paddingBottom: insets.bottom + space.xxl },
          ]}
        >
          <AppText variant="title">Entrar</AppText>

          <View style={styles.form}>
            <Field
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              placeholder="tunombre@mail.com"
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Field
              label="Contraseña"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              placeholder="Tu contraseña"
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error}
            />

            <Button label="Entrar" onPress={submit} loading={busy} disabled={!canSubmit} block />
          </View>

          <View style={styles.links}>
            <Link href="/(auth)/recuperar" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <AppText variant="small" tone="green">
                  Me olvidé la contraseña
                </AppText>
              </Pressable>
            </Link>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.signup}>
              <AppText variant="small" tone="muted">
                ¿Todavía no tenés cuenta?
              </AppText>

              <Link href="/(auth)/registro" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <AppText variant="bodyStrong" tone="green">
                    Crear una cuenta
                  </AppText>
                </Pressable>
              </Link>
            </View>

            <Link href="/(auth)/contacto" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <AppText variant="small" tone="muted">
                  Escribirle al consultorio
                </AppText>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: space.xxxl + space.sm,
    gap: space.md,
  },
  leaf: { width: 44, height: 44 },
  heroTitle: { marginTop: space.xs },
  // El crema al 80% sobre el verde oscuro: la bajada acompaña al título sin competirle.
  heroLine: { color: "rgba(254, 250, 224, 0.78)" },
  sheet: {
    flex: 1,
    borderTopLeftRadius: radius.lg + 10,
    borderTopRightRadius: radius.lg + 10,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: space.xxl,
    gap: space.xl,
  },
  form: { gap: space.lg },
  links: { gap: space.lg },
  divider: { height: StyleSheet.hairlineWidth },
  signup: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
});
