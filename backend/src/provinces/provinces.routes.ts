import { Router } from "express";
import { sanitizeProvinceInput, findAll, findAllActive, findOne, add, update, toggleProvinceState } from "./provinces.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

export const provinceRouter = Router();

/**
 * @swagger
 * /api/provinces:
 *   get:
 *     summary: Obtener todas las provincias
 *     tags: [Provinces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de provincias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Province'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
provinceRouter.get("/", verifyAdmin, findAll);

/**
 * @swagger
 * /api/provinces/active:
 *   get:
 *     summary: Obtener todas las provincias activas
 *     tags: [Provinces]
 *     responses:
 *       200:
 *         description: Lista de provincias activas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Province'
 *       500:
 *         description: Error del servidor
 */
provinceRouter.get("/active", findAllActive);

/**
 * @swagger
 * /api/provinces/{idProvince}:
 *   get:
 *     summary: Obtener provincia por ID
 *     tags: [Provinces]
 *     parameters:
 *       - in: path
 *         name: idProvince
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Provincia encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Province'
 *       500:
 *         description: Error del servidor
 */
provinceRouter.get("/:idProvince", findOne);

/**
 * @swagger
 * /api/provinces:
 *   post:
 *     summary: Crear nueva provincia
 *     tags: [Provinces]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProvinceInput'
 *     responses:
 *       201:
 *         description: Provincia creada con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Province'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
provinceRouter.post("/", verifyAdmin, sanitizeProvinceInput, add);

/**
 * @swagger
 * /api/provinces/{idProvince}:
 *   put:
 *     summary: Actualizar provincia
 *     tags: [Provinces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idProvince
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProvinceInput'
 *     responses:
 *       200:
 *         description: Provincia actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 *   patch:
 *     summary: Actualizar provincia parcialmente
 *     tags: [Provinces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idProvince
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProvinceInput'
 *     responses:
 *       200:
 *         description: Provincia actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
provinceRouter.put("/:idProvince", verifyAdmin, sanitizeProvinceInput, update);
provinceRouter.patch("/:idProvince", verifyAdmin, sanitizeProvinceInput, update);

/**
 * @swagger
 * /api/provinces/{idProvince}/toggle-state:
 *   patch:
 *     summary: Cambiar estado activo/inactivo de una provincia
 *     tags: [Provinces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idProvince
 *         required: true
 *         schema:
 *           type: integer
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
provinceRouter.patch("/:idProvince/toggle-state", verifyAdmin, sanitizeProvinceInput, toggleProvinceState);