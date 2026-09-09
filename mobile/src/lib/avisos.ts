import { usePathname } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
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
 * Cada cuánto se vuelve a preguntar, con la app a la vista.
 *
 * El mismo minuto que la web. Nadie empuja nada: la campanita pregunta, así que este
 * número es cuánto puede tardar en aparecer el número de un aviso.
 */
const CADA_MS = 60 * 1000;

/**
 * Trae los avisos y los deja a la vista de todas las pantallas.
 *
 * Devuelve cuántos quedaron sin ver. Un error deja lo que ya había: perder la conexión un
 * rato no tiene por qué vaciar la campanita, y lo que se muestre de más se corrige solo en
 * la vuelta siguiente.
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
 * Mantiene los avisos al día mientras haya alguien usando la app.
 *
 * Va una sola vez, arriba de todo, y no en cada pantalla: la campanita se ve desde varias
 * y dos relojes preguntando lo mismo es preguntar el doble.
 *
 * Pregunta en tres momentos, que son los tres en los que puede haber algo nuevo para ver.
 * Al volver a la app y al cambiar de pantalla, que es lo que uno hace justo después de
 * sacar un turno; y cada minuto, que es lo único que cubre al que hizo algo y se quedó
 * quieto mirando la misma pantalla. Hasta acá solo miraba al abrir Inicio y al volver del
 * fondo: sacando un turno adentro de la app y quedándose ahí, el número no se movía nunca.
 *
 * El reloj se saltea los tics con la app de fondo. El teléfono suele apagarlos igual, pero
 * no siempre y no en todos, y preguntar con nadie mirando es gastar batería y datos.
 */
export function useAvisosAlDia(activo: boolean): void {
  const pantalla = usePathname();

  useEffect(() => {
    if (!activo) return;

    void revisarAvisos();

    const reloj = setInterval(() => {
      if (AppState.currentState === "active") void revisarAvisos();
    }, CADA_MS);

    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void revisarAvisos();
    });

    return () => {
      clearInterval(reloj);
      suscripcion.remove();
    };
  }, [activo, pantalla]);
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
 * Se dan por leídos los que están en la lista y nada más: el más nuevo de ellos marca
 * hasta dónde llegó la lectura. Lo que haya entrado desde la última consulta todavía no se
 * mostró, así que vuelve con la consulta siguiente y con su número.
 *
 * En pantalla se apagan de una y no cuando contesta el servidor: es lo que la persona
 * acaba de hacer, y esperar a que vuelva la respuesta para apagar un número se lee como
 * que la pantalla no reaccionó.
 */
export function marcarLeidos(): void {
  const hastaAca = ultima.avisos.reduce((mayor, aviso) => Math.max(mayor, aviso.id), 0);

  publicar(armar(ultima.avisos.map((aviso) => ({ ...aviso, read: true })), 0));
  if (hastaAca > 0) void markNotificationsSeen(hastaAca).catch(() => undefined);
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
