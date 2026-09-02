import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { registerProfessional } from "../../../api/people";
import { Button } from "../../../components/Button";
import { Field, PickerField } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { OptionSheet } from "../../../components/Sheet";
import { Note } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { DOC_TYPES, SPECIALITIES } from "../../../lib/specialities";
import { space } from "../../../theme/tokens";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** El mismo tope que valida el backend. */
const ABOUT_MAX = 600;

/**
 * Alta de un profesional hecha por el admin. La cuenta nace habilitada, a diferencia de
 * la que se crea desde el registro público, que queda esperando aprobación.
 *
 * Va por su propia ruta del backend y no por el registro: ese devuelve tokens, y el
 * admin terminaría con la sesión del profesional que acaba de crear.
 */
export default function NewProfessionalScreen() {
  const feedback = useFeedback();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [about, setAbout] = useState("");
  const [password, setPassword] = useState("");

  const [docSheet, setDocSheet] = useState(false);
  const [specialitySheet, setSpecialitySheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;

    const found = {
      name: name.trim().length >= 2 ? null : "Escribí el nombre",
      surname: surname.trim().length >= 2 ? null : "Escribí el apellido",
      email: EMAIL.test(email.trim()) ? null : "Ese email no parece válido",
      docNumber: /^\d{6,10}$/.test(docNumber.trim()) ? null : "El documento va sin puntos ni espacios",
      phoneNumber: /^[\d\s()+-]{6,30}$/.test(phoneNumber.trim()) ? null : "Ese teléfono no parece válido",
      speciality: speciality ? null : "Elegí la especialidad",
      password: password.length >= MIN_PASSWORD ? null : `La contraseña necesita al menos ${MIN_PASSWORD} caracteres`,
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);

    try {
      await registerProfessional({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim().toLowerCase(),
        docType,
        docNumber: docNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        speciality,
        about: about.trim() || undefined,
        password,
      });

      feedback.done("Cuenta creada y habilitada");
      router.back();
    } catch (problem) {
      setErrors({ email: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <AppText variant="small" tone="muted" style={styles.lead}>
          La cuenta queda habilitada de entrada. Después el profesional carga sus horarios de atención.
        </AppText>

        <View style={styles.form}>
          <Field label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" error={errors.name} required />
          <Field label="Apellido" value={surname} onChangeText={setSurname} autoCapitalize="words" error={errors.surname} required />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="profesional@mail.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
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
              <Field label="Documento" value={docNumber} onChangeText={setDocNumber} keyboardType="number-pad" error={errors.docNumber} required />
            </View>
          </View>

          <Field
            label="Teléfono"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={errors.phoneNumber}
            required
          />

          <PickerField
            label="Especialidad"
            value={speciality}
            placeholder="Elegir una especialidad"
            onPress={() => setSpecialitySheet(true)}
            error={errors.speciality}
            required
          />

          <Field
            label="Acerca de mí"
            value={about}
            onChangeText={setAbout}
            multiline
            numberOfLines={4}
            maxLength={ABOUT_MAX}
            autoCapitalize="sentences"
            placeholder="Con qué trabaja, con qué enfoque, a quiénes atiende…"
            hint={`Opcional. Es lo que lee el paciente antes de elegir. ${about.length}/${ABOUT_MAX}`}
          />

          <Field
            label="Contraseña provisoria"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            hint={`Al menos ${MIN_PASSWORD} caracteres.`}
            error={errors.password}
            required
          />

          <Note>
            Pasale la contraseña por un canal seguro y decile que la cambie desde "Mis datos" apenas entre.
          </Note>

          <Button label="Crear la cuenta" onPress={save} loading={busy} block />
        </View>
      </Screen>

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
        title="Especialidad"
        options={SPECIALITIES.map((item) => ({ key: item, label: item }))}
        selected={speciality}
        onSelect={setSpeciality}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lead: { marginTop: space.lg },
  form: { marginTop: space.xl, gap: space.lg },
  docRow: { flexDirection: "row", gap: space.md },
  docType: { width: 110 },
  docNumber: { flex: 1 },
});
