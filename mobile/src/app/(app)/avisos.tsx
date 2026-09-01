import { useState } from "react";
import { Linking, View } from "react-native";
import { Choice } from "../../components/Choice";
import { Screen } from "../../components/Screen";
import { Note, Section } from "../../components/Surfaces";
import { AppText } from "../../components/Text";
import { AlertChoice, choiceOf } from "../../lib/alerts";
import { ALERT_OPTIONS, useAlerts } from "../../session/AlertsProvider";
import { space } from "../../theme/tokens";

/**
 * Cómo avisamos antes de cada turno.
 *
 * Es la misma pregunta que sale la primera vez, para poder cambiar de opinión. Muestra
 * cuántos avisos hay programados: sin eso no habría forma de saber si quedó andando,
 * porque la prueba recién llegaría cinco minutos antes del próximo turno.
 */
export default function AlertsScreen() {
  const { prefs, scheduled, allowed, choose } = useAlerts();
  const [saving, setSaving] = useState(false);

  async function pick(key: string) {
    setSaving(true);
    try {
      await choose(key as AlertChoice);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Section>
        <AppText variant="small" tone="muted">
          Cinco minutos antes de cada turno te decimos con quién es y a qué hora.
        </AppText>
      </Section>

      <Section>
        <Choice label="Cómo te avisamos" options={ALERT_OPTIONS} value={choiceOf(prefs)} onChange={pick} />
      </Section>

      {!allowed && prefs.notify ? (
        <Section>
          <Note tone="warn">
            El teléfono tiene los avisos bloqueados para esta app, así que no va a llegar ninguno. Se prende desde
            los ajustes del sistema.
          </Note>
          <View style={{ marginTop: space.md }}>
            <AppText variant="small" tone="green" onPress={() => Linking.openSettings()}>
              Abrir los ajustes del teléfono
            </AppText>
          </View>
        </Section>
      ) : null}

      <Section title="Estado">
        <Note>
          {saving
            ? "Reprogramando los avisos…"
            : !prefs.notify
              ? "No vas a recibir avisos."
              : scheduled === 0
                ? "No hay turnos en los próximos siete días para avisar."
                : `${scheduled} ${scheduled === 1 ? "aviso programado" : "avisos programados"} para los próximos siete días.`}
        </Note>
      </Section>

      <Section>
        <AppText variant="caption" tone="muted">
          Los programa este teléfono, así que llegan aunque no tengas señal.
        </AppText>
      </Section>
    </Screen>
  );
}
