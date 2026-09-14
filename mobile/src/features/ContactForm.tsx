import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../api/client";
import { sendContactMessage } from "../api/misc";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { Field } from "../components/Field";
import { useFeedback } from "../components/Feedback";
import { EmptyState } from "../components/States";
import { Note } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { OFFICE_INFO } from "../lib/specialities";
import { radius, SCREEN_PADDING, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";


/**
 * Motivos posibles. La lista es cerrada y coincide con la del backend: el asunto del
 * mail se arma con esto, así la casilla del consultorio queda ordenada sola en vez de
 * llenarse de "Consulta" a secas.
 */
const REASONS = [
  { key: "turnos", label: "Turnos", description: "Solicitudes, cambios y cancelaciones." },
  { key: "profesional", label: "Quiero trabajar acá", description: "Profesionales interesados en sumarse al consultorio." },
  { key: "sugerencia", label: "Sugerencia o reclamo", description: "Propuestas de mejora o reclamos." },
  { key: "otro", label: "Otra consulta", description: "Otros temas." },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 2000;

/** Escribirle al consultorio. Se llega desde la sesión y también desde el login. */
export function ContactForm({ standalone, defaultEmail }: { standalone?: boolean; defaultEmail?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();

  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const applying = reason === "profesional";

  function validate(): boolean {
    const found: Record<string, string | null> = {
      reason: reason ? null : "Falta elegir el motivo",
      name: name.trim().length >= 2 ? null : "Falta el nombre",
      email: EMAIL.test(email.trim()) ? null : "Formato de email inválido. Debe incluir @ y un punto",
      // A un profesional se lo llama para la entrevista: igual que en la página y en el backend.
      phone:
        applying && !phone.trim()
          ? "Falta el teléfono"
          : !phone.trim() || /^[\d\s()+-]{6,30}$/.test(phone.trim())
            ? null
            : "Formato de teléfono inválido",
      message:
        message.trim().length < MIN_MESSAGE
          ? "El mensaje es demasiado corto"
          : message.trim().length > MAX_MESSAGE
            ? "El mensaje supera el máximo de caracteres"
            : null,
    };

    setErrors(found);
    return Object.values(found).every((value) => !value);
  }

  async function submit() {
    if (sending || !validate()) return;

    setSending(true);

    try {
      await sendContactMessage({ reason, name, email, phone, message });
      setSent(true);
    } catch (problem) {
      feedback.problem(errorMessage(problem, "No se pudo enviar el mensaje"));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View style={[styles.done, { backgroundColor: colors.bg, paddingTop: standalone ? insets.top : 0 }]}>
        <EmptyState
          icon="envelope-circle-check"
          title="Mensaje enviado"
          description={`La respuesta llega por mail. El consultorio atiende ${OFFICE_INFO.hours.toLowerCase()}.`}
          action={{ label: "Escribir otra consulta", onPress: () => { setSent(false); setMessage(""); setReason(""); } }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[
          styles.page,
          { paddingTop: standalone ? insets.top + space.lg : space.lg, paddingBottom: insets.bottom + space.xxxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {standalone ? <AppText variant="display">Contacto</AppText> : null}

        <AppText variant="small" tone="muted" style={styles.lead}>
          Respuesta por mail dentro de las 48 horas hábiles.
        </AppText>

        <View style={styles.form}>
          <Choice label="Motivo" options={REASONS} value={reason} onChange={setReason} />
          {errors.reason ? (
            <AppText variant="caption" tone="danger">
              {errors.reason}
            </AppText>
          ) : null}

          <Field
            label="Nombre y apellido"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            error={errors.name}
            required
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="nombre@mail.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            required
          />

          <Field
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            placeholder="341 555 5555"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            hint={applying ? "Para coordinar una entrevista." : "Opcional, para recibir un llamado."}
            error={errors.phone}
            required={applying}
          />

          <View style={styles.messageBlock}>
            <AppText variant="caption" tone="muted" chrome>
              Mensaje *
            </AppText>

            <TextInput
              value={message}
              onChangeText={(value) => setMessage(value.slice(0, MAX_MESSAGE))}
              placeholder={applying ? "Presentación y experiencia" : "Detalle de la consulta"}
              placeholderTextColor={colors.muted}
              selectionColor={colors.green}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Mensaje"
              style={[
                styles.message,
                {
                  backgroundColor: colors.surface,
                  borderColor: errors.message ? colors.danger : colors.border,
                  color: colors.text,
                },
              ]}
            />

            {errors.message ? (
              <AppText variant="caption" tone="danger">
                {errors.message}
              </AppText>
            ) : (
              <AppText variant="caption" tone="muted">
                {message.trim().length} de {MAX_MESSAGE} caracteres
              </AppText>
            )}
          </View>

          <Button label="Enviar" onPress={submit} loading={sending} block />

          <Note>
            {OFFICE_INFO.address} · {OFFICE_INFO.hours}
          </Note>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingHorizontal: SCREEN_PADDING },
  lead: { marginTop: space.xs },
  form: { marginTop: space.xl, gap: space.lg },
  messageBlock: { gap: space.xs },
  message: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    lineHeight: 22,
  },
  done: { flex: 1, justifyContent: "center" },
});
