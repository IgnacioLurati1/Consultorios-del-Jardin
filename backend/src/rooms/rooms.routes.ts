import { Router } from "express";
import { findAll, findAllActive, findOne, add, update, toggleRoomState, sanitizeRoomInput, findRoomsByOfficeAndProfessional } from "./rooms.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const roomRouter = Router();

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: Obtener todos los consultorios
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de consultorios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
roomRouter.get("/", verifyAdmin, findAll);

/**
 * @swagger
 * /api/rooms/active:
 *   get:
 *     summary: Obtener todos los consultorios activos
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: Lista de consultorios activos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *       500:
 *         description: Error del servidor
 */
roomRouter.get("/active", findAllActive);

/**
 * @swagger
 * /api/rooms/office/professional/{officeId}/{email}:
 *   get:
 *     summary: Obtener consultorios por oficina y profesional
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: officeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la oficina
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email del profesional
 *     responses:
 *       200:
 *         description: Lista de consultorios del profesional en la oficina
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *       500:
 *         description: Error del servidor
 */
roomRouter.get("/office/professional/:officeId/:email", findRoomsByOfficeAndProfessional);

/**
 * @swagger
 * /api/rooms/{idRoom}:
 *   get:
 *     summary: Obtener consultorio por ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: idRoom
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Consultorio encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       500:
 *         description: Error del servidor
 */
roomRouter.get("/:idRoom", findOne);

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Crear nuevo consultorio
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomInput'
 *     responses:
 *       201:
 *         description: Consultorio creado con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
roomRouter.post("/", verifyAdmin, sanitizeRoomInput, add);

/**
 * @swagger
 * /api/rooms/{idRoom}:
 *   put:
 *     summary: Actualizar consultorio
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRoom
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomInput'
 *     responses:
 *       200:
 *         description: Consultorio actualizado con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 *   patch:
 *     summary: Actualizar consultorio parcialmente
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRoom
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomInput'
 *     responses:
 *       200:
 *         description: Consultorio actualizado con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
roomRouter.put("/:idRoom", verifyAdmin, sanitizeRoomInput, update);
roomRouter.patch("/:idRoom", verifyAdmin, sanitizeRoomInput, update);

/**
 * @swagger
 * /api/rooms/{idRoom}/toggle-state:
 *   patch:
 *     summary: Cambiar estado activo/inactivo de un consultorio
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRoom
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del consultorio
 *     responses:
 *       200:
 *         description: Estado cambiado con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
roomRouter.patch("/:idCity/toggle-state", verifyAdmin, sanitizeRoomInput, toggleRoomState);