import { useEffect, useState } from "react";
import { FaCircleExclamation, FaCircleInfo, FaTriangleExclamation, FaXmark } from "react-icons/fa6";
import { findMyAnnouncements, type Announcement, type AnnouncementLevel } from "./announcementsService.ts";
import { readJsonCookie, writeJsonCookie } from "../../lib/cookies";
import "./announcements.css";

const COOKIE = "avisos-leidos";

/** Cuántos ids de avisos leídos se recuerdan. Los viejos ya no se van a volver a mostrar. */
const REMEMBERED = 40;

const ICONS: Record<AnnouncementLevel, React.ComponentType> = {
  error: FaCircleExclamation,
  warning: FaTriangleExclamation,
  news: FaCircleInfo,
};

function readDismissed(): number[] {
  const saved = readJsonCookie<number[]>(COOKIE, []);
  return Array.isArray(saved) ? saved.filter((id) => typeof id === "number") : [];
}

/**
 * Los avisos del consultorio, arriba del panel.
 *
 * Se cierran con la X y no vuelven: el aviso ya cumplió, y uno que reaparece en cada
 * visita deja de leerse a los dos días. Lo cerrado se anota en el equipo desde el que se
 * miró, así que entrar desde otro lado lo muestra de nuevo —que es lo correcto: nadie lo
 * había leído desde ahí.
 */
export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(() => readDismissed());

  useEffect(() => {
    findMyAnnouncements()
      // Silencioso a propósito: un aviso que no carga no es motivo para tirarle un error
      // en la cara a alguien que entró a ver su agenda.
      .then((data) => setAnnouncements(data.filter((item) => item.channel !== "notification")))
      .catch(() => setAnnouncements([]));
  }, []);

  function dismiss(id: number) {
    const next = [...dismissed, id].slice(-REMEMBERED);
    setDismissed(next);
    writeJsonCookie(COOKIE, next);
  }

  const visible = announcements.filter((item) => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  return (
    <div className="anc-stack">
      {visible.map((announcement) => {
        const Icon = ICONS[announcement.level];

        return (
          <article key={announcement.id} className={`anc anc-${announcement.level} adm-enter`} role="status">
            <span className="anc-icon">
              <Icon />
            </span>

            <div className="anc-text">
              <h2 className="anc-title">{announcement.title}</h2>
              <p className="anc-body">{announcement.body}</p>
            </div>

            <button type="button" className="anc-close" onClick={() => dismiss(announcement.id)} aria-label="Cerrar el aviso">
              <FaXmark />
            </button>
          </article>
        );
      })}
    </div>
  );
}
