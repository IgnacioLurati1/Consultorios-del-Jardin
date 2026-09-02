import api from "../../axios";

export type AnnouncementLevel = "error" | "warning" | "news";
export type AnnouncementAudience = "client" | "professional" | "both";
export type AnnouncementChannel = "banner" | "notification" | "both";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  channel: AnnouncementChannel;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  channel: AnnouncementChannel;
}

function unwrap(err: any): never {
  throw new Error(err.response?.data?.message || err.message);
}

/** Los avisos que le tocan a quien está logueado. */
export function findMyAnnouncements(): Promise<Announcement[]> {
  return api
    .get("/announcements/mine")
    .then((response) => response.data.data)
    .catch(unwrap);
}

/** Todos, publicados y bajados. Solo el admin. */
export function findAllAnnouncements(): Promise<Announcement[]> {
  return api
    .get("/announcements")
    .then((response) => response.data.data)
    .catch(unwrap);
}

export function publishAnnouncement(data: AnnouncementInput): Promise<Announcement> {
  return api
    .post("/announcements", data)
    .then((response) => response.data.data)
    .catch(unwrap);
}

export function setAnnouncementActive(id: number, active: boolean): Promise<Announcement> {
  return api
    .patch(`/announcements/${id}`, { active })
    .then((response) => response.data.data)
    .catch(unwrap);
}

export function deleteAnnouncement(id: number): Promise<void> {
  return api
    .delete(`/announcements/${id}`)
    .then(() => undefined)
    .catch(unwrap);
}
