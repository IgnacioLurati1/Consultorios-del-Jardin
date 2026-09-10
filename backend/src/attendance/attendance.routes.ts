import { Router, Request, Response } from "express";
import { AttendanceService } from "./attendance.service.js";
import { sendError } from "../shared/errors.js";

/**
 * Sin sesión a propósito: es el link del mail del día anterior. Lo que lo protege es la
 * firma que viaja en la dirección (ver attendance.token.ts) y el limitador de app.ts.
 */
export const attendanceRouter = Router();

const attendanceService = new AttendanceService();

/**
 * @swagger
 * /api/attendance/{token}:
 *   get:
 *     summary: El turno al que apunta un link de asistencia
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: El turno y cómo está }
 *       404: { description: El link no es válido o el turno ya no existe }
 *       410: { description: El turno ya empezó }
 *   post:
 *     summary: Contestar si se va a ir al turno
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answer: { type: string, enum: [yes, no] }
 *     responses:
 *       200: { description: Respuesta guardada }
 *       409: { description: El turno ya estaba cancelado o ya pasó }
 */
attendanceRouter.get("/:token", async (req: Request, res: Response) => {
  try {
    res.status(200).json({ data: await attendanceService.view(req.params.token) });
  } catch (error: any) {
    sendError(res, error);
  }
});

attendanceRouter.post("/:token", async (req: Request, res: Response) => {
  try {
    const data = await attendanceService.answer(req.params.token, req.body?.answer);
    res.status(200).json({ message: data.status === "cancelled" ? "Turno cancelado" : "Gracias por avisar", data });
  } catch (error: any) {
    sendError(res, error);
  }
});
