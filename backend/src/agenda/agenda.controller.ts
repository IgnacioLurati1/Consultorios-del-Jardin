import { Request, Response } from "express";
import { AgendaService } from "./agenda.service.js";
import { sendError } from "../shared/errors.js";

const agendaService = new AgendaService();

/**
 * Todo lo que pasa un día en el consultorio: los módulos de atención y los turnos.
 *
 * Es la agenda del edificio, no la de nadie en particular: incluye a todo el equipo, así
 * que solo la ve el admin. El router ya lo verifica; queda dicho acá porque es la razón
 * por la que este endpoint devuelve pacientes de profesionales ajenos.
 */
async function getDay(req: Request, res: Response) {
  try {
    const data = await agendaService.forDay(req.params.date);
    res.status(200).json({ data });
  } catch (error: any) {
    sendError(res, error, { fallback: "No pudimos armar la agenda de ese día" });
  }
}

/** Cómo viene la semana: 0 es la que corre, 1 la que viene. */
async function getWeek(req: Request, res: Response) {
  try {
    const weeksAhead = Number(req.query.weeksAhead ?? 0);
    const data = await agendaService.forWeek(Number.isFinite(weeksAhead) ? Math.max(0, Math.min(1, weeksAhead)) : 0);
    res.status(200).json({ data });
  } catch (error: any) {
    sendError(res, error, { fallback: "No pudimos armar el resumen de la semana" });
  }
}

export { getDay, getWeek };
