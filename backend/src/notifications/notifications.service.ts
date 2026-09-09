import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { Notification } from "./notification.entity.js";
import { notFound } from "../shared/errors.js";

/**
 * Los avisos de la campanita: anotarlos cuando pasan y dárselos a quien entra.
 *
 * La regla de qué es una novedad no se decide acá. Es la misma lista de hechos por los
 * que el consultorio ya manda un mail, y cada aviso se anota en la misma línea en que sale
 * ese mail (ver appointments.service.ts). Que sea el mismo lugar es a propósito: dos
 * lugares distintos decidiendo qué contar terminan contando cosas distintas.
 */

/** Cuánto se guarda. Más atrás no es una novedad, es un archivo. */
export const DAYS_KEPT = 3;
const MS_KEPT = DAYS_KEPT * 24 * 60 * 60 * 1000;

/** Tope de lo que se manda de una vez, por si un día pasan muchas cosas juntas. */
const MAX_SENT = 60;

export type NotificationTone = "info" | "good" | "warn" | "urgent";
export type NotificationTarget = "appointments" | "booking" | "security";

export interface NotificationEvent {
  /** El nombre del hecho, que es siempre el mismo para el mismo hecho. */
  eventKey: string;
  title: string;
  body?: string | null;
  tone: NotificationTone;
  target?: NotificationTarget | null;
}

export interface NotificationView {
  id: number;
  title: string;
  body: string | null;
  tone: NotificationTone;
  target: NotificationTarget | null;
  at: string;
  read: boolean;
}

function since(): Date {
  return new Date(Date.now() - MS_KEPT);
}

function view(notification: Notification): NotificationView {
  return {
    id: notification.idNotification!,
    title: notification.title,
    body: notification.body ?? null,
    tone: notification.tone,
    target: notification.target ?? null,
    at: notification.createdAt.toISOString(),
    read: !!notification.readAt,
  };
}

export class NotificationService {
  /**
   * Anota un aviso para una persona.
   *
   * No devuelve nada y no falla nunca, y las dos cosas son la misma decisión: esto corre
   * al lado de sacar un turno, de confirmarlo, de darlo de baja. Si la anotación fallara
   * hacia afuera, el turno que ya está bien guardado se caería por no haber podido
   * escribir un renglón de la campanita. Un aviso perdido se nota poco; un turno perdido
   * se nota mucho.
   *
   * Por lo mismo va en su propia sesión con la base: adentro de la del pedido compartiría
   * la cola de cambios pendientes, y guardar esto forzaría a guardar de una lo que el
   * pedido todavía estaba armando.
   */
  async notify(email: string | null | undefined, event: NotificationEvent): Promise<void> {
    if (!email) return;

    const em = orm.em.fork();

    try {
      const person = await em.findOne(Person, { email });
      if (!person) return;

      em.create(Notification, {
        person,
        eventKey: event.eventKey,
        title: event.title,
        body: event.body ?? null,
        tone: event.tone,
        target: event.target ?? null,
        createdAt: new Date(),
        readAt: null,
        dismissedAt: null,
      });

      await em.flush();
    } catch (error: any) {
      // El choque contra la clave única es el caso normal de "esto ya estaba anotado", no
      // una falla: se lo deja pasar en silencio. Lo demás sí se escribe, una línea y sin
      // pila, que es lo único que se puede hacer sin molestar a nadie.
      const duplicado =
        error?.code === "ER_DUP_ENTRY" ||
        (typeof error?.message === "string" && error.message.includes("Duplicate entry"));

      if (!duplicado) console.error(`No se pudo anotar el aviso ${event.eventKey}: ${error?.message ?? error}`);
    }
  }

  /**
   * El mismo aviso para varias personas, en una sola escritura.
   *
   * Existe aparte de `notify` por el costo. Llamando al de uno en un `for`, cada persona
   * se lleva su propia sesión con la base y su propia consulta para buscarla: veinte
   * personas eran cuarenta viajes puestos en fila. Acá son dos, una consulta y una
   * escritura, sean veinte o quinientas.
   *
   * El reparto sigue siendo una fila por persona, y eso está bien: es lo que hace que
   * después cada uno pueda marcarlo como visto y borrarlo por su cuenta, que es la mitad
   * de para qué existe esto. Son doscientos bytes por fila y la limpieza de los tres días
   * se los lleva.
   *
   * Si alguna ya estaba anotada, el choque contra la clave única se lleva puesta la tanda
   * entera, así que ahí se cae de vuelta a una por una. No pasa repartiendo un aviso
   * recién publicado; pasa si algún día esto se llama dos veces por lo mismo.
   */
  async notifyMany(emails: string[], event: NotificationEvent): Promise<void> {
    if (emails.length === 0) return;

    const em = orm.em.fork();

    try {
      // Las personas se buscan de nuevo acá adentro, en una sola consulta. Las que trae
      // quien llama son de otra sesión con la base, y de paso esto deja afuera sola a la
      // que ya no exista, igual que hace el aviso de a uno.
      const people = await em.find(Person, { email: { $in: emails } });

      for (const person of people) {
        em.create(Notification, {
          person,
          eventKey: event.eventKey,
          title: event.title,
          body: event.body ?? null,
          tone: event.tone,
          target: event.target ?? null,
          createdAt: new Date(),
          readAt: null,
          dismissedAt: null,
        });
      }

      await em.flush();
    } catch (error: any) {
      for (const email of emails) await this.notify(email, event);
    }
  }

  /** Lo que tiene para leer quien está logueado, de lo más nuevo a lo más viejo. */
  async list(email: string): Promise<{ data: NotificationView[]; unread: number }> {
    const em = orm.em;

    const notifications = await em.find(
      Notification,
      { person: { email }, dismissedAt: null, createdAt: { $gte: since() } },
      { orderBy: { createdAt: "DESC", idNotification: "DESC" }, limit: MAX_SENT }
    );

    return {
      data: notifications.map(view),
      unread: notifications.filter((notification) => !notification.readAt).length,
    };
  }

  /**
   * Marca como visto hasta el aviso `upTo`. Se llama al abrir la campanita.
   *
   * El tope lo pone quien mira, y es el mas nuevo de los que tenia en pantalla. Sin tope
   * se marcaba todo lo que estuviera sin leer, incluido lo que habia entrado despues de la
   * ultima consulta y que esa persona todavia no habia visto: ese aviso quedaba leido sin
   * haberse mostrado nunca, y era justo el que estaban esperando ver aparecer. Los ids
   * suben, asi que "hasta el que vi" es "menor o igual al suyo".
   *
   * Sin tope se sigue marcando todo. Es lo que manda una version anterior de la pagina o
   * de la app, y entre un deploy y el otro tiene que seguir andando.
   *
   * Solo lo que todavia no estaba visto: volver a escribir la fecha de los que ya lo
   * estaban no cambiaria nada y haria un update por cada aviso viejo.
   */
  async markSeen(email: string, upTo?: number | null): Promise<number> {
    const em = orm.em;
    const hasta = Number.isFinite(upTo) && (upTo as number) > 0 ? { idNotification: { $lte: upTo } } : {};

    return em.nativeUpdate(Notification, { person: { email }, readAt: null, ...hasta }, { readAt: new Date() });
  }

  /** Saca un aviso de la lista de esa persona. Solo el suyo: el filtro lleva el email. */
  async dismiss(email: string, id: number): Promise<void> {
    const em = orm.em;

    const notification = await em.findOne(Notification, { idNotification: id, person: { email } });
    if (!notification) throw notFound("Ese aviso no existe");

    notification.dismissedAt = new Date();
    await em.flush();
  }

  async dismissAll(email: string): Promise<number> {
    const em = orm.em;
    return em.nativeUpdate(Notification, { person: { email }, dismissedAt: null }, { dismissedAt: new Date() });
  }

  /**
   * Borra lo que ya no se muestra.
   *
   * Que la tabla se limpie sola es la contra de guardar esto en la base, y es la que hay
   * que pagar de entrada: una tabla que solo crece termina siendo el problema del año que
   * viene. El corte es el mismo que el de la lectura, así que lo que se borra es lo que
   * ya no se le mostraba a nadie.
   */
  async cleanup(): Promise<number> {
    const em = orm.em;
    return em.nativeDelete(Notification, { createdAt: { $lt: since() } });
  }
}
