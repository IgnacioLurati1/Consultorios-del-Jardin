import { useCallback, useEffect, useState } from "react";
import {
  dismissAllNotifications,
  dismissNotification,
  markNotificationsSeen,
  myNotifications,
  type NotificationFromServer,
  type NotificationTone,
} from "../api/notifications";

/**
 * Los avisos de la campanita.
 *
 * Los guarda el consultorio y la app solo los pide. Antes se deducían acá, igual que en la
 * página: cada vez que se miraba se guardaba en el teléfono una foto de cómo estaban las
 * cosas y la próxima vez se comparaba contra ella. Andaba, pero se apoyaba en algo que en
 * la práctica casi nunca se cumple: que este teléfono ya tuviera una foto guardada.
 *
 * La primera vez no hay con qué comparar, así que no avisaba nada. Y volvía a ser la
 * primera vez entrando desde la web, desde otro teléfono, o después de reinstalar. Bastaba
 * con entrar recién a la cuenta para no ver nada de lo que había pasado mientras tanto,
 * que es justo el momento en que uno entra a enterarse.
 *
 * Ahora el hecho se anota cuando pasa y queda esperando. Es lo mismo que se ve en la
 * página, con los mismos avisos y el mismo estado de leído: son de la persona, no del
 * aparato desde el que mira.
 */

export type { NotificationTone };

export interface Aviso {
  id: number;
  title: string;
  body?: string;
  tone: NotificationTone;
  /** Cuándo pasó, en milisegundos, que es como lo lee el "hace un rato". */
  at: number;
  /** A qué pantalla lleva, o null cuando no hay ninguna a la que ir. */
  to: string | null;
  read: boolean;
}

/**
 * De nombre de pantalla a ruta de la app.
 *
 * Un nombre que esta versión no conozca queda sin destino. El servidor y la app se
 * publican por separado y una versión instalada vive en el teléfono todo lo que la persona
 * quiera: un aviso nuevo tiene que poder llegarle igual, aunque no sepa a dónde lleva.
 */
const PANTALLAS: Record<string, string> = {
  appointments: "/(app)/(tabs)/turnos",
  booking: "/(app)/(tabs)/pedir-turno",
  security: "/(app)/admin/control",
};

function traducir(aviso: NotificationFromServer): Aviso {
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

/* ---------- lo que hay, compartido entre pantallas ---------- */

interface Vista {
  avisos: Aviso[];
  /** Cuántos todavía no vio. Es el número de la campanita. */
  nuevos: number;
  /** Si entre los que no vio hay algo grave. Es lo que hace latir el número. */
  urgente: boolean;
}

const NADA: Vista = { avisos: [], nuevos: 0, urgente: false };

/*
 * Lo último que se trajo, acá arriba y no adentro de cada pantalla.
 *
 * La campanita del encabezado y la pantalla de avisos miran lo mismo, y cada una se monta
 * cuando le toca. Con el estado adentro de cada una, borrar un aviso en la pantalla dejaba
 * a la campanita con el número viejo hasta la próxima vuelta al Inicio.
 */
let ultima: Vista = NADA;
const escuchando = new Set<(vista: Vista) => void>();

function publicar(vista: Vista): void {
  ultima = vista;
  for (const avisar of escuchando) avisar(vista);
}

function armar(avisos: Aviso[], sinVer: number): Vista {
  return { avisos, nuevos: sinVer, urgente: avisos.some((aviso) => !aviso.read && aviso.tone === "urgent") };
}

/**
 * Trae los avisos y los deja a la vista de todas las pantallas.
 *
 * Devuelve cuántos quedaron sin ver. La llaman Inicio al abrirse y al volver a la app: el
 * teléfono apaga los temporizadores de una app que está de fondo, así que un reloj propio
 * correría justo cuando nadie está mirando.
 *
 * Un error deja lo que ya había. Perder la conexión un rato no tiene por qué vaciar la
 * campanita, y lo que se muestre de más se corrige solo en la vuelta siguiente.
 */
export async function revisarAvisos(): Promise<number> {
  try {
    const { data, unread } = await myNotifications();
    publicar(armar(data.map(traducir), unread));
    return unread;
  } catch {
    return ultima.nuevos;
  }
}

/**
 * Los avisos y cuántos quedan sin ver, al día con lo que pase en cualquier pantalla.
 *
 * `refrescar` es para el tirón hacia abajo de la pantalla de avisos.
 */
export function useAvisos(): Vista & { refrescar: () => Promise<number> } {
  const [vista, setVista] = useState<Vista>(ultima);

  useEffect(() => {
    escuchando.add(setVista);
    setVista(ultima);

    return () => {
      escuchando.delete(setVista);
    };
  }, []);

  return { ...vista, refrescar: useCallback(() => revisarAvisos(), []) };
}

/* ---------- lo que se hace con ellos ---------- */

/**
 * Se llama al abrir la pantalla de avisos, que es cuando se dan por leídos.
 *
 * En pantalla se apagan de una y no cuando contesta el servidor: es lo que la persona
 * acaba de hacer, y esperar a que vuelva la respuesta para apagar un número se lee como
 * que la pantalla no reaccionó.
 */
export function marcarLeidos(): void {
  publicar(armar(ultima.avisos.map((aviso) => ({ ...aviso, read: true })), 0));
  void markNotificationsSeen().catch(() => undefined);
}

export function borrarAviso(id: number): void {
  const quedan = ultima.avisos.filter((aviso) => aviso.id !== id);
  publicar(armar(quedan, quedan.filter((aviso) => !aviso.read).length));
  void dismissNotification(id).catch(() => undefined);
}

export function borrarTodos(): void {
  publicar(NADA);
  void dismissAllNotifications().catch(() => undefined);
}

/**
 * Se vacía lo que quedó en pantalla al cerrar sesión.
 *
 * No borra nada del teléfono porque no hay nada guardado: los avisos son del consultorio y
 * se piden con la sesión de cada uno. Lo que se limpia es la copia que quedó en memoria,
 * para que el que entra después no vea por un instante los del anterior.
 */
export function olvidarAvisos(): void {
  publicar(NADA);
}
