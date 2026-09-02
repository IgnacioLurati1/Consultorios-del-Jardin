import { Router } from "express";
import { getBehaviourReport } from "./security.controller.js";

export const securityRouter = Router();

/**
 * @swagger
 * /api/security/behaviour:
 *   get:
 *     summary: Cuentas deshabilitadas por el sistema y pacientes que faltan seguido
 *     description: >
 *       Dos listas y las reglas con las que se armaron. `banned` son cuentas que el
 *       sistema deshabilitó solo por el ritmo con el que sacaban turnos. `suspicious`
 *       son cuentas sanas cuya asistencia quedó por debajo del umbral: no tienen
 *       ninguna penalización, están para que el admin las mire.
 *     tags: [Seguridad]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informe de comportamiento
 *       403:
 *         description: La cuenta no es de administrador
 */
securityRouter.get("/behaviour", getBehaviourReport);
