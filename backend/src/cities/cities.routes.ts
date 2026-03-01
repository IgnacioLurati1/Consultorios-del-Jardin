import { Router } from "express";
import { findAll, findAllActive, findOne, add, update, toggleCityState, sanitizeCityInput } from "./cities.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const cityRouter = Router();

/**
 * @swagger
 * /api/cities:
 *   get:
 *     summary: Obtener todas las ciudades
 *     tags: [Cities]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ciudades
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
 *       401:
 *         description: No autorizado
 */
cityRouter.get("/", verifyAdmin, findAll);

/**
 * @swagger
 * /api/cities/active:
 *   get:
 *     summary: Obtener todas las ciudades activas
 *     tags: [Cities]
 *     responses:
 *       200:
 *         description: Lista de ciudades activas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
 */
cityRouter.get("/active", findAllActive);

/**
 * @swagger
 * /api/cities/{idCity}:
 *   get:
 *     summary: Obtener ciudad por ID
 *     tags: [Cities]
 *     parameters:
 *       - in: path
 *         name: idCity
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ciudad encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       404:
 *         description: Ciudad no encontrada
 */
cityRouter.get("/:idCity", findOne);

/**
 * @swagger
 * /api/cities:
 *   post:
 *     summary: Crear nueva ciudad
 *     tags: [Cities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CityInput'
 *     responses:
 *       201:
 *         description: Ciudad creada con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       401:
 *         description: No autorizado
 */
cityRouter.post("/", verifyAdmin, sanitizeCityInput, add);

/**
 * @swagger
 * /api/cities/{idCity}:
 *   put:
 *     summary: Actualizar ciudad
 *     tags: [Cities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCity
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CityInput'
 *     responses:
 *       200:
 *         description: Ciudad actualizada con éxito
 *       401:
 *         description: No autorizado
 *   patch:
 *     summary: Actualizar ciudad parcialmente
 *     tags: [Cities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCity
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CityInput'
 *     responses:
 *       200:
 *         description: Ciudad actualizada con éxito
 *       401:
 *         description: No autorizado
 */
cityRouter.put("/:idCity", verifyAdmin, sanitizeCityInput, update);
cityRouter.patch("/:idCity", verifyAdmin, sanitizeCityInput, update);

/**
 * @swagger
 * /api/cities/{idCity}/toggle-state:
 *   patch:
 *     summary: Cambiar estado activo/inactivo de una ciudad
 *     tags: [Cities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCity
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado cambiado con éxito
 *       401:
 *         description: No autorizado
 */
cityRouter.patch("/:idCity/toggle-state", verifyAdmin, sanitizeCityInput, toggleCityState);