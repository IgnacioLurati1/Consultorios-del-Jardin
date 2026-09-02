import { Router } from "express";
import { getBehaviourReport, getCompromisedAccounts } from "./security.controller.js";

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

/**
 * @swagger
 * /api/security/compromised:
 *   get:
 *     summary: Cuentas cerradas por posible intrusión, con lo que tocaron antes de caer
 *     description: >
 *       Una cuenta entra en esta lista cuando toca endpoints administrativos delicados a
 *       un ritmo que no es de una persona, o cuando lo hace de madrugada con el
 *       consultorio cerrado. `trail` es lo que tocó en la hora previa a la baja, con el
 *       estado con el que respondió el servidor: es lo que hay que mirar para decidir si
 *       la cuenta se vuelve a habilitar y si hay algo que deshacer.
 *     tags: [Seguridad]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuentas comprometidas y las reglas vigentes
 *       403:
 *         description: La cuenta no es de administrador
 */
securityRouter.get("/compromised", getCompromisedAccounts);
