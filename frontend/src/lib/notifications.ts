import api from "../axios";

/**
 * Los avisos de la campanita.
 *
 * Los guarda el consultorio y esta pantalla solo los pide. Antes se deducían acá: cada
 * vez que se miraba se guardaba en el navegador una foto de cómo estaban las cosas, y la
 * próxima vez se comparaba contra ella. Era barato y no necesitaba ninguna tabla, pero se
 * apoyaba en algo que en la práctica casi nunca se cumple: que este navegador ya tuviera
 * una foto guardada.
 *
 * La primera vez no hay con qué comparar, así que no avisaba nada. Y volvía a ser la
 * primera vez cada vez que la persona entraba desde otro equipo, desde el teléfono, o
 * después de que el navegador limpiara sus datos. Alcanzaba con entrar recién a la cuenta
 * para no ver nada de lo que había pasado mientras tanto, que es justo el momento en que
 * uno entra a enterarse.
 *
 * Ahora el hecho se anota cuando pasa, del lado que sabe que pasó, y queda esperando. Es
 * la misma razón por la que el mail se manda en ese momento y no cuando alguien abre la
 * aplicación.
 */

export type NotificationTone = "info" | "good" | "warn" | "urgent";

/** Lo que manda el servidor. El destino viene como nombre, no como dirección. */
interface NotificationFromServer {
  id: number;
  title: string;
  body: string | null;
  tone: NotificationTone;
  target: string | null;
  at: string;
  read: boolean;
}

export interface AppNotification {
  id: number;
  title: string;
  body?: string;
  tone: NotificationTone;
  /** Cuándo pasó, en milisegundos, que es como lo lee el "hace un rato". */
  at: number;
  /**
   * A dónde lleva tocarlo, ya traducido a una dirección de esta aplicación.
   *
   * En null cuando no hay a dónde ir: un pedido que se dio de baja no tiene ficha que
   * abrir, y un aviso del consultorio ya dice todo lo que hay que saber.
   */
  to: string | null;
  read: boolean;
}

/**
 * De nombre a dirección.
 *
 * El servidor manda a qué pantalla lleva cada aviso, no la dirección: la página y la
 * aplicación del teléfono tienen rutas distintas para lo mismo, así que la dirección la
 * pone cada una. Un nombre que esta versión no conozca queda sin destino, que es lo mismo
 * que ya hace con un aviso de algo que no está en ninguna pantalla.
 */
const PANTALLAS: Record<string, string> = {
  appointments: "/AppointmentsList",
  booking: "/Appointment",
  security: "/AdminHome/Analytics",
};

function traducir(aviso: NotificationFromServer): AppNotification {
  return {
    id: aviso.id,
    title: aviso.title,
    body: aviso.body ?? undefined,
    tone: aviso.tone,
    at: new Date(aviso.at).getTime(),
    to: (aviso.target && PANTALLAS[aviso.target]) ?? null,
    read: aviso.read,
  };
}

export interface Avisos {
  lista: AppNotification[];
  /** Cuántos todavía no vio. Es el número de la campanita. */
  sinVer: number;
}

const VACIO: Avisos = { lista: [], sinVer: 0 };

/**
 * Lo que hay para leer.
 *
 * Cualquier problema devuelve la lista vacía en vez de fallar. Es lo que ya hacía la
 * campanita y sigue siendo lo correcto: quien entró a hacer otra cosa no tiene por qué
 * recibir un error porque un aviso no se pudo traer. Vale también para un servidor
 * todavía sin esta pantalla, que contesta que la dirección no existe.
 */
export function fetchNotifications(): Promise<Avisos> {
  return api
    .get("/notifications")
    .then((response) => ({
      lista: ((response.data?.data ?? []) as NotificationFromServer[]).map(traducir),
      sinVer: Number(response.data?.unread ?? 0),
    }))
    .catch(() => VACIO);
}

/** Marca como visto todo lo que hay. Se llama al abrir la campanita. */
export function markSeen(): Promise<void> {
  return api
    .post("/notifications/seen")
    .then(() => undefined)
    .catch(() => undefined);
}

export function dismissNotification(id: number): Promise<void> {
  return api
    .delete(`/notifications/${id}`)
    .then(() => undefined)
    .catch(() => undefined);
}

export function dismissAll(): Promise<void> {
  return api
    .delete("/notifications")
    .then(() => undefined)
    .catch(() => undefined);
}
