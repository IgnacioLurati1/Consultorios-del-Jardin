import { Router, Request, Response } from "express";
import { WaitlistService } from "./waitlist.service.js";
import { badRequest, sendError } from "../shared/errors.js";

interface RequestWithUser extends Request {
  user?: any;
}

export const waitlistRouter = Router();

const waitlistService = new WaitlistService();

function onlyProfessional(req: RequestWithUser, res: Response): boolean {
  if (req.user.type === "professional") return true;
  res.status(403).json({ message: "Esta vista es solo para profesionales" });
  return false;
}

/**
 * @swagger
 * /api/waitlist/professional:
 *   get:
 *     summary: Quiénes esperan al profesional logueado
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Las personas en su lista de espera }
 *       403: { description: Solo para profesionales }
 */
waitlistRouter.get("/professional", async (req: RequestWithUser, res: Response) => {
  try {
    if (!onlyProfessional(req, res)) return;
    res.status(200).json({ data: await waitlistService.forProfessional(req.user.email) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/waitlist/professional/{id}:
 *   delete:
 *     summary: El profesional saca a alguien de su lista, sin avisarle
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
waitlistRouter.delete("/professional/:id", async (req: RequestWithUser, res: Response) => {
  try {
    if (!onlyProfessional(req, res)) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest("Esa persona no está en tu lista de espera");

    await waitlistService.removeByProfessional(req.user.email, id);
    res.status(200).json({ message: "Salió de tu lista de espera" });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/waitlist/matches/{numAppointment}:
 *   get:
 *     summary: Cuánta gente recibiría el aviso si el profesional cancela este turno
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
waitlistRouter.get("/matches/:numAppointment", async (req: RequestWithUser, res: Response) => {
  try {
    if (!onlyProfessional(req, res)) return;

    const num = Number(req.params.numAppointment);
    if (!Number.isInteger(num) || num <= 0) throw badRequest("El número de turno no es válido");

    res.status(200).json({ data: await waitlistService.matchesFor(num, req.user.email) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/waitlist/status/{professionalEmail}:
 *   get:
 *     summary: Cómo está el paciente logueado respecto de la lista de un profesional
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
waitlistRouter.get("/status/:professionalEmail", async (req: RequestWithUser, res: Response) => {
  try {
    res.status(200).json({ data: await waitlistService.status(req.user.email, req.params.professionalEmail) });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/waitlist/{professionalEmail}:
 *   post:
 *     summary: Anotarse en la lista de espera de un profesional
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days: { type: array, items: { type: integer, minimum: 1, maximum: 6 } }
 *               fromHour: { type: string, example: "14:00" }
 *               toHour: { type: string, example: "18:00" }
 *   delete:
 *     summary: Salir de la lista de espera de un profesional
 *     tags: [Waitlist]
 *     security:
 *       - bearerAuth: []
 */
waitlistRouter.post("/:professionalEmail", async (req: RequestWithUser, res: Response) => {
  try {
    const data = await waitlistService.subscribe(req.user, req.params.professionalEmail, req.body);
    res.status(201).json({ message: "Quedaste en la lista de espera", data });
  } catch (error: any) {
    sendError(res, error);
  }
});

waitlistRouter.delete("/:professionalEmail", async (req: RequestWithUser, res: Response) => {
  try {
    await waitlistService.unsubscribe(req.user.email, req.params.professionalEmail);
    res.status(200).json({ message: "Saliste de la lista de espera" });
  } catch (error: any) {
    sendError(res, error);
  }
});
