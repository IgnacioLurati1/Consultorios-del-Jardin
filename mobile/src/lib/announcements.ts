import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Announcement } from "../api/announcements";
import { secureStorage } from "../api/secureStorage";

/**
 * Los avisos del consultorio en el teléfono.
 *
 * Son notificaciones locales, igual que las de turno (ver alerts.ts): no hay push, no
 * hay token de dispositivo, no hay servidor mandando nada. La app pregunta por los
 * avisos vigentes cada vez que se abre o vuelve al frente, y hace sonar los que todavía
 * no mostró. La contra es que el aviso llega cuando la persona abre la app y no en el
 * momento exacto en que se publicó; a cambio no hay infraestructura de push que mantener
 * para un consultorio de diez personas.
 */

/** El canal de Android para los avisos generales. Separado del de turnos a propósito:
 *  quien quiera silenciar las novedades sin perderse un turno puede hacerlo desde el
 *  sistema. */
const CHANNEL = "avisos-consultorio";

const SEEN_KEY = "cdj.avisos.vistos";
const CLOSED_KEY = "cdj.avisos.cerrados";

/** Cuántos ids se recuerdan. De sobra: los avisos viejos se bajan, no se acumulan. */
const REMEMBERED = 60;

async function readIds(key: string): Promise<number[]> {
  try {
    const raw = await secureStorage.get(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

async function writeIds(key: string, ids: number[]): Promise<void> {
  await secureStorage.set(key, JSON.stringify(ids.slice(-REMEMBERED)));
}

/** Los que ya sonaron. */
export const readNotified = () => readIds(SEEN_KEY);

/** Los que la persona cerró con la X. No vuelven a aparecer arriba del panel. */
export const readClosed = () => readIds(CLOSED_KEY);

export async function markClosed(id: number): Promise<number[]> {
  const closed = [...(await readClosed()), id];
  await writeIds(CLOSED_KEY, closed);
  return closed;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Avisos del consultorio",
    description: "Novedades y advertencias que publica la administración.",
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
  });
}

/**
 * Hace sonar los avisos que todavía no se mostraron.
 *
 * Devuelve cuántos salieron. Solo mira los que el admin marcó para notificación: los que
 * son solo para el panel se leen cuando se entra, y hacer sonar el teléfono por algo que
 * no se pidió que suene es la forma más rápida de que se apaguen todas las notificaciones.
 */
export async function notifyNew(announcements: Announcement[]): Promise<number> {
  const wanted = announcements.filter((item) => item.channel !== "banner");
  if (wanted.length === 0) return 0;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  const notified = await readNotified();
  const pending = wanted.filter((item) => !notified.includes(item.id));
  if (pending.length === 0) return 0;

  await ensureChannel();

  for (const announcement of pending) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: announcement.title,
        body: announcement.body,
        ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
      },
      // Sin trigger sale en el momento. El aviso ya estaba publicado antes de que se
      // abriera la app: retrasarlo un rato más no le hace bien a nadie.
      trigger: null,
    });
  }

  await writeIds(SEEN_KEY, [...notified, ...pending.map((item) => item.id)]);
  return pending.length;
}
