import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, LayoutAnimation, Switch, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { useFeedback } from "../components/Feedback";
import { PickerField } from "../components/Field";
import { Sheet } from "../components/Sheet";
import { Group, Note, Row, Section } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { DateField } from "./DateField";
import { errorMessage } from "../api/client";
import { myPatients } from "../api/appointments";
import {
  acceptPending,
  addVacation,
  deletePatientAppointments,
  getSettings,
  removeVacation,
  saveSettings,
  type AutoMark,
  type AutoMarkWhen,
  type AutoPayWhen,
  type DeleteScope,
  type MailSetting,
  type ProfessionalSettings,
} from "../api/settings";
import type { Person } from "../api/types";
import { space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/** "14/09" alcanza dentro de un renglón que ya dice de qué se trata. */
function shortDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Lo que aparece al prender un switch.
 *
 * El alto lo anima LayoutAnimation cuando cambia la configuración; esto se encarga de
 * que el contenido entre en vez de aparecer de golpe contra el borde.
 */
function Reveal({ children }: { children: React.ReactNode }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Lo que el consultorio hace solo, y las dos operaciones que no se pueden deshacer.
 *
 * Va al final del panel: son decisiones que se toman una vez y después se olvidan, no
 * cosas que se miren todos los días.
 */
export function OfficeSettings() {
  const { colors } = useTheme();
  const feedback = useFeedback();

  const [settings, setSettings] = useState<ProfessionalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [mailsOpen, setMailsOpen] = useState(false);
  const [vacationsOpen, setVacationsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  useEffect(load, [load]);

  function save(data: {
    autoAccept?: boolean;
    autoMark?: AutoMark | null;
    autoMarkWhen?: AutoMarkWhen;
    autoPay?: boolean;
    autoPayWhen?: AutoPayWhen;
    mails?: Record<string, boolean>;
  }) {
    setBusy(true);
    saveSettings(data)
      .then((next) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        return next;
      })
      .then(setSettings)
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  /**
   * Prender la confirmación automática y vaciar la bandeja son dos decisiones: la
   * primera vale para lo que entre después, y esta se lleva puesto lo que ya está.
   */
  function acceptBacklog() {
    setBusy(true);
    acceptPending()
      .then((accepted) => {
        feedback.done(accepted === 0 ? "No tenías pedidos esperando" : `Confirmaste ${accepted} pedidos`);
        load();
      })
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  if (!settings) return null;

  const onVacation = settings.vacations.find((vacation) => vacation.current);

  // Cerrado, el renglón tiene que decir si hay algo apagado: es el único momento en que
  // alguien se entera de que dejó de recibir un aviso hace tres meses.
  const muted = settings.mails.filter((mail) => !mail.enabled).length;

  return (
    <Section title="Configuración">
      <Group>
        <Row
          title="Turnos repetibles"
          subtitle="Los que se agendan solos cada semana, y hasta cuándo van"
          icon="repeat"
          onPress={() => router.push("/(app)/repeticiones")}
        />

        <Row
          title="Confirmar turnos automáticamente"
          subtitle="Cuando un paciente pide un horario tuyo, queda confirmado sin que lo apruebes."
          icon="circle-check"
          right={
            <Switch
              value={settings.autoAccept}
              disabled={busy}
              onValueChange={(value) => save({ autoAccept: value })}
              trackColor={{ true: colors.green, false: colors.border }}
            />
          }
        />

        <Row
          title="Cerrar los turnos que ya pasaron automáticamente"
          subtitle="Al turno que quedó sin marcar se le pone asistencia solo."
          icon="clipboard-check"
          last={!settings.autoAccept && settings.autoMark === null}
          right={
            <Switch
              value={settings.autoMark !== null}
              disabled={busy}
              onValueChange={(value) => save({ autoMark: value ? "assisted" : null })}
              trackColor={{ true: colors.green, false: colors.border }}
            />
          }
        />

        <Row
          title="Considerar pagado un turno automáticamente"
          subtitle="Al turno que ya pasó se le da por cobrado el valor."
          icon="money-bill-wave"
          right={
            <Switch
              value={settings.autoPay}
              disabled={busy}
              onValueChange={(value) => save({ autoPay: value })}
              trackColor={{ true: colors.green, false: colors.border }}
            />
          }
        />

        <Row
          title="Avisos por mail"
          subtitle={
            muted === 0
              ? "Ahora te llegan todos"
              : muted === 1
                ? "Apagaste uno"
                : `Apagaste ${muted}`
          }
          icon="envelope"
          onPress={() => setMailsOpen(true)}
        />

        <Row
          title="Vacaciones"
          subtitle={
            onVacation
              ? `No aparecés en las búsquedas hasta el ${shortDate(onVacation.toDate)}`
              : "Los días que no atendés"
          }
          icon="plane-departure"
          onPress={() => setVacationsOpen(true)}
        />

        <Row
          title="Borrar los turnos de un paciente"
          subtitle="Definitivo, y solo de los turnos con vos"
          icon="trash-can"
          destructive
          last
          onPress={() => setDeleteOpen(true)}
        />
      </Group>

      {settings.autoAccept && settings.pending > 0 ? (
        <Reveal>
          <View style={{ marginTop: space.md, gap: space.sm }}>
          <Note>
            Tenés {settings.pending} {settings.pending === 1 ? "pedido esperando" : "pedidos esperando"} de antes. La
            confirmación automática vale para los que entren de ahora en más.
          </Note>
            <Button label="Confirmarlos también" variant="secondary" block disabled={busy} onPress={acceptBacklog} />
          </View>
        </Reveal>
      ) : null}

      {settings.autoMark !== null ? (
        <Reveal>
          <View style={{ marginTop: space.md, gap: space.md }}>
          <Choice
            label="¿Cómo los cierro?"
            value={settings.autoMark}
            onChange={(key) => save({ autoMark: key as AutoMark })}
            options={[
              { key: "assisted", label: "Como que vino" },
              { key: "missed", label: "Como que no vino" },
            ]}
          />

          <Choice
            label="¿Cuándo?"
            value={settings.autoMarkWhen}
            onChange={(key) => save({ autoMarkWhen: key as AutoMarkWhen })}
            options={[
              { key: "appointment", label: "Al terminar cada turno" },
              {
                key: "day",
                label: "Al terminar el día",
                description: "Te da tiempo a cargar a mano el que se estiró o el que llegó tarde.",
              },
            ]}
          />

            <Note>Vale para los turnos que terminen de ahora en adelante. Lo que quedó abierto de antes no se toca.</Note>
          </View>
        </Reveal>
      ) : null}

      {settings.autoPay ? (
        <Reveal>
          <View style={{ marginTop: space.md, gap: space.md }}>
            <Choice
              label="¿Cuándo lo doy por cobrado?"
              value={settings.autoPayWhen}
              onChange={(key) => save({ autoPayWhen: key as AutoPayWhen })}
              options={[
                { key: "appointment", label: "Al terminar cada turno" },
                {
                  key: "day",
                  label: "Al terminar el día",
                  description: "Te da tiempo a marcar al que quedó debiendo antes de que se dé por cobrado.",
                },
              ]}
            />

            <Note>
              Solo toca los turnos que figuran como atendidos y sin cobrar. Un pago parcial que hayas registrado queda
              como está, y lo de antes de prender esto no se toca.
            </Note>
          </View>
        </Reveal>
      ) : null}

      <MailsSheet
        visible={mailsOpen}
        onClose={() => setMailsOpen(false)}
        mails={settings.mails}
        busy={busy}
        onChange={(key, enabled) => save({ mails: { [key]: enabled } })}
      />

      <VacationsSheet
        visible={vacationsOpen}
        onClose={() => setVacationsOpen(false)}
        settings={settings}
        onChanged={load}
      />

      <DeletePatientSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </Section>
  );
}

/**
 * Qué mails le llegan a la casilla.
 *
 * Los de la cuenta —contraseña, bienvenida, aviso de seguridad— no están: apagarlos
 * dejaría a alguien sin poder volver a entrar o sin enterarse de que le tocaron la
 * cuenta.
 */
function MailsSheet({
  visible,
  onClose,
  mails,
  busy,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  mails: MailSetting[];
  busy: boolean;
  onChange: (key: string, enabled: boolean) => void;
}) {
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title="Avisos por mail">
      <View style={{ gap: space.lg, paddingBottom: space.md }}>
        <Group>
          {mails.map((mail, index) => (
            <Row
              key={mail.key}
              title={mail.label}
              subtitle={mail.description}
              icon="envelope"
              last={index === mails.length - 1}
              right={
                <Switch
                  value={mail.enabled}
                  disabled={busy}
                  onValueChange={(value) => onChange(mail.key, value)}
                  trackColor={{ true: colors.green, false: colors.border }}
                />
              }
            />
          ))}
        </Group>
      </View>
    </Sheet>
  );
}

/**
 * Los períodos en los que no atiende.
 *
 * El de hoy se corta con "Ya volví" y no con "Borrar": es la misma operación, pero
 * nadie piensa en volver antes como en borrar un registro.
 */
function VacationsSheet({
  visible,
  onClose,
  settings,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  settings: ProfessionalSettings;
  onChanged: () => void;
}) {
  const feedback = useFeedback();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function add() {
    if (!from || !to) return;

    setBusy(true);
    addVacation(from, to)
      .then(() => {
        feedback.done("Listo, esos días no vas a aparecer en las búsquedas");
        setFrom(null);
        setTo(null);
        onChanged();
      })
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  function remove(id: number, current: boolean) {
    setBusy(true);
    removeVacation(id)
      .then(() => {
        feedback.done(current ? "Bienvenido de vuelta. Ya aparecés en las búsquedas" : "Período borrado");
        onChanged();
      })
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Vacaciones">
      <View style={{ gap: space.lg, paddingBottom: space.md }}>
        {settings.vacations.length > 0 ? (
          <Group>
            {settings.vacations.map((vacation, index) => (
              <Row
                key={vacation.id}
                title={`${shortDate(vacation.fromDate)} al ${shortDate(vacation.toDate)}`}
                subtitle={vacation.current ? "En curso" : (vacation.reason ?? undefined)}
                icon="plane-departure"
                last={index === settings.vacations.length - 1}
                right={
                  <AppText variant="small" tone="green" onPress={() => !busy && remove(vacation.id, vacation.current)}>
                    {vacation.current ? "Ya volví" : "Borrar"}
                  </AppText>
                }
              />
            ))}
          </Group>
        ) : null}

        <DateField label="Desde" value={from} onChange={setFrom} minimumDate={new Date()} />
        <DateField
          label="Hasta"
          value={to}
          onChange={setTo}
          minimumDate={from ? new Date(`${from}T12:00:00`) : new Date()}
        />

        <Note>
          Esos días no aparecés en la búsqueda ni se ofrece ningún horario tuyo. Los turnos que ya tenías dados quedan
          como están.
        </Note>

        <Button label="Cargar" block disabled={busy || !from || !to} onPress={add} />
      </View>
    </Sheet>
  );
}

/**
 * Borrar los turnos de un paciente.
 *
 * Dos pasos a propósito: primero se elige a quién y qué, y recién después aparece el
 * botón que borra. Es definitivo y no hay pantalla desde donde recuperarlo.
 */
function DeletePatientSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const feedback = useFeedback();
  const [patients, setPatients] = useState<Person[]>([]);
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<Person | null>(null);
  const [scope, setScope] = useState<DeleteScope>("future");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;

    myPatients()
      .then(setPatients)
      .catch(() => setPatients([]));
  }, [visible]);

  function close() {
    setChosen(null);
    setScope("future");
    setConfirming(false);
    onClose();
  }

  function run() {
    if (!chosen) return;

    setBusy(true);
    deletePatientAppointments(chosen.email, scope)
      .then((result) => {
        feedback.done(
          result.deleted === 0 ? "Ese paciente no tenía turnos para borrar" : `Se borraron ${result.deleted} turnos`
        );
        close();
      })
      .catch((problem) => feedback.problem(errorMessage(problem)))
      .finally(() => setBusy(false));
  }

  const name = chosen ? `${chosen.surname}, ${chosen.name}` : null;

  return (
    <>
      <Sheet visible={visible && !picking} onClose={close} title="Borrar los turnos de un paciente">
        <View style={{ gap: space.lg, paddingBottom: space.md }}>
          <PickerField
            label="Paciente"
            value={name}
            placeholder="Elegí un paciente"
            icon="user"
            onPress={() => setPicking(true)}
            hint="Solo tus pacientes. Se borran los turnos con vos, no los que tenga con otro profesional."
          />

          <Choice
            label="¿Qué borro?"
            value={scope}
            onChange={(key) => {
              setScope(key as DeleteScope);
              setConfirming(false);
            }}
            options={[
              {
                key: "future",
                label: "De hoy en adelante",
                description: "Lo que ya atendiste queda registrado, con sus observaciones.",
              },
              {
                key: "all",
                label: "Todos, historial incluido",
                description: "No vas a poder consultar qué pasó en esas sesiones.",
              },
            ]}
          />

          {confirming ? (
            <>
              <Note tone="danger">
                Vas a borrar {scope === "all" ? "todos los turnos" : "los turnos de hoy en adelante"} de {name}. Se
                eliminan permanentemente, junto con las observaciones que hayas cargado, y no hay forma de
                recuperarlos.
              </Note>
              <Button label="Sí, borrarlos para siempre" variant="danger" block disabled={busy} onPress={run} />
              <Button label="Mejor no" variant="secondary" block onPress={() => setConfirming(false)} />
            </>
          ) : (
            <Button
              label="Continuar"
              variant="danger"
              block
              disabled={!chosen}
              onPress={() => setConfirming(true)}
            />
          )}
        </View>
      </Sheet>

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Tus pacientes">
        <Group>
          {patients.map((patient, index) => (
            <Row
              key={patient.email}
              title={`${patient.surname}, ${patient.name}`}
              subtitle={patient.email}
              icon="user"
              last={index === patients.length - 1}
              onPress={() => {
                setChosen(patient);
                setConfirming(false);
                setPicking(false);
              }}
            />
          ))}
        </Group>
      </Sheet>
    </>
  );
}
