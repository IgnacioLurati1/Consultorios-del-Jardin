import { Router } from "express";
import { getMyAnalytics, getProfessionalAnalytics, getOfficeAnalytics, getAssistantUsage } from "./analytics.controller.js";

export const analyticsRouter = Router();

/**
 * @swagger
 * /api/analytics/me:
 *   get:
 *     summary: Analytics del profesional logueado
 *     description: >
 *       Devuelve el mes en curso aparte de los meses cerrados. El mes en curso no entra
 *       en los gráficos: un mes a medio andar dibuja siempre una caída que no significa nada.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mes en curso, acumulado de los meses cerrados y serie mensual
 *       403:
 *         description: Solo para profesionales
 */
analyticsRouter.get("/me", getMyAnalytics);

/**
 * @swagger
 * /api/analytics/office:
 *   get:
 *     summary: Analytics del consultorio entero (solo admin)
 *     description: Cada métrica viene además dividida por la cantidad de profesionales activos.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Números del consultorio y listado de profesionales
 *       403:
 *         description: Solo para el administrador
 */
analyticsRouter.get("/office", getOfficeAnalytics);

/**
 * @swagger
 * /api/analytics/professional/{email}:
 *   get:
 *     summary: Analytics de un profesional puntual (solo admin)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Los mismos números que ve el profesional
 *       403:
 *         description: Solo para el administrador
 *       404:
 *         description: Ese profesional no existe
 */
analyticsRouter.get("/professional/:email", getProfessionalAnalytics);

/**
 * @swagger
 * /api/analytics/assistant:
 *   get:
 *     summary: Consumo y uso del asistente
 *     description: >
 *       Tokens gastados contra el proveedor del modelo y ranking de herramientas más
 *       usadas, del mes en curso y del histórico. Solo para administradores.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Uso del asistente
 *       403:
 *         description: La cuenta no es de administrador
 */
analyticsRouter.get("/assistant", getAssistantUsage);
