import { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service.js";
import { sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

const analyticsService = new AnalyticsService();

/** Sus propios números. El profesional no ve los de nadie más. */
async function getMyAnalytics(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta vista es solo para profesionales" });

    const data = await analyticsService.forProfessional(req.user.email);
    res.status(200).json({ data });
  } catch (error: any) {
    sendError(res, error);
  }
}

/** Los números de un profesional puntual, para el admin. */
async function getProfessionalAnalytics(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "admin") return res.status(403).json({ message: "Esta vista es solo para el administrador" });

    const data = await analyticsService.forProfessional(req.params.email);
    res.status(200).json({ data });
  } catch (error: any) {
    sendError(res, error);
  }
}

/** Los números del consultorio entero. */
async function getOfficeAnalytics(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "admin") return res.status(403).json({ message: "Esta vista es solo para el administrador" });

    const data = await analyticsService.forOffice();
    res.status(200).json({ data });
  } catch (error: any) {
    sendError(res, error);
  }
}

/** Cuánto se usa y cuánto cuesta el asistente. Es plata del consultorio: solo el admin. */
async function getAssistantUsage(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "admin") return res.status(403).json({ message: "Esta información es solo para administradores" });

    const data = await analyticsService.assistantUsage();
    res.status(200).json({ message: "Uso del asistente", data });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { getMyAnalytics, getProfessionalAnalytics, getOfficeAnalytics, getAssistantUsage };
