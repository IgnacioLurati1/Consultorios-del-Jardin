import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import { createAnonymousPatient } from "../../api/people";
import { Button } from "../../components/Button";
import { Field, PickerField } from "../../components/Field";
import { useFeedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { OptionSheet } from "../../components/Sheet";
import { Note } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { DOC_TYPES } from "../../lib/specialities";
import { space } from "../../theme/tokens";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Alta de un paciente sin cuenta. Sirve para darle turno a alguien que no se registró:
 * queda cargado a nombre del profesional que lo dio de alta, y si más adelante esa
 * persona se registra con el mismo email, la cuenta pasa a ser suya.
 */
export default function NewPatientScreen() {
  const feedback = useFeedback();

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;

    const found = {
      name: name.trim().length >= 2 ? null : "Escribí el nombre",
      surname: surname.trim().length >= 2 ? null : "Escribí el apellido",
      email: EMAIL.test(email.trim()) ? null : "Hace falta un email válido para identificarlo",
      docNumber: !docNumber.trim() || /^\d{6,10}$/.test(docNumber.trim()) ? null : "El documento va sin puntos ni espacios",
      phoneNumber: !phoneNumber.trim() || /^[\d\s()+-]{6,30}$/.test(phoneNumber.trim()) ? null : "Ese teléfono no parece válido",
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);

    try {
      await createAnonymousPatient({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim().toLowerCase(),
        docType,
        docNumber: docNumber.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      feedback.done("Paciente cargado");
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
          Para darle turno a alguien que no tiene cuenta en la app.
        </AppText>

        <View style={styles.form}>
          <Field label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" textContentType="givenName" error={errors.name} required />
          <Field label="Apellido" value={surname} onChangeText={setSurname} autoCapitalize="words" textContentType="familyName" error={errors.surname} required />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="paciente@mail.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Es lo que lo identifica, aunque no reciba mails."
            error={errors.email}
            required
          />

          <View style={styles.docRow}>
            <View style={styles.docType}>
              <PickerField label="Tipo" value={docType} placeholder="DNI" onPress={() => setSheet(true)} />
            </View>
            <View style={styles.docNumber}>
              <Field label="Documento" value={docNumber} onChangeText={setDocNumber} keyboardType="number-pad" error={errors.docNumber} />
            </View>
          </View>

          <Field
            label="Teléfono"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="341 555 5555"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={errors.phoneNumber}
          />

          <Note tone="warn">
            No le llegan mails de confirmación ni recordatorios. De los avisos te encargás vos.
          </Note>

          <Button label="Cargar el paciente" onPress={save} loading={busy} block />
        </View>
      </Screen>

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Tipo de documento"
        options={DOC_TYPES.map((item) => ({ key: item, label: item }))}
        selected={docType}
        onSelect={setDocType}
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
