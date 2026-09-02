import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
  getMyAnnouncements,
  setAnnouncementActive,
} from "./announcements.controller.js";

export const announcementRouter = Router();

/**
 * @swagger
 * /api/announcements/mine:
 *   get:
 *     summary: Los avisos que le tocan a quien está logueado
 *     description: >
 *       Los avisos publicados cuyo destinatario incluye al tipo de cuenta que consulta.
 *       Vienen con su `channel`: la página muestra los que van al panel y la app además
 *       usa los de notificación. Un admin no recibe ninguno: los escribe, no los lee.
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avisos vigentes para esa cuenta
 */
announcementRouter.get("/mine", getMyAnnouncements);

/**
 * @swagger
 * /api/announcements:
 *   get:
 *     summary: Todos los avisos, publicados y bajados (solo admin)
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial completo, del más nuevo al más viejo
 *       403:
 *         description: La cuenta no es de administrador
 *   post:
 *     summary: Publicar un aviso (solo admin)
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body, level, audience, channel]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 80
 *               body:
 *                 type: string
 *                 maxLength: 500
 *               level:
 *                 type: string
 *                 enum: [error, warning, news]
 *                 description: Error crítico (rojo), advertencia (amarillo) o novedad (verde)
 *               audience:
 *                 type: string
 *                 enum: [client, professional, both]
 *               channel:
 *                 type: string
 *                 enum: [banner, notification, both]
 *     responses:
 *       201:
 *         description: Aviso publicado
 *       400:
 *         description: Falta el título, el texto, o alguno de los tres no es un valor válido
 *       403:
 *         description: La cuenta no es de administrador
 */
announcementRouter.get("/", getAllAnnouncements);
announcementRouter.post("/", createAnnouncement);

/**
 * @swagger
 * /api/announcements/{id}:
 *   patch:
 *     summary: Bajar o volver a subir un aviso (solo admin)
 *     description: El texto no se edita. Lo que ya se comunicó se baja y se publica otro.
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Aviso actualizado
 *       404:
 *         description: Ese aviso no existe
 *   delete:
 *     summary: Borrar un aviso (solo admin)
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
 *         description: Ese aviso no existe
 */
announcementRouter.patch("/:id", setAnnouncementActive);
announcementRouter.delete("/:id", deleteAnnouncement);
