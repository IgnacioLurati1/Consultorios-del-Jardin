import * as Notifications from "expo-notifications";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { professionalRange } from "../api/appointments";
import { Button } from "../components/Button";
import { Choice } from "../components/Choice";
import { Sheet } from "../components/Sheet";
import { AppText } from "../components/Text";
import {
  AlertChoice,
  AlertPrefs,
  choiceOf,
  clearAlerts,
  DEFAULT_PREFS,
  ensurePermission,
  prefsFor,
  readAlertPrefs,
  saveAlertPrefs,
  syncAlerts,
} from "../lib/alerts";
import { addDays, today, toISODate } from "../lib/dates";
import { space } from "../theme/tokens";
import { useSession } from "./SessionProvider";

/**
 * Con la app abierta, el aviso igual se muestra. Sin esto una notificación programada
 * llega en silencio si el profesional justo está mirando la pantalla, que es cuando más
 * probable es que esté por empezar el turno.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Las tres respuestas posibles, dichas como se leen. */
export const ALERT_OPTIONS: { key: AlertChoice; label: string; description: string }[] = [
  { key: "both", label: "Avisame y vibrá", description: "Suena y vibra cinco minutos antes de cada turno." },
  { key: "quiet", label: "Avisame sin vibrar", description: "Aparece el aviso, pero el teléfono se queda quieto." },
  { key: "off", label: "No me avises", description: "Podés prenderlo más adelante desde Más." },
];

interface AlertsValue {
  prefs: AlertPrefs;
  /** Cuántos avisos quedaron programados. Es la prueba de que quedó andando. */
  scheduled: number;
  /** Falso cuando el sistema tiene los avisos bloqueados para la app. */
  allowed: boolean;
  choose: (choice: AlertChoice) => Promise<void>;
}

const AlertsContext = createContext<AlertsValue | null>(null);

/**
 * Los avisos de turno del profesional.
 *
 * Vive acá arriba y no en una pantalla porque no depende de que se esté mirando nada: la
 * agenda cambia sola (un paciente saca turno, otro cancela) y los avisos programados
 * tienen que seguirla. Se reprograman al abrir la app y cada vez que vuelve al frente.
 *
 * Solo aplica al profesional: es el único que tiene una agenda propia que atender.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const isProfessional = session?.role === "professional";

  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const [scheduled, setScheduled] = useState(0);
  const [allowed, setAllowed] = useState(true);
  const [asking, setAsking] = useState(false);

  // Sin esto, dos vueltas al frente seguidas dispararían dos reprogramaciones que se
  // pisan: la segunda cancela todo mientras la primera todavía está creando avisos.
  const syncing = useRef(false);

  const sync = useCallback(
    async (next: AlertPrefs) => {
      if (!session || !isProfessional || syncing.current) return;

      syncing.current = true;
      try {
        if (!next.notify) {
          await clearAlerts();
          setScheduled(0);
          return;
        }

        const permission = await Notifications.getPermissionsAsync();
        setAllowed(permission.granted);
        if (!permission.granted) {
          setScheduled(0);
          return;
        }

        const agenda = await professionalRange(today(), toISODate(addDays(new Date(), 7)));
        setScheduled(await syncAlerts(agenda, next, session.email));
      } catch {
        // Que no se pueda programar un aviso no puede romper la app: es una comodidad,
        // no el turno. El profesional sigue viendo su agenda igual.
      } finally {
        syncing.current = false;
      }
    },
    [session, isProfessional]
  );

  // Al entrar: se lee lo elegido y, si nunca se preguntó, se pregunta.
  useEffect(() => {
    if (!isProfessional) return;

    let alive = true;

    readAlertPrefs().then((saved) => {
      if (!alive) return;
      setPrefs(saved);
      if (!saved.asked) setAsking(true);
      else void sync(saved);
    });

    return () => {
      alive = false;
    };
  }, [isProfessional, sync]);

  // Cada vez que la app vuelve al frente: la agenda pudo cambiar mientras estaba cerrada.
  useEffect(() => {
    if (!isProfessional) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync(prefs);
    });

    return () => subscription.remove();
  }, [isProfessional, prefs, sync]);

  const choose = useCallback(
    async (choice: AlertChoice) => {
      const wanted = prefsFor(choice);

      // El permiso se pide recién ahora, cuando ya se sabe para qué es. Un cartel del
      // sistema que aparece antes de eso se rechaza, y en iOS no se puede volver a pedir.
      const granted = wanted.notify ? await ensurePermission() : true;
      setAllowed(!wanted.notify || granted);

      const next: AlertPrefs = { ...wanted, notify: wanted.notify && granted, asked: true };
      setPrefs(next);
      await saveAlertPrefs(next);
      await sync(next);
    },
    [sync]
  );

  const value = useMemo<AlertsValue>(() => ({ prefs, scheduled, allowed, choose }), [prefs, scheduled, allowed, choose]);

  return (
    <AlertsContext.Provider value={value}>
      {children}

      {/* Cerrar sin elegir no decide nada: la pregunta vuelve la próxima vez que se abra
          la app. Es preferible a dar por sentado que sí (aparecería un cartel del sistema
          que nadie pidió) o que no (se apagarían avisos que quizás quería). */}
      <Sheet visible={asking} onClose={() => setAsking(false)} title="¿Te avisamos antes de cada turno?">
        <AppText variant="small" tone="muted">
          Cinco minutos antes de cada turno te decimos con quién es y a qué hora. Lo podés cambiar cuando quieras
          desde Más.
        </AppText>

        <View style={{ marginTop: space.lg }}>
          <Choice
            label="Elegí cómo"
            options={ALERT_OPTIONS}
            value={choiceOf(prefs)}
            onChange={(key) => {
              void choose(key as AlertChoice);
              setAsking(false);
            }}
          />
        </View>

        <View style={{ marginTop: space.lg }}>
          <Button
            label="Ahora no"
            variant="ghost"
            block
            onPress={() => setAsking(false)}
          />
          <AppText variant="caption" tone="muted" style={{ marginTop: space.sm, textAlign: "center" }}>
            Te lo volvemos a preguntar la próxima vez.
          </AppText>
        </View>
      </Sheet>
    </AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsValue {
  const value = useContext(AlertsContext);
  if (!value) throw new Error("useAlerts se usa adentro de AlertsProvider");
  return value;
}
