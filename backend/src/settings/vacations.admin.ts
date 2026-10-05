import { Router, type Request, type Response } from "express";
import { verifyAdmin } from "../config/middlewares.js";
import { sendError } from "../shared/errors.js";
import { RULE_MESSAGES, requireRule } from "../installation/rules.js";
import { SettingsService } from "./settings.service.js";

/**
 * Las vacaciones de un profesional, cargadas por la administración.
 *
 * Es la regla `vacations` (ver shared/policies): con "Solo la administración" o "los dos",
 * la administración carga y borra los períodos sin atender de cualquier profesional; con
 * "Cada profesional las suyas", esto no está. El servicio es el mismo que usa el profesional
 * para las suyas, así que los períodos se ven igual desde los dos lados.
 */

const settingsService = new SettingsService();
const allowed = () => requireRule((p) => p.vacations !== "professional", RULE_MESSAGES.adminVacations);

export const adminVacationsRouter = Router();

adminVacationsRouter.use(verifyAdmin);

adminVacationsRouter.get("/:email", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ message: "Períodos sin atender", data: await settingsService.vacationsOf(req.params.email) });
  } catch (error) {
    sendError(res, error);
  }
});

adminVacationsRouter.post("/:email", async (req: Request, res: Response) => {
  try {
    await allowed();
    const { fromDate, toDate, reason } = req.body ?? {};
    const vacation = await settingsService.addVacation(req.params.email, fromDate, toDate, reason);
    res.status(201).json({ message: "Período cargado", data: { id: vacation.id } });
  } catch (error) {
    sendError(res, error);
  }
});

adminVacationsRouter.delete("/:email/:id", async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "No se sabe qué período borrar" });

    await allowed();
    await settingsService.removeVacation(req.params.email, id);
    res.status(200).json({ message: "Período borrado" });
  } catch (error) {
    sendError(res, error);
  }
});
