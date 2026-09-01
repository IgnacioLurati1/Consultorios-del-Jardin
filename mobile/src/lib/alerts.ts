import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { secureStorage } from "../api/secureStorage";
import { Appointment } from "../api/types";
import { counterpart, stateOf } from "./appointments";

/**
 * El aviso de "tenés un turno en cinco minutos".
 *
 * Es una notificación local: la programa el teléfono y la dispara el teléfono. No hace
 * falta servidor, ni token de push, ni que haya señal en el momento del turno. A cambio,
 * hay que reprogramarla cada vez que la agenda cambia, que es lo que hace `syncAlerts`.
 */

/** Cuánto antes suena. Cinco minutos es lo que tarda alguien en acomodarse. */
const MINUTES_BEFORE = 5;

/** Hasta dónde se programa. Más lejos que esto la agenda todavía se va a mover. */
const DAYS_AHEAD = 7;

/**
 * Tope de avisos programados a la vez.
 *
 * iOS solo guarda 64 notificaciones pendientes por app y descarta las que sobran sin
 * decir nada. Cortar acá deja margen y evita que un día muy cargado se coma los avisos
 * de los días siguientes.
 */
const MAX_SCHEDULED = 40;

const PREFS_KEY = "cdj.alerts";

/** El canal de Android: es lo que decide si el aviso suena, vibra o no hace nada. */
const CHANNEL_LOUD = "turnos";
const CHANNEL_QUIET = "turnos-silencioso";

export interface AlertPrefs {
  /** Si se muestra el aviso. En false no se programa nada. */
  notify: boolean;
  /** Si además vibra. */
  vibrate: boolean;
  /** Si ya se le preguntó alguna vez. Sin esto la app volvería a preguntar en cada arranque. */
  asked: boolean;
}

export const DEFAULT_PREFS: AlertPrefs = { notify: true, vibrate: true, asked: false };

/** Las tres formas de contestar la pregunta, tal como se ofrecen en pantalla. */
export type AlertChoice = "both" | "quiet" | "off";

export function choiceOf(prefs: AlertPrefs): AlertChoice {
  if (!prefs.notify) return "off";
  return prefs.vibrate ? "both" : "quiet";
}

export function prefsFor(choice: AlertChoice): Omit<AlertPrefs, "asked"> {
  if (choice === "off") return { notify: false, vibrate: false };
  return { notify: true, vibrate: choice === "both" };
}

export async function readAlertPrefs(): Promise<AlertPrefs> {
  try {
    const raw = await secureStorage.get(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AlertPrefs>) };
  } catch {
    // Si lo guardado quedó ilegible, preguntar de nuevo es mejor que apagar los avisos
    // sin que la persona se entere.
    return DEFAULT_PREFS;
  }
}

export async function saveAlertPrefs(prefs: AlertPrefs): Promise<void> {
  await secureStorage.set(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Pide permiso para avisar.
 *
 * Se pide recién cuando la persona dijo que quiere los avisos, y no al abrir la app: un
 * cartel del sistema que aparece antes de que se entienda para qué es se rechaza, y en
 * iOS no se puede volver a preguntar.
 */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Los canales de Android.
 *
 * Android decide con el canal, no con cada notificación: para tener una versión que vibra
 * y otra que no hay que declarar los dos. Crearlos es idempotente, así que se puede
 * llamar en cada arranque.
 */
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_LOUD, {
    name: "Turnos",
    description: "El aviso de cinco minutos antes de cada turno.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    enableVibrate: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
    name: "Turnos, sin vibrar",
    description: "El mismo aviso, sin vibración.",
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
  });
}

/** Un turno que todavía puede ocurrir: no se canceló, no se cerró, y no pasó. */
function willHappen(appointment: Appointment, now: Date): boolean {
  const key = stateOf(appointment);
  if (key !== "pending" && key !== "accepted") return false;

  return startsAt(appointment) > now;
}

/**
 * Cuándo empieza el turno, en hora local.
 *
 * La fecha llega como día suelto ("2026-09-04") o como su ISO a medianoche UTC, y la hora
 * viene aparte como texto. Se arman los componentes a mano para no arrastrar el corrimiento
 * de zona que tiene el resto de las fechas de turno.
 */
function startsAt(appointment: Appointment): Date {
  const [year, month, day] = appointment.date.slice(0, 10).split("-").map(Number);
  const [hour, minute] = appointment.initialHour.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Deja programados los avisos de los próximos turnos y borra los de antes.
 *
 * Se borra todo y se vuelve a programar en vez de ir tocando de a uno: la agenda cambia
 * de muchas maneras (se acepta, se cancela, se corre de hora, aparece un sobreturno) y
 * seguirle el rastro a cada cambio sería una fuente de avisos fantasma. Reprogramar
 * cuarenta notificaciones locales no cuesta nada.
 *
 * Devuelve cuántos quedaron programados, que es lo que la pantalla de ajustes muestra
 * para que se pueda ver que quedó andando.
 */
export async function syncAlerts(appointments: Appointment[], prefs: AlertPrefs, viewerEmail: string): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.notify) return 0;

  const granted = await Notifications.getPermissionsAsync();
  if (!granted.granted) return 0;

  await ensureChannels();

  const now = new Date();
  const limit = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

  const upcoming = appointments
    .filter((appointment) => willHappen(appointment, now) && startsAt(appointment) <= limit)
    .sort((a, b) => startsAt(a).getTime() - startsAt(b).getTime())
    .slice(0, MAX_SCHEDULED);

  let scheduled = 0;

  for (const appointment of upcoming) {
    const start = startsAt(appointment);
    const fireAt = new Date(start.getTime() - MINUTES_BEFORE * 60 * 1000);

    // Un turno que empieza dentro de los próximos cinco minutos ya tiene su momento de
    // aviso en el pasado: programarlo ahí lo haría sonar de inmediato.
    if (fireAt <= now) continue;

    const hour = appointment.initialHour.slice(0, 5);
    const withWhom = counterpart(appointment, viewerEmail);
    const unconfirmed = stateOf(appointment) === "pending" ? " · sin confirmar" : "";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Turno a las ${hour}`,
        body: `${withWhom}, en ${MINUTES_BEFORE} minutos${unconfirmed}`,
        data: { numAppointment: appointment.numAppointment },
        ...(Platform.OS === "android" ? { channelId: prefs.vibrate ? CHANNEL_LOUD : CHANNEL_QUIET } : {}),
        // En iOS el canal no existe: lo que hace vibrar es que el aviso tenga sonido.
        ...(Platform.OS === "ios" ? { sound: prefs.vibrate } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });

    scheduled++;
  }

  return scheduled;
}

/** Apaga todo lo programado. Se llama al cerrar sesión: la agenda ya no es de este teléfono. */
export async function clearAlerts(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
