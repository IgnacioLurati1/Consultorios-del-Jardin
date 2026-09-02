import { Linking, StyleSheet, View } from "react-native";
import { Person } from "../api/types";
import { Button } from "../components/Button";
import { Sheet } from "../components/Sheet";
import { Group, Row } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { gmailComposeUrl } from "../lib/contactProfessional";
import { space } from "../theme/tokens";

/**
 * La ficha del profesional, antes de elegir horario.
 *
 * Es lo único de la pantalla que escribió una persona y no el sistema, así que va primero
 * y con el resto de los datos abajo. La mitad de las preguntas que llegan por teléfono
 * —obra social, precio, primera consulta— se contestan acá o con el botón de escribirle.
 */
export function AboutProfessional({
  visible,
  onClose,
  professional,
  patient,
}: {
  visible: boolean;
  onClose: () => void;
  professional: Person | null;
  /** Quién está mirando: su nombre y su email van en el mensaje. */
  patient?: Person | null;
}) {
  if (!professional) return null;

  return (
    <Sheet visible={visible} onClose={onClose} title={`${professional.name} ${professional.surname}`}>
      <View style={styles.body}>
        {professional.about ? (
          <AppText variant="body">{professional.about}</AppText>
        ) : (
          <AppText variant="small" tone="muted">
            Todavía no escribió su presentación.
          </AppText>
        )}

        <Group>
          <Row title="Especialidad" value={professional.speciality || "Sin cargar"} />
          <Row title="Email" value={professional.email} last />
        </Group>

        <Button
          label="Contactar"
          icon="envelope"
          block
          onPress={() => Linking.openURL(gmailComposeUrl(professional, patient ?? undefined))}
        />

        <AppText variant="caption" tone="muted">
          Abre Gmail con un mensaje ya escrito. Podés cambiarlo antes de mandarlo.
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingBottom: space.md },
});
