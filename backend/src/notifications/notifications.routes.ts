import { Router } from "express";
import {
  dismissAllNotifications,
  dismissNotification,
  getMyNotifications,
  markNotificationsSeen,
} from "./notifications.controller.js";

export const notificationRouter = Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Los avisos de quien está logueado
 *     description: >
 *       Los de los últimos tres días que todavía no borró, del más nuevo al más viejo,
 *       junto con cuántos no vio. El destino de cada uno viene como nombre (`appointments`,
 *       `booking`, `security`) y no como dirección, porque la página y la aplicación tienen
 *       rutas distintas para la misma pantalla.
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Los avisos y cuántos quedan sin ver
 *   delete:
 *     summary: Borrar todos los avisos propios
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avisos borrados
 */
notificationRouter.get("/", getMyNotifications);
notificationRouter.delete("/", dismissAllNotifications);

/**
 * @swagger
 * /api/notifications/seen:
 *   post:
 *     summary: Marcar como vistos todos los avisos propios
 *     description: Es lo que pasa al abrir la campanita. Apaga el número, no borra nada.
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avisos marcados como vistos
 */
notificationRouter.post("/seen", markNotificationsSeen);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Borrar un aviso propio
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Aviso borrado
 *       404:
 *         description: Ese aviso no existe, o no es de quien lo pide
 */
notificationRouter.delete("/:id", dismissNotification);
