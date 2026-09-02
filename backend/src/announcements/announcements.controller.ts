import { Request, Response } from "express";
import { AnnouncementService } from "./announcements.service.js";
import { sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

const announcementService = new AnnouncementService();

function onlyAdmin(req: RequestWithUser, res: Response): boolean {
  if (req.user?.type === "admin") return true;
  res.status(403).json({ message: "Los avisos los publica el administrador" });
  return false;
}

/** Los avisos que le corresponden a quien está logueado. */
export async function getMyAnnouncements(req: RequestWithUser, res: Response) {
  try {
    res.status(200).json({ data: await announcementService.findForViewer(req.user.type) });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function getAllAnnouncements(req: RequestWithUser, res: Response) {
  try {
    if (!onlyAdmin(req, res)) return;
    res.status(200).json({ data: await announcementService.findAll() });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function createAnnouncement(req: RequestWithUser, res: Response) {
  try {
    if (!onlyAdmin(req, res)) return;

    const { title, body, level, audience, channel } = req.body;
    const created = await announcementService.create({ title, body, level, audience, channel }, req.user.email);

    res.status(201).json({ message: "Aviso publicado", data: created });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function setAnnouncementActive(req: RequestWithUser, res: Response) {
  try {
    if (!onlyAdmin(req, res)) return;

    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "No sabemos qué aviso cambiar" });

    const updated = await announcementService.setActive(id, !!req.body.active);
    res.status(200).json({ message: updated.active ? "Aviso publicado" : "Aviso bajado", data: updated });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function deleteAnnouncement(req: RequestWithUser, res: Response) {
  try {
    if (!onlyAdmin(req, res)) return;

    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "No sabemos qué aviso borrar" });

    await announcementService.remove(id);
    res.status(200).json({ message: "Aviso borrado" });
  } catch (error: any) {
    sendError(res, error);
  }
}
