import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service.js";
import { sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

const settingsService = new SettingsService();

/** Todo lo de este módulo es un profesional configurando lo suyo. */
export function onlyProfessional(req: RequestWithUser, res: Response, next: NextFunction) {
  if (req.user?.type !== "professional") return res.status(403).json({ message: "Esta configuración es solo para profesionales" });
  next();
}

export async function getSettings(req: RequestWithUser, res: Response) {
  try {
    res.status(200).json({ data: await settingsService.forProfessional(req.user.email) });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function updateSettings(req: RequestWithUser, res: Response) {
  try {
    const { autoAccept, autoMark, autoMarkWhen, autoPay, autoPayWhen, mails } = req.body;

    const settings = await settingsService.update(req.user.email, {
      autoAccept: autoAccept === undefined ? undefined : !!autoAccept,
      autoMark: autoMark === undefined ? undefined : autoMark,
      autoMarkWhen: autoMarkWhen === undefined ? undefined : autoMarkWhen,
      autoPay: autoPay === undefined ? undefined : !!autoPay,
      autoPayWhen: autoPayWhen === undefined ? undefined : autoPayWhen,
      // Un objeto y no un array: lo que llega es "esta clave queda así", y cualquier otra
      // cosa (un string, un array) no tiene entradas y no cambia nada.
      mails: mails && typeof mails === "object" && !Array.isArray(mails) ? mails : undefined,
    });

    res.status(200).json({ message: "Configuración guardada", data: settings });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function acceptPending(req: RequestWithUser, res: Response) {
  try {
    const accepted = await settingsService.acceptPending(req.user.email);

    res.status(200).json({
      message: accepted === 0 ? "No tenías pedidos esperando" : `Se confirmaron ${accepted} pedidos`,
      data: { accepted },
    });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function addVacation(req: RequestWithUser, res: Response) {
  try {
    const { fromDate, toDate, reason } = req.body;
    const vacation = await settingsService.addVacation(req.user.email, fromDate, toDate, reason);

    res.status(201).json({ message: "Listo, no vas a aparecer en las búsquedas esos días", data: { id: vacation.id } });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function removeVacation(req: RequestWithUser, res: Response) {
  try {
    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "No sabemos qué período borrar" });

    await settingsService.removeVacation(req.user.email, id);
    res.status(200).json({ message: "Período borrado" });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function deletePatientAppointments(req: RequestWithUser, res: Response) {
  try {
    const scope = req.query.scope === "all" ? "all" : "future";
    const result = await settingsService.deletePatientAppointments(req.user.email, req.params.email, scope);

    res.status(200).json({
      message: result.deleted === 0 ? "Ese paciente no tenía turnos para borrar" : `Se borraron ${result.deleted} turnos`,
      data: result,
    });
  } catch (error: any) {
    sendError(res, error);
  }
}
