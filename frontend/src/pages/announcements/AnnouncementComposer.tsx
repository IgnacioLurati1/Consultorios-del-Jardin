import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaBullhorn, FaChevronDown, FaCircleExclamation, FaCircleInfo, FaTrash, FaTriangleExclamation } from "react-icons/fa6";
import {
  deleteAnnouncement,
  findAllAnnouncements,
  publishAnnouncement,
  setAnnouncementActive,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementChannel,
  type AnnouncementLevel,
} from "./announcementsService.ts";
import "./announcements.css";

const MAX_TITLE = 80;
const MAX_BODY = 500;

/** Los tres colores, nombrados por lo que significan y no por el color que son. */
const LEVELS: { key: AnnouncementLevel; label: string; hint: string; icon: React.ComponentType }[] = [
  { key: "error", label: "Error crítico", hint: "Algo está roto o no se puede usar", icon: FaCircleExclamation },
  { key: "warning", label: "Advertencia", hint: "Hay que tenerlo en cuenta", icon: FaTriangleExclamation },
  { key: "news", label: "Novedad", hint: "Algo nuevo o que cambió", icon: FaCircleInfo },
];

const AUDIENCES: { key: AnnouncementAudience; label: string }[] = [
  { key: "client", label: "Pacientes" },
  { key: "professional", label: "Profesionales" },
  { key: "both", label: "Los dos" },
];

const CHANNELS: { key: AnnouncementChannel; label: string; hint: string }[] = [
  { key: "banner", label: "En el panel", hint: "Lo ven cuando entran" },
  { key: "notification", label: "Notificación", hint: "Les suena el teléfono" },
  { key: "both", label: "Las dos", hint: "Suena y además queda arriba" },
];

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  client: "Pacientes",
  professional: "Profesionales",
  both: "Pacientes y profesionales",
};

const CHANNEL_LABEL: Record<AnnouncementChannel, string> = {
  banner: "en el panel",
  notification: "como notificación",
  both: "en el panel y como notificación",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Donde el admin escribe lo que quiere que sepa todo el mundo.
 *
 * La vista previa no es un adorno: el aviso se ve distinto según el color que lleve, y
 * elegir "error crítico" para algo que era una novedad es la clase de error que solo se
 * nota cuando ya lo vieron todos. Acá se ve antes de publicarlo.
 *
 * Arranca plegado y es todo el encabezado el que abre. Escribir un aviso es algo que se
 * hace de vez en cuando, y el formulario entero desplegado en el medio del panel separa
 * cómo viene la semana de los datos generales cada vez que se entra, se escriba o no.
 * Cuántos hay arriba se sigue leyendo con el cartel cerrado, que es el dato que importa
 * cuando no se viene a publicar nada.
 */
export function AnnouncementComposer() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("news");
  const [audience, setAudience] = useState<AnnouncementAudience>("both");
  const [channel, setChannel] = useState<AnnouncementChannel>("banner");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    findAllAnnouncements()
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, []);

  async function publish() {
    if (!title.trim() || !body.trim()) {
      toast.error("El aviso necesita un título y un texto");
      return;
    }

    setSaving(true);
    try {
      const created = await publishAnnouncement({ title: title.trim(), body: body.trim(), level, audience, channel });
      setAnnouncements((prev) => [created, ...prev]);
      setTitle("");
      setBody("");
      setOpen(false);
      toast.success("Aviso publicado");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(announcement: Announcement) {
    try {
      const updated = await setAnnouncementActive(announcement.id, !announcement.active);
      setAnnouncements((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.active ? "Volvió a estar arriba" : "Aviso bajado");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function remove(announcement: Announcement) {
    try {
      await deleteAnnouncement(announcement.id);
      setAnnouncements((prev) => prev.filter((item) => item.id !== announcement.id));
      toast.success("Aviso borrado");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const PreviewIcon = LEVELS.find((item) => item.key === level)!.icon;
  const published = announcements.filter((item) => item.active);

  return (
    <section className={`adm-panel anc-composer ${open ? "open" : ""}`}>
      <button
        type="button"
        className="adm-panel-head anc-composer-toggle"
        aria-expanded={open}
        aria-controls="anc-composer-body"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="anc-composer-heading">
          <FaBullhorn aria-hidden="true" />
          Cargar un aviso
        </span>

        <span className="anc-composer-state">
          {published.length > 0 && <span className="anc-composer-count">{published.length} arriba</span>}
          <FaChevronDown className="anc-composer-chevron" aria-hidden="true" />
        </span>
      </button>

      <div id="anc-composer-body" className={`adm-collapsible ${open ? "open" : ""}`}>
        <div>
          <div className="anc-composer-body">
            <div className="anc-composer-fields">
              <label className="ui-field">
                <span>Título</span>
                <input
                  value={title}
                  maxLength={MAX_TITLE}
                  placeholder="El jueves no atendemos"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label className="ui-field">
                <span>Texto</span>
                <textarea
                  rows={3}
                  value={body}
                  maxLength={MAX_BODY}
                  placeholder="Contá qué pasa y qué tiene que hacer quien lo lee."
                  onChange={(event) => setBody(event.target.value)}
                />
                <small>{MAX_BODY - body.length} caracteres disponibles.</small>
              </label>

              <div className="anc-composer-row">
                <span className="anc-composer-label">Qué tan importante es</span>
                <div className="anc-levels" role="group" aria-label="Importancia del aviso">
                  {LEVELS.map((option) => {
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`anc-level anc-level-${option.key} ${level === option.key ? "active" : ""}`}
                        aria-pressed={level === option.key}
                        onClick={() => setLevel(option.key)}
                      >
                        <Icon />
                        <span className="anc-level-label">{option.label}</span>
                        <span className="anc-level-hint">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="anc-composer-row">
                <span className="anc-composer-label">A quién le llega</span>
                <div className="adm-chips" role="group" aria-label="Destinatarios">
                  {AUDIENCES.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={audience === option.key ? "active" : ""}
                      aria-pressed={audience === option.key}
                      onClick={() => setAudience(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="anc-composer-row">
                <span className="anc-composer-label">Por dónde</span>
                <div className="adm-chips" role="group" aria-label="Cómo llega el aviso">
                  {CHANNELS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={channel === option.key ? "active" : ""}
                      aria-pressed={channel === option.key}
                      title={option.hint}
                      onClick={() => setChannel(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="anc-composer-hint">
                  La notificación llega a quien tenga la app instalada y las notificaciones prendidas.
                </p>
              </div>
            </div>

            <aside className="anc-composer-preview">
              <span className="anc-composer-label">Cómo se va a ver</span>

              <article className={`anc anc-${level}`}>
                <span className="anc-icon">
                  <PreviewIcon />
                </span>
                <div className="anc-text">
                  <h2 className="anc-title">{title.trim() || "Título del aviso"}</h2>
                  <p className="anc-body">{body.trim() || "Acá va lo que querés contar."}</p>
                </div>
              </article>

              <p className="anc-composer-hint">
                Lo ven {AUDIENCE_LABEL[audience].toLowerCase()}, {CHANNEL_LABEL[channel]}. Cada uno lo puede cerrar y no le
                vuelve a aparecer.
              </p>

              <button type="button" className="adm-btn adm-btn-primary" onClick={publish} disabled={saving}>
                {saving ? "Publicando…" : "Publicar"}
              </button>
            </aside>
          </div>

          {announcements.length > 0 && (
            <ul className="anc-list">
              {announcements.map((announcement) => (
                <li key={announcement.id} className={announcement.active ? "anc-item" : "anc-item down"}>
                  <span className={`anc-dot anc-dot-${announcement.level}`} aria-hidden="true" />

                  <div className="anc-item-text">
                    <strong>{announcement.title}</strong>
                    <span>
                      {AUDIENCE_LABEL[announcement.audience]} · {shortDate(announcement.createdAt)}
                      {announcement.active ? "" : " · bajado"}
                    </span>
                  </div>

                  <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => toggle(announcement)}>
                    {announcement.active ? "Bajar" : "Volver a subir"}
                  </button>

                  <button
                    type="button"
                    className="anc-item-delete"
                    onClick={() => remove(announcement)}
                    aria-label={`Borrar el aviso ${announcement.title}`}
                    title="Borrar"
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
