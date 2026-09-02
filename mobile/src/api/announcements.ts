import api from "./client";

export type AnnouncementLevel = "error" | "warning" | "news";
export type AnnouncementChannel = "banner" | "notification" | "both";

/** Un aviso del consultorio. Los escribe el admin desde la página. */
export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: "client" | "professional" | "both";
  /** Si va arriba del panel, si suena el teléfono, o las dos cosas. */
  channel: AnnouncementChannel;
  active: boolean;
  createdAt: string;
}

/**
 * Los avisos vigentes para quien está logueado.
 *
 * Vienen todos, con su canal: es la app la que decide qué hacer con cada uno. Un aviso
 * marcado solo como notificación no se dibuja arriba del panel, y uno marcado solo para
 * el panel no hace sonar nada.
 */
export function myAnnouncements(): Promise<Announcement[]> {
  return api.get("/announcements/mine").then((response) => response.data.data);
}
