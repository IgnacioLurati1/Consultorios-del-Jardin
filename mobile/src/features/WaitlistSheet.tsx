import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { errorMessage } from "../api/client";
import { Person } from "../api/types";
import { joinWaitlist, leaveWaitlist, WaitlistStatus, waitlistStatus } from "../api/waitlist";
import { Button } from "../components/Button";
import { tapFeedback, useFeedback } from "../components/Feedback";
import { PickerField } from "../components/Field";
import { OptionSheet, Sheet } from "../components/Sheet";
import { SkeletonList } from "../components/States";
import { Group, Note, Row } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { hhmm, longDate } from "../lib/dates";
import { blockReason, describeDays, describeDaysTitle, formatMoment, formProblem, hourOptions, WEEK_DAYS } from "../lib/waitlist";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

const HOURS = hourOptions();

/**
 * La lista de espera de un profesional, del lado de quien pide turno. Es la misma que la
 * ventana de la página.
 *
 * Es el mismo panel para anotarse y para volver a mirar: si ya está anotado, muestra en
 * qué quedó —hasta cuándo, cuántos avisos llegaron y de qué horarios— y deja salir.
 *
 * El estado se pide cada vez que se abre, y otra vez justo antes de anotar. Anotarse más
 * veces de las que permite el mes cierra la cuenta, así que el panel no puede decidir con
 * lo que sabía hace un rato: desde la página, eso ya puede haber cambiado.
 */
export function WaitlistSheet({ visible, onClose, professional }: { visible: boolean; onClose: () => void; professional: Person }) {
  const feedback = useFeedback();

  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [days, setDays] = useState<number[]>([]);
  const [fromHour, setFromHour] = useState("09:00");
  const [toHour, setToHour] = useState("13:00");
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let current = true;
    setStatus(null);
    setLoadError(null);
    setError(null);

    waitlistStatus(professional.email)
      .then((data) => {
        if (current) setStatus(data);
      })
      .catch((problem) => {
        if (current) setLoadError(errorMessage(problem));
      });

    return () => {
      current = false;
    };
  }, [visible, professional.email, attempt]);

  async function join() {
    if (!status || saving) return;

    const problem = formProblem(days, fromHour, toHour, status.limits);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const fresh = await waitlistStatus(professional.email);

      // Algo cambió desde que se abrió el panel: se muestra cómo quedó y no se manda nada.
      if (fresh.entry || blockReason(fresh)) {
        setStatus(fresh);
        return;
      }

      const entry = await joinWaitlist(professional.email, { days, fromHour, toHour });
      setStatus({ ...fresh, entry, active: [...fresh.active, entry.professional], monthUsed: fresh.monthUsed + 1 });
      feedback.done("Inscripción en la lista de espera confirmada");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    setSaving(true);
    setError(null);

    try {
      await leaveWaitlist(professional.email);
      setStatus(await waitlistStatus(professional.email));
      feedback.done("Baja de la lista de espera confirmada");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setSaving(false);
    }
  }

  function confirmLeave() {
    // Salir se pregunta: no devuelve la inscripción del mes.
    Alert.alert(
      "Darse de baja",
      `Se dejan de recibir avisos de ${professional.name}. La inscripción del mes sigue contando.`,
      [
        { text: "Volver", style: "cancel" },
        { text: "Confirmar baja", style: "destructive", onPress: leave },
      ]
    );
  }

  function toggleDay(value: number) {
    setError(null);
    tapFeedback();
    setDays((current) =>
      current.includes(value) ? current.filter((day) => day !== value) : [...current, value].sort((a, b) => a - b)
    );
  }

  let body: React.ReactNode;

  if (loadError) {
    body = (
      <View style={styles.body}>
        <Note tone="danger">Error al consultar la lista de espera. {loadError}</Note>
        <Button label="Reintentar" variant="secondary" block onPress={() => setAttempt((value) => value + 1)} />
      </View>
    );
  } else if (!status) {
    body = (
      <View style={styles.body}>
        <SkeletonList rows={3} height={44} />
      </View>
    );
  } else if (status.entry) {
    const entry = status.entry;

    body = (
      <View style={styles.body}>
        <Note>Inscripción activa. Los avisos llegan por mail y a la campanita.</Note>

        <Group>
          <Row title="Días" value={describeDaysTitle(entry.days)} />
          <Row title="Horario" value={`De ${entry.fromHour} a ${entry.toHour}`} />
          <Row title="Vigente hasta el" value={formatMoment(entry.expiresAt)} />
          <Row title="Avisos recibidos" value={`${entry.noticesSent} de ${status.limits.maxNotices}`} last />
        </Group>

        {entry.notices.length > 0 ? (
          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Horarios avisados
            </AppText>
            <Group>
              {entry.notices.map((notice, index) => (
                <Row
                  key={`${notice.date}-${notice.initialHour}`}
                  title={longDate(notice.date)}
                  value={hhmm(notice.initialHour)}
                  last={index === entry.notices.length - 1}
                />
              ))}
            </Group>
          </View>
        ) : null}

        {error ? <Note tone="danger">{error}</Note> : null}

        <Button label="Darse de baja" variant="danger" block loading={saving} onPress={confirmLeave} />
      </View>
    );
  } else {
    const reason = blockReason(status);

    if (reason) {
      const others = status.active.map((other) => `${other.surname}, ${other.name}`);

      body = (
        <View style={styles.body}>
          <Note tone="warn">{reason}</Note>
          {status.enabled && others.length > 0 ? (
            <AppText variant="caption" tone="muted">
              {others.length === 1
                ? `Inscripción activa en la lista de ${others[0]}.`
                : `Inscripción activa en las listas de ${others.join(" y de ")}.`}
            </AppText>
          ) : null}
        </View>
      );
    } else {
      const problem = formProblem(days, fromHour, toHour, status.limits);
      const remaining = status.limits.maxPerMonth - status.monthUsed;

      body = (
        <View style={styles.body}>
          <AppText variant="small" tone="muted">
            Si se libera un turno en la franja elegida, llega un aviso.
          </AppText>

          <View style={styles.block}>
            <AppText variant="caption" tone="muted" chrome>
              Días, hasta {status.limits.maxDays}
            </AppText>
            <View style={styles.days}>
              {WEEK_DAYS.map((day) => (
                <DayChip
                  key={day.value}
                  label={day.label}
                  active={days.includes(day.value)}
                  disabled={!days.includes(day.value) && days.length >= status.limits.maxDays}
                  onPress={() => toggleDay(day.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.hours}>
            <View style={styles.hour}>
              <PickerField label="Desde" value={fromHour} placeholder="Hora" icon="clock" onPress={() => setPicking("from")} />
            </View>
            <View style={styles.hour}>
              <PickerField
                label="Hasta"
                value={toHour}
                placeholder="Hora"
                icon="clock"
                hint={`Hasta ${status.limits.maxHours} horas.`}
                onPress={() => setPicking("to")}
              />
            </View>
          </View>

          <AppText variant="small" tone={problem ? "muted" : "default"}>
            {problem ?? `Aviso si se libera un turno los ${describeDays(days)} entre las ${fromHour} y las ${toHour}.`}
          </AppText>

          <AppText variant="caption" tone="muted">
            La inscripción dura {status.limits.lifetimeDays} días o hasta {status.limits.maxNotices} avisos. El aviso llega a
            todas las personas que esperan ese horario, y el turno queda para quien lo reserve primero.{" "}
            {remaining === 1 ? "Queda una inscripción este mes." : `Quedan ${remaining} inscripciones este mes.`}
          </AppText>

          {error ? <Note tone="danger">{error}</Note> : null}

          <Button label="Inscribirse" icon="bell" block loading={saving} disabled={!!problem} onPress={join} />
        </View>
      );
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Lista de espera">
      <AppText variant="small" tone="muted" style={styles.who}>
        {professional.name} {professional.surname}
      </AppText>

      {body}

      <OptionSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "from" ? "Desde" : "Hasta"}
        options={(picking === "from" ? HOURS.slice(0, -1) : HOURS.slice(1)).map((hour) => ({ key: hour, label: hour }))}
        selected={picking === "from" ? fromHour : toHour}
        onSelect={(hour) => {
          setError(null);
          if (picking === "from") setFromHour(hour);
          else setToHour(hour);
        }}
      />
    </Sheet>
  );
}

/** Un día que se prende y se apaga. Son varios a la vez, así que no sirve el filtro de una opción. */
function DayChip({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.green : colors.surface,
          borderColor: active ? colors.green : colors.border,
        },
        disabled && styles.disabled,
        pressed && Platform.OS === "ios" && styles.pressed,
      ]}
    >
      <AppText variant="caption" chrome style={{ color: active ? colors.onGreen : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  who: { marginBottom: space.md },
  body: { gap: space.lg, paddingBottom: space.md },
  block: { gap: space.sm },
  days: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: TOUCH - 8,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  hours: { flexDirection: "row", gap: space.md },
  hour: { flex: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
