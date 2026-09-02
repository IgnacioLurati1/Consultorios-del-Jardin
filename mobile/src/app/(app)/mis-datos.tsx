import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { errorMessage } from "../../api/client";
import { findPerson, requestPasswordMail, updatePerson } from "../../api/people";
import { Button } from "../../components/Button";
import { Field, PickerField } from "../../components/Field";
import { useFeedback } from "../../components/Feedback";
import { Screen } from "../../components/Screen";
import { OptionSheet } from "../../components/Sheet";
import { ErrorState, Loading } from "../../components/States";
import { Group, Row, Section } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { DOC_TYPES } from "../../lib/specialities";
import { useAsync } from "../../lib/useAsync";
import { useSession, useUser } from "../../session/SessionProvider";
import { space } from "../../theme/tokens";

/**
 * Los datos propios. El email no se edita: es la clave con la que existe la persona en
 * todo el sistema. La contraseña tampoco se cambia acá, se pide por mail: así el que
 * agarra un teléfono desbloqueado no puede quedarse con la cuenta.
 */
/** El mismo tope que valida el backend. */
const ABOUT_MAX = 600;

export default function MyDataScreen() {
  const { email, role } = useUser();
  const { signOut } = useSession();
  const feedback = useFeedback();

  const person = useAsync(() => findPerson(email), [email]);

  const [name, setName] = useState<string | null>(null);
  const [surname, setSurname] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [docType, setDocType] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState<string | null>(null);
  const [about, setAbout] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  if (person.loading) return <Loading label="Buscando tus datos" />;

  if (person.error || !person.data) {
    return (
      <Screen>
        <ErrorState message={person.error ?? "No pudimos traer tus datos"} onRetry={person.reload} />
      </Screen>
    );
  }

  const saved = person.data;

  // Se edita sobre lo guardado: mientras no se toque un campo, vale lo que vino del servidor.
  const form = {
    name: name ?? saved.name,
    surname: surname ?? saved.surname,
    phoneNumber: phoneNumber ?? saved.phoneNumber ?? "",
    docType: docType ?? saved.docType ?? "DNI",
    docNumber: docNumber ?? saved.docNumber ?? "",
    about: about ?? saved.about ?? "",
  };

  const changed =
    form.name !== saved.name ||
    form.surname !== saved.surname ||
    form.phoneNumber !== (saved.phoneNumber ?? "") ||
    form.docType !== (saved.docType ?? "DNI") ||
    form.docNumber !== (saved.docNumber ?? "") ||
    form.about !== (saved.about ?? "");

  async function save() {
    if (busy) return;

    const found = {
      name: form.name.trim().length >= 2 ? null : "El nombre no puede quedar vacío",
      surname: form.surname.trim().length >= 2 ? null : "El apellido no puede quedar vacío",
      phoneNumber: /^[\d\s()+-]{6,30}$/.test(form.phoneNumber.trim()) ? null : "Ese teléfono no parece válido",
      docNumber: /^\d{6,10}$/.test(form.docNumber.trim()) ? null : "El documento va sin puntos ni espacios",
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);

    try {
      await updatePerson(email, {
        name: form.name.trim(),
        surname: form.surname.trim(),
        phoneNumber: form.phoneNumber.trim(),
        docType: form.docType,
        docNumber: form.docNumber.trim(),
        // Solo la manda el profesional: es la única ficha que un paciente puede llegar a leer.
        ...(role === "professional" ? { about: form.about.trim() } : {}),
      });

      feedback.done("Guardamos tus datos");
      person.reload();
      setName(null);
      setSurname(null);
      setPhoneNumber(null);
      setDocType(null);
      setDocNumber(null);
      setAbout(null);
    } catch (problem) {
      setErrors({ name: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  function askForPasswordMail() {
    Alert.alert("Cambiar la contraseña", `Te mandamos un link a ${email} para elegir una nueva.`, [
      { text: "Ahora no", style: "cancel" },
      {
        text: "Mandarlo",
        onPress: async () => {
          try {
            await requestPasswordMail(email);
            feedback.done("Salió el mail. Fijate también en el correo no deseado.");
          } catch (problem) {
            feedback.problem(errorMessage(problem));
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen onRefresh={person.refresh} refreshing={person.refreshing}>
        <View style={styles.form}>
          <Field label="Nombre" value={form.name} onChangeText={setName} autoCapitalize="words" error={errors.name} required />
          <Field label="Apellido" value={form.surname} onChangeText={setSurname} autoCapitalize="words" error={errors.surname} required />

          <View style={styles.docRow}>
            <View style={styles.docType}>
              <PickerField label="Tipo" value={form.docType} placeholder="DNI" onPress={() => setSheet(true)} />
            </View>
            <View style={styles.docNumber}>
              <Field label="Documento" value={form.docNumber} onChangeText={setDocNumber} keyboardType="number-pad" error={errors.docNumber} required />
            </View>
          </View>

          <Field
            label="Teléfono"
            value={form.phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={errors.phoneNumber}
            required
          />

          {role === "professional" ? (
            <Field
              label="Acerca de mí"
              value={form.about}
              onChangeText={setAbout}
              multiline
              numberOfLines={5}
              maxLength={ABOUT_MAX}
              autoCapitalize="sentences"
              placeholder="Con qué trabajás, con qué enfoque, a quiénes atendés…"
              hint={`Lo lee el paciente antes de elegir con quién atenderse. ${form.about.length}/${ABOUT_MAX}`}
            />
          ) : null}

          <Button label="Guardar" onPress={save} loading={busy} disabled={!changed} block />
        </View>

        <Section title="Tu cuenta">
          <Group>
            <Row title="Email" value={email} />
            <Row
              title={role === "professional" ? "Especialidad" : "Tipo de cuenta"}
              value={role === "professional" ? saved.speciality || "Sin cargar" : role === "admin" ? "Administración" : "Paciente"}
            />
            <Row title="Cambiar la contraseña" subtitle="Te llega un link por mail" icon="key" last onPress={askForPasswordMail} />
          </Group>

          <AppText variant="caption" tone="muted" style={styles.footnote}>
            El email no se puede cambiar: es con lo que te identifica todo el sistema. Si necesitás otro, escribinos.
          </AppText>
        </Section>

        <Section>
          <Button
            label="Cerrar sesión"
            variant="danger"
            block
            onPress={() =>
              Alert.alert("Cerrar sesión", "Vas a tener que volver a entrar con tu email y contraseña.", [
                { text: "Quedarme", style: "cancel" },
                { text: "Cerrar sesión", style: "destructive", onPress: () => signOut() },
              ])
            }
          />
        </Section>
      </Screen>

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Tipo de documento"
        options={DOC_TYPES.map((item) => ({ key: item, label: item }))}
        selected={form.docType}
        onSelect={setDocType}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  form: { marginTop: space.xl, gap: space.lg },
  docRow: { flexDirection: "row", gap: space.md },
  docType: { width: 110 },
  docNumber: { flex: 1 },
  footnote: { marginTop: space.md },
});
