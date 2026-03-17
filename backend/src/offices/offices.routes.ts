import { Router } from 'express'
import { sanitizeOfficeInput, findAll, findOne, add, update, toggleOfficeState, findAllActive, findAllOfficesByProfessional } from './offices.controller.js'
import { verifyAdmin } from "../config/middlewares.js";

export const officeRouter = Router()

/**
 * @swagger
 * /api/offices:
 *   get:
 *     summary: Obtener todas las oficinas
 *     tags: [Offices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de oficinas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Office'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
officeRouter.get('/', verifyAdmin, findAll)

/**
 * @swagger
 * /api/offices/active:
 *   get:
 *     summary: Obtener todas las oficinas activas
 *     tags: [Offices]
 *     responses:
 *       200:
 *         description: Lista de oficinas activas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Office'
 *       500:
 *         description: Error del servidor
 */
officeRouter.get('/active', findAllActive)

/**
 * @swagger
 * /api/offices/professional/{email}:
 *   get:
 *     summary: Obtener oficinas por profesional
 *     tags: [Offices]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email del profesional
 *     responses:
 *       200:
 *         description: Lista de oficinas del profesional
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Office'
 *       500:
 *         description: Error del servidor
 */
officeRouter.get('/professional/:email', findAllOfficesByProfessional)

/**
 * @swagger
 * /api/offices/{idOffice}:
 *   get:
 *     summary: Obtener oficina por ID
 *     tags: [Offices]
 *     parameters:
 *       - in: path
 *         name: idOffice
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Oficina encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Office'
 *       500:
 *         description: Error del servidor
 */
officeRouter.get('/:idOffice', findOne)

/**
 * @swagger
 * /api/offices:
 *   post:
 *     summary: Crear nueva oficina
 *     tags: [Offices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfficeInput'
 *     responses:
 *       201:
 *         description: Oficina creada con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Office'
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
officeRouter.post('/', verifyAdmin, sanitizeOfficeInput, add)

/**
 * @swagger
 * /api/offices/{idOffice}:
 *   put:
 *     summary: Actualizar oficina
 *     tags: [Offices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idOffice
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfficeInput'
 *     responses:
 *       200:
 *         description: Oficina actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 *   patch:
 *     summary: Actualizar oficina parcialmente
 *     tags: [Offices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idOffice
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OfficeInput'
 *     responses:
 *       200:
 *         description: Oficina actualizada con éxito
 *       401:
 *         description: Token ausente, inválido o expirado
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error del servidor
 */
officeRouter.put('/:idOffice', verifyAdmin, sanitizeOfficeInput, update)
officeRouter.patch('/:idOffice', verifyAdmin, sanitizeOfficeInput, update)

/**
 * @swagger
 * /api/offices/{idOffice}/toggle:
 *   patch:
 *     summary: Cambiar estado activo/inactivo de una oficina
 *     tags: [Offices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idOffice
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
officeRouter.patch('/:idOffice/toggle', verifyAdmin, toggleOfficeState)