import { Linking, StyleSheet, View } from "react-native";
import { Person } from "../api/types";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Group, Row } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { gmailToPatientUrl, prettyPhone, whatsappUrl } from "../lib/contactPatient";
import { space } from "../theme/tokens";

interface Props {
  patient: Person | null;
  /** Quién escribe: su nombre firma el borrador del mail. */
  professional?: { name?: string; surname?: string; email: string };
  onClose: () => void;
}

/**
 * Cómo ubicar a un paciente.
 *
 * Los datos siempre estuvieron en la ficha, pero para llamar a alguien había que entrar,
 * buscar el teléfono y copiarlo a mano. Acá los dos que sirven para eso están solos y se
 * tocan, que desde un teléfono es la diferencia entre tener el dato y poder usarlo.
 */
export function ContactPatientSheet({ patient, professional, onClose }: Props) {
  if (!patient) return null;

  const digits = (patient.phoneNumber ?? "").replace(/\D/g, "");
  const whatsapp = whatsappUrl(patient.phoneNumber);
  const phone = prettyPhone(patient.phoneNumber);

  return (
    <Sheet visible onClose={onClose} title={`${patient.name} ${patient.surname}`}>
      <Group>
        <Row title="Email" value={patient.email} />
        <Row title="Teléfono" value={phone ?? "Sin cargar"} last />
      </Group>

      <View style={styles.actions}>
        <Button
          label="Escribirle un mail"
          icon="envelope"
          block
          onPress={() => {
            void Linking.openURL(gmailToPatientUrl(patient, professional));
            onClose();
          }}
        />

        {digits.length === 10 ? (
          <>
            <Button
              label="Llamarlo"
              icon="phone"
              variant="secondary"
              block
              onPress={() => {
                void Linking.openURL(`tel:+549${digits}`);
                onClose();
              }}
            />

            {whatsapp ? (
              <Button
                label="WhatsApp"
                icon="whatsapp"
                variant="secondary"
                block
                onPress={() => {
                  void Linking.openURL(whatsapp);
                  onClose();
                }}
              />
            ) : null}
          </>
        ) : (
          <AppText variant="caption" tone="muted">
            No tiene teléfono cargado. Podés agregárselo desde su ficha.
          </AppText>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: space.lg, gap: space.sm },
});
