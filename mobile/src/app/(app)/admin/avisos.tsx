import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import {
  allAnnouncements,
  Announcement,
  AnnouncementChannel,
  AnnouncementLevel,
  deleteAnnouncement,
  publishAnnouncement,
  setAnnouncementActive,
} from "../../../api/announcements";
import { errorMessage } from "../../../api/client";
import { Button } from "../../../components/Button";
import { ChipRow, Tag } from "../../../components/Chip";
import { Choice } from "../../../components/Choice";
import { Field } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { Screen } from "../../../components/Screen";
import { DataState, EmptyState } from "../../../components/States";
import { Group, Note, Row, Section } from "../../../components/Surfaces";
import { AppText } from "../../../components/Text";
import { AnnouncementCard } from "../../../features/Announcements";
import { useAsync } from "../../../lib/useAsync";
import { radius, space } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

const MAX_TITLE = 80;
const MAX_BODY = 500;

type Audience = Announcement["audience"];

/** Los tres colores, nombrados por lo que significan y no por el color que son. */
const LEVELS: { key: AnnouncementLevel; label: string; description: string }[] = [
  { key: "error", label: "Error crítico", description: "Algo está roto o no se puede usar" },
  { key: "warning", label: "Advertencia", description: "Hay que tenerlo en cuenta" },
  { key: "news", label: "Novedad", description: "Algo nuevo o que cambió" },
];

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "client", label: "Pacientes" },
  { key: "professional", label: "Profesionales" },
  { key: "both", label: "Los dos" },
];

const CHANNELS: { key: AnnouncementChannel; label: string }[] = [
  { key: "banner", label: "En el panel" },
  { key: "notification", label: "Notificación" },
  { key: "both", label: "Las dos" },
];

const CHANNEL_HINT: Record<AnnouncementChannel, string> = {
  banner: "Aparece arriba del panel al entrar.",
  notification: "Suena el teléfono de quien tenga la app instalada y las notificaciones prendidas.",
  both: "Suena el teléfono y además queda arriba del panel.",
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  client: "Pacientes",
  professional: "Profesionales",
  both: "Pacientes y profesionales",
};

const CHANNEL_LABEL: Record<AnnouncementChannel, string> = {
  banner: "en el panel",
  notification: "como notificación",
  both: "en el panel y como notificación",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Donde el admin escribe lo que tiene que saber todo el mundo. Es el mismo cartel del
 * panel de la página.
 *
 * La vista previa no es un adorno: el aviso se ve distinto según el color que lleve, y
 * elegir "error crítico" para algo que era una novedad es la clase de error que solo se
 * nota cuando ya lo vieron todos. Acá se ve antes de publicarlo.
 */
export default function AnnouncementsAdminScreen() {
  const { colors } = useTheme();
  const feedback = useFeedback();
  const list = useAsync(allAnnouncements, []);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("news");
  const [audience, setAudience] = useState<Audience>("both");
  const [channel, setChannel] = useState<AnnouncementChannel>("banner");
  const [errors, setErrors] = useState<{ title: string | null; body: string | null }>({ title: null, body: null });
  const [saving, setSaving] = useState(false);

  async function publish() {
    if (saving) return;

    const found = { title: title.trim() ? null : "Falta el título", body: body.trim() ? null : "Falta el texto" };
    setErrors(found);
    if (found.title || found.body) return;

    setSaving(true);

    try {
      await publishAnnouncement({ title: title.trim(), body: body.trim(), level, audience, channel });
      setTitle("");
      setBody("");
      feedback.done("Aviso publicado");
      list.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(announcement: Announcement) {
    try {
      const updated = await setAnnouncementActive(announcement.id, !announcement.active);
      feedback.done(updated.active ? "Volvió a estar arriba" : "Aviso bajado");
      list.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    }
  }

  async function remove(announcement: Announcement) {
    try {
      await deleteAnnouncement(announcement.id);
      feedback.done("Aviso borrado");
      list.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    }
  }

  function manage(announcement: Announcement) {
    Alert.alert(
      announcement.title,
      announcement.active
        ? "Publicado. Bajarlo lo saca de la vista de todos, y se puede volver a subir."
        : "Bajado. Se puede volver a subir.",
      [
        { text: announcement.active ? "Bajar" : "Volver a subir", onPress: () => toggle(announcement) },
        { text: "Borrar", style: "destructive", onPress: () => remove(announcement) },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  }

  const announcements = list.data ?? [];

  return (
    <Screen onRefresh={list.refresh} refreshing={list.refreshing}>
      <Section title="Cargar un aviso">
        <View style={styles.form}>
          <Field
            label="Título"
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE}
            placeholder="El jueves no hay atención"
            error={errors.title}
            required
          />

          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Texto *
            </AppText>
            <TextInput
              value={body}
              onChangeText={(value) => setBody(value.slice(0, MAX_BODY))}
              placeholder="Qué pasa y qué tiene que hacer quien lo lee"
              placeholderTextColor={colors.muted}
              selectionColor={colors.green}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Texto del aviso"
              style={[
                styles.body,
                { backgroundColor: colors.surface, borderColor: errors.body ? colors.danger : colors.border, color: colors.text },
              ]}
            />
            <AppText variant="caption" tone={errors.body ? "danger" : "muted"}>
              {errors.body ?? `${MAX_BODY - body.length} caracteres disponibles.`}
            </AppText>
          </View>

          <Choice label="Importancia" options={LEVELS} value={level} onChange={(key) => setLevel(key as AnnouncementLevel)} />

          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Destinatarios
            </AppText>
            <ChipRow options={AUDIENCES} value={audience} onChange={setAudience} />
          </View>

          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Canal
            </AppText>
            <ChipRow options={CHANNELS} value={channel} onChange={setChannel} />
            <AppText variant="caption" tone="muted">
              {CHANNEL_HINT[channel]}
            </AppText>
          </View>

          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Vista previa
            </AppText>
            <AnnouncementCard title={title.trim() || "Título del aviso"} body={body.trim() || "Texto del aviso."} level={level} />
            <AppText variant="caption" tone="muted">
              Lo ven {AUDIENCE_LABEL[audience].toLowerCase()}, {CHANNEL_LABEL[channel]}. Cada persona lo puede cerrar y no le
              vuelve a aparecer.
            </AppText>
          </View>

          <Button label="Publicar" icon="bullhorn" block loading={saving} onPress={publish} />
        </View>
      </Section>

      <Section title="Avisos cargados">
        <DataState
          loading={list.loading}
          error={list.error}
          empty={announcements.length === 0}
          onRetry={list.reload}
          emptyState={<EmptyState compact icon="bullhorn" title="Sin avisos cargados" description="Los avisos publicados aparecen acá." />}
        >
          <Group>
            {announcements.map((announcement, index) => (
              <Row
                key={announcement.id}
                title={announcement.title}
                subtitle={`${AUDIENCE_LABEL[announcement.audience]} · ${shortDate(announcement.createdAt)}`}
                subtitleIsData
                right={<Tag label={announcement.active ? "Publicado" : "Bajado"} tone={announcement.active ? "green" : "neutral"} />}
                last={index === announcements.length - 1}
                onPress={() => manage(announcement)}
              />
            ))}
          </Group>

          <View style={styles.note}>
            <Note>Cada aviso se toca para bajarlo, volver a subirlo o borrarlo.</Note>
          </View>
        </DataState>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  block: { gap: space.xs },
  body: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    lineHeight: 22,
  },
  note: { marginTop: space.md },
});
