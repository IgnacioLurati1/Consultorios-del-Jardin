import api from "./client";

export type NotificationTone = "info" | "good" | "warn" | "urgent";

/**
 * Un aviso, tal como lo manda el consultorio.
 *
 * `target` dice a qué pantalla lleva, y llega como nombre y no como dirección: la página
 * y la app tienen rutas distintas para lo mismo, así que la dirección la arma cada una.
 */
export interface NotificationFromServer {
  id: number;
  title: string;
  body: string | null;
  tone: NotificationTone;
  target: string | null;
  /** Cuándo pasó, en ISO. */
  at: string;
  read: boolean;
}

export interface NotificationPage {
  data: NotificationFromServer[];
  /** Cuántos todavía no vio. Es el número de la campanita. */
  unread: number;
}

export function myNotifications(): Promise<NotificationPage> {
  return api.get("/notifications").then((response) => ({
    data: response.data?.data ?? [],
    unread: Number(response.data?.unread ?? 0),
  }));
}

/**
 * Marca como visto hasta el aviso `upTo`. Se llama al abrir la pantalla de avisos.
 *
 * El tope es el más nuevo de los que están en pantalla. Sin él, el servidor da por visto
 * todo lo que tenga sin leer, y lo que haya entrado desde la última consulta —justo lo que
 * uno entró a ver— queda leído sin haberse mostrado nunca.
 *
 * Un servidor que todavía no conoce el tope lo ignora y marca todo, que es lo que hacía
 * antes. La app y el servidor se publican por separado, así que ese rato tiene que andar.
 */
export function markNotificationsSeen(upTo?: number): Promise<void> {
  return api.post("/notifications/seen", { upTo }).then(() => undefined);
}

export function dismissNotification(id: number): Promise<void> {
  return api.delete(`/notifications/${id}`).then(() => undefined);
}

export function dismissAllNotifications(): Promise<void> {
  return api.delete("/notifications").then(() => undefined);
}
