import { Request, Response } from "express";
import { NotificationService } from "./notifications.service.js";
import { sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

const notificationService = new NotificationService();

/**
 * La campanita de quien está logueado.
 *
 * Ninguna de estas rutas recibe a quién mirar: siempre es el del token. Un aviso es de
 * quien lo recibió y de nadie más, así que no hay forma de pedir el de otro ni siquiera
 * escribiendo la dirección a mano.
 */
export async function getMyNotifications(req: RequestWithUser, res: Response) {
  try {
    res.status(200).json(await notificationService.list(req.user.email));
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function markNotificationsSeen(req: RequestWithUser, res: Response) {
  try {
    await notificationService.markSeen(req.user.email);
    res.status(200).json({ message: "Avisos marcados como vistos" });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function dismissNotification(req: RequestWithUser, res: Response) {
  try {
    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "No sabemos qué aviso borrar" });

    await notificationService.dismiss(req.user.email, id);
    res.status(200).json({ message: "Aviso borrado" });
  } catch (error: any) {
    sendError(res, error, { missing: "Ese aviso no existe" });
  }
}

export async function dismissAllNotifications(req: RequestWithUser, res: Response) {
  try {
    await notificationService.dismissAll(req.user.email);
    res.status(200).json({ message: "Avisos borrados" });
  } catch (error: any) {
    sendError(res, error);
  }
}
