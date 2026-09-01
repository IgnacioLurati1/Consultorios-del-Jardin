import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { sendAssistantMessage } from "./assistant.controller.js";

export const assistantRouter = Router();

/**
 * Cada mensaje puede disparar varias llamadas al modelo, que se pagan. El límite va por
 * cuenta y no por IP: en un consultorio con wifi compartida, la IP es la misma para todos.
 */
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req: any) => req.user?.email ?? ipKeyGenerator(req.ip ?? ""),
  message: { message: "Demasiadas consultas al asistente. Intentá de nuevo en un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/assistant/message:
 *   post:
 *     summary: Consulta al asistente del consultorio
 *     description: >
 *       Contesta con lenguaje natural y, según el rol de la sesión, puede consultar
 *       turnos, profesionales y estadísticas, sacar o cancelar turnos, y proponer
 *       pantallas de la aplicación. Las herramientas disponibles dependen del tipo de
 *       cuenta del token, no de lo que pida el mensaje.
 *     tags: [Assistant]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 600
 *                 example: ¿Qué turnos tengo la semana que viene?
 *               history:
 *                 type: array
 *                 description: Mensajes anteriores de la conversación. Máximo 20.
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Respuesta del asistente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                     chatHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                     links:
 *                       type: array
 *                       description: Pantallas que el asistente ofrece abrir.
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           path:
 *                             type: string
 *                     changed:
 *                       type: boolean
 *                       description: Si la consulta modificó algún turno.
 *       400:
 *         description: Mensaje vacío, demasiado largo o cuenta sin acceso al asistente
 *       401:
 *         description: Token ausente, inválido o expirado
 *       429:
 *         description: Demasiadas consultas en un minuto
 *       503:
 *         description: El proveedor del modelo no respondió
 */
assistantRouter.post("/message", assistantLimiter, sendAssistantMessage);
