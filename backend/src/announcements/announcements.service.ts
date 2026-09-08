import { orm } from "../shared/db/orm.js";
import { Announcement } from "./announcement.entity.js";
import { badRequest, notFound } from "../shared/errors.js";
import { Person } from "../people/people.entity.js";
import { NotificationService, type NotificationTone } from "../notifications/notifications.service.js";

const em = orm.em;

const LEVELS = ["error", "warning", "news"] as const;
const AUDIENCES = ["client", "professional", "both"] as const;
const CHANNELS = ["banner", "notification", "both"] as const;

/** De qué color sale en la campanita cada nivel de aviso. */
const TONO: Record<string, NotificationTone> = { error: "urgent", warning: "warn", news: "info" };

const MAX_TITLE = 80;
const MAX_BODY = 500;

export interface AnnouncementInput {
  title: string;
  body: string;
  level: (typeof LEVELS)[number];
  audience: (typeof AUDIENCES)[number];
  channel: (typeof CHANNELS)[number];
}

function assertValid(data: AnnouncementInput) {
  const title = data.title?.trim() ?? "";
  const body = data.body?.trim() ?? "";

  if (!title) throw badRequest("El aviso necesita un título");
  if (title.length > MAX_TITLE) throw badRequest(`El título no puede pasar de ${MAX_TITLE} caracteres`);
  if (!body) throw badRequest("El aviso necesita un texto");
  if (body.length > MAX_BODY) throw badRequest(`El texto no puede pasar de ${MAX_BODY} caracteres`);
  if (!LEVELS.includes(data.level)) throw badRequest("Elegí si es un error crítico, una advertencia o una novedad");
  if (!AUDIENCES.includes(data.audience)) throw badRequest("Elegí a quién le llega el aviso");
  if (!CHANNELS.includes(data.channel)) throw badRequest("Elegí si va al panel, como notificación, o las dos cosas");

  return { title, body };
}

export class AnnouncementService {
  /**
   * Todos, publicados y bajados, del más nuevo al más viejo. Es la vista del admin.
   *
   * El id desempata: la fecha se guarda al segundo, y dos avisos cargados en el mismo
   * segundo salían en cualquier orden, distinto en cada recarga de la pantalla.
   */
  async findAll(): Promise<Announcement[]> {
    return em.find(Announcement, {}, { orderBy: { createdAt: "DESC", id: "DESC" } });
  }

  /**
   * Lo que le toca ver a quien está mirando.
   *
   * Devuelve también los que son solo notificación: el que decide qué hacer con cada uno
   * es el cliente, que es el único que sabe si puede hacer sonar un teléfono. La página
   * se queda con los que van al panel y la app usa los dos.
   */
  async findForViewer(type: string): Promise<Announcement[]> {
    if (type !== "client" && type !== "professional") return [];

    return em.find(
      Announcement,
      { active: true, audience: { $in: [type, "both"] } },
      { orderBy: { createdAt: "DESC", id: "DESC" } }
    );
  }

  /**
   * A quiénes les llega un aviso publicado, cuando además va como notificación.
   *
   * Se le anota a cada uno en el momento de publicar, y no se calcula al leer. La cuenta
   * es de una sola vez y de una tarde —lo publica una persona, cuando pasa algo— mientras
   * que leer la campanita lo hace todo el mundo todo el tiempo: conviene que la parte cara
   * caiga del lado que ocurre una vez.
   *
   * Los administradores quedan afuera. El aviso lo escriben ellos, y no hace falta que se
   * lo anuncien de vuelta.
   */
  private async announceTo(announcement: Announcement): Promise<void> {
    if (announcement.channel === "banner") return;

    const types = announcement.audience === "both" ? ["client", "professional"] : [announcement.audience];
    const people = await em.find(Person, { type: { $in: types }, active: true }, { fields: ["email"] });

    // Una consulta para saber a quiénes les toca y una escritura para todos.
    await new NotificationService().notifyMany(
      people.map((person) => person.email),
      {
        eventKey: `av${announcement.id}`,
        title: announcement.title,
        body: announcement.body,
        tone: TONO[announcement.level] ?? "info",
        // Un aviso del consultorio no lleva a ninguna pantalla: lo que hay que saber ya
        // está en el aviso.
        target: null,
      }
    );
  }

  async create(data: AnnouncementInput, author: string): Promise<Announcement> {
    const { title, body } = assertValid(data);

    const announcement = em.create(Announcement, {
      title,
      body,
      level: data.level,
      audience: data.audience,
      channel: data.channel,
      active: true,
      createdAt: new Date(),
      createdBy: author,
    });

    await em.flush();

    // Después de guardar y sin cortar la publicación si algo sale mal: el aviso ya está
    // colgado, y que la campanita de alguien no se haya podido anotar no es motivo para
    // contestarle al que lo publicó que no se publicó.
    await this.announceTo(announcement).catch((error) =>
      console.error("Error repartiendo el aviso publicado:", error)
    );

    return announcement;
  }

  /** Baja o vuelve a subir un aviso. Es lo único editable: el texto ya se comunicó. */
  async setActive(id: number, active: boolean): Promise<Announcement> {
    const announcement = await em.findOne(Announcement, { id });
    if (!announcement) throw notFound("Ese aviso no existe");

    announcement.active = active;
    await em.flush();
    return announcement;
  }

  async remove(id: number): Promise<void> {
    const announcement = await em.findOne(Announcement, { id });
    if (!announcement) throw notFound("Ese aviso no existe");

    await em.removeAndFlush(announcement);
  }
}
