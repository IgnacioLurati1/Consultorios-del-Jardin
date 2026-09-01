import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../api/client";
import { isEmailAvailable } from "../../api/people";
import { Button } from "../../components/Button";
import { Choice } from "../../components/Choice";
import { Field, PickerField } from "../../components/Field";
import { useFeedback } from "../../components/Feedback";
import { OptionSheet } from "../../components/Sheet";
import { Note } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { DOC_TYPES, SPECIALITIES } from "../../lib/specialities";
import { useSession } from "../../session/SessionProvider";
import { SCREEN_PADDING, space } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * Crear cuenta. Se puede entrar como paciente o pedir sumarse como profesional; en ese
 * segundo caso la cuenta queda a la espera de que el admin la habilite, y eso se dice
 * antes de que llene el formulario, no después de mandarlo.
 */
export default function SignUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const { signUp } = useSession();

  const [type, setType] = useState<"client" | "professional">("client");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  const [docSheet, setDocSheet] = useState(false);
  const [specialitySheet, setSpecialitySheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function validate(): Promise<boolean> {
    const found: Record<string, string | null> = {
      name: name.trim().length >= 2 ? null : "Escribí tu nombre",
      surname: surname.trim().length >= 2 ? null : "Escribí tu apellido",
      email: EMAIL.test(email.trim()) ? null : "Ese email no parece válido",
      docNumber: /^\d{6,10}$/.test(docNumber.trim()) ? null : "El documento va sin puntos ni espacios",
      phoneNumber: /^[\d\s()+-]{6,30}$/.test(phoneNumber.trim()) ? null : "Ese teléfono no parece válido",
      speciality: type === "professional" && !speciality ? "Elegí tu especialidad" : null,
      password: password.length >= MIN_PASSWORD ? null : `La contraseña necesita al menos ${MIN_PASSWORD} caracteres`,
      repeat: password === repeat ? null : "Las dos contraseñas tienen que ser iguales",
    };

    // Preguntar por el email antes de mandar el formulario evita que la persona lo
    // complete entero para enterarse al final de que ya tiene cuenta.
    if (!found.email) {
      try {
        if (!(await isEmailAvailable(email.trim().toLowerCase()))) {
          found.email = "Ya hay una cuenta con ese email. Probá iniciar sesión.";
        }
      } catch {
        // Si no se puede consultar, que decida el backend al crear la cuenta.
      }
    }

    setErrors(found);
    return Object.values(found).every((value) => !value);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);

    try {
      if (!(await validate())) return;

      await signUp({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        docType,
        docNumber: docNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
        type,
        ...(type === "professional" ? { speciality } : {}),
      });

      if (type === "professional") {
        feedback.done("Creamos tu cuenta. Queda esperando que la habiliten.");
      } else {
        feedback.done("Listo, ya tenés cuenta");
      }

      router.replace("/(app)/(tabs)");
    } catch (problem) {
      feedback.problem(errorMessage(problem, "No pudimos crear la cuenta"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Choice
            label="¿Cómo entrás?"
            options={[
              { key: "client", label: "Como paciente", description: "Para pedir turnos y ver los tuyos." },
              { key: "professional", label: "Como profesional", description: "Para atender en el consultorio." },
            ]}
            value={type}
            onChange={(key) => setType(key as "client" | "professional")}
          />

          {type === "professional" ? (
            <Note tone="warn">
              La cuenta queda creada pero deshabilitada hasta que el consultorio la apruebe. Te avisamos por mail
              cuando puedas empezar a usarla.
            </Note>
          ) : null}

          <Field
            label="Nombre"
            value={name}
            onChangeText={setName}
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            error={errors.name}
            required
          />

          <Field
            label="Apellido"
            value={surname}
            onChangeText={setSurname}
            autoComplete="family-name"
            textContentType="familyName"
            autoCapitalize="words"
            error={errors.surname}
            required
          />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tunombre@mail.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            required
          />

          <View style={styles.docRow}>
            <View style={styles.docType}>
              <PickerField label="Tipo" value={docType} placeholder="DNI" onPress={() => setDocSheet(true)} />
            </View>

            <View style={styles.docNumber}>
              <Field
                label="Número de documento"
                value={docNumber}
                onChangeText={setDocNumber}
                keyboardType="number-pad"
                error={errors.docNumber}
                required
              />
            </View>
          </View>

          <Field
            label="Teléfono"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="341 555 5555"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phoneNumber}
            required
          />

          {type === "professional" ? (
            <PickerField
              label="Especialidad"
              value={speciality}
              placeholder="Elegir una especialidad"
              onPress={() => setSpecialitySheet(true)}
              error={errors.speciality}
              required
            />
          ) : null}

          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            hint={`Al menos ${MIN_PASSWORD} caracteres.`}
            error={errors.password}
            required
          />

          <Field
            label="Repetir la contraseña"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            error={errors.repeat}
            required
          />

          <Button label="Crear la cuenta" onPress={submit} loading={busy} block />

          <AppText variant="caption" tone="muted">
            Al crear la cuenta vas a recibir por mail los avisos de tus turnos.
          </AppText>
        </View>
      </ScrollView>

      <OptionSheet
        visible={docSheet}
        onClose={() => setDocSheet(false)}
        title="Tipo de documento"
        options={DOC_TYPES.map((item) => ({ key: item, label: item }))}
        selected={docType}
        onSelect={setDocType}
      />

      <OptionSheet
        visible={specialitySheet}
        onClose={() => setSpecialitySheet(false)}
        title="Tu especialidad"
        options={SPECIALITIES.map((item) => ({ key: item, label: item }))}
        selected={speciality}
        onSelect={setSpeciality}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingHorizontal: SCREEN_PADDING, paddingTop: space.xl },
  form: { gap: space.lg },
  docRow: { flexDirection: "row", gap: space.md },
  docType: { width: 110 },
  docNumber: { flex: 1 },
});
