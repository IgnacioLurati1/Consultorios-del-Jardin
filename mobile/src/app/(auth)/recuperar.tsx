import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import { requestPasswordMail } from "../../api/people";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Screen } from "../../components/Screen";
import { EmptyState } from "../../components/States";
import { AppText } from "../../components/Text";
import { space } from "../../theme/tokens";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pedir el mail para elegir una contraseña nueva.
 *
 * La respuesta es la misma exista o no la cuenta: si dijera "ese email no está
 * registrado", cualquiera podría averiguar quién tiene cuenta en el consultorio, que en
 * un lugar donde se atiende psicología no es un detalle menor.
 */
export default function RecoverScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (busy) return;

    if (!EMAIL.test(email.trim())) {
      setError("Ese email no parece válido. Revisá que tenga @ y un punto");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await requestPasswordMail(email);
      setSent(true);
    } catch (problem) {
      setError(errorMessage(problem, "No pudimos mandar el mail. Probá de nuevo en un rato"));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen scroll={false} style={styles.centered}>
        <EmptyState
          icon="envelope-circle-check"
          title="Si esa cuenta existe, ya salió el mail"
          description="Adentro hay un link para elegir una contraseña nueva. Dura una hora. Fijate también en el correo no deseado."
          action={{ label: "Volver a entrar", onPress: () => router.replace("/(auth)/login") }}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <AppText variant="small" tone="muted" style={styles.lead}>
          Poné el email con el que entrás y te mandamos un link para elegir una contraseña nueva.
        </AppText>

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
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={submit}
            error={error}
          />

          <Button label="Mandarme el link" onPress={submit} loading={busy} block />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: "center" },
  lead: { marginTop: space.xl },
  form: { marginTop: space.xl, gap: space.lg },
});
