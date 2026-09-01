import { Router } from "express";
import { sendContactMessage } from "./contact.controller.js";
import { contactLimiter } from "../config/rateLimiter.js";

export const contactRouter = Router();

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Enviar una consulta por mail al consultorio
 *     description: >
 *       Público: no hace falta tener cuenta. El mail sale desde la casilla del
 *       consultorio con el `replyTo` de quien escribió, y quien escribió recibe un
 *       acuse. Está limitado por IP para que no se use como relay de spam.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, reason, message]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *                 description: Opcional.
 *               reason:
 *                 type: string
 *                 enum: [turnos, profesional, sugerencia, otro]
 *               message:
 *                 type: string
 *               website:
 *                 type: string
 *                 description: Campo trampa. Si viene con texto, el envío se descarta.
 *     responses:
 *       200:
 *         description: Mensaje enviado
 *       400:
 *         description: Faltan datos o alguno no es válido
 *       429:
 *         description: Demasiadas consultas desde la misma IP
 */
contactRouter.post("/", contactLimiter, sendContactMessage);
