import { Router } from 'express';
import {
  sanitizeScheduleInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  findByEmail,
  findByProfesionalLogged
} from './schedule.controller.js';
import { verifyAdmin } from '../config/middlewares.js';

export const scheduleRouter = Router();

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Obtener todos los horarios
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de horarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Schedule'
 */
scheduleRouter.get('/', findAll);

/**
 * @swagger
 * /api/schedules/profesional:
 *   get:
 *     summary: Obtener horarios del profesional logueado
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de horarios del profesional
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Schedule'
 *       401:
 *         description: No autorizado
 */
scheduleRouter.get('/profesional', findByProfesionalLogged);

/**
 * @swagger
 * /api/schedules/by-email/{email}:
 *   get:
 *     summary: Obtener horarios por email del profesional
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: Email del profesional
 *     responses:
 *       200:
 *         description: Lista de horarios del profesional
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Schedule'
 *       404:
 *         description: Profesional no encontrado
 */
scheduleRouter.get('/by-email/:email', findByEmail);

/**
 * @swagger
 * /api/schedules/by-day-hour/{day}/{initialHour}:
 *   get:
 *     summary: Obtener horario por día y hora
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: string
 *         description: Día del horario
 *       - in: path
 *         name: initialHour
 *         required: true
 *         schema:
 *           type: string
 *         description: Hora inicial
 *     responses:
 *       200:
 *         description: Horario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       404:
 *         description: Horario no encontrado
 */
scheduleRouter.get('/by-day-hour/:day/:initialHour', findOne);

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Crear nuevo horario
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleInput'
 *     responses:
 *       201:
 *         description: Horario creado con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       401:
 *         description: No autorizado
 */
scheduleRouter.post('/', sanitizeScheduleInput, add);

/**
 * @swagger
 * /api/schedules:
 *   put:
 *     summary: Actualizar horario
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleInput'
 *     responses:
 *       200:
 *         description: Horario actualizado con éxito
 *       401:
 *         description: No autorizado
 *   patch:
 *     summary: Actualizar horario parcialmente
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleInput'
 *     responses:
 *       200:
 *         description: Horario actualizado con éxito
 *       401:
 *         description: No autorizado
 */
scheduleRouter.put('/', sanitizeScheduleInput, update);
scheduleRouter.patch('/', sanitizeScheduleInput, update);

/**
 * @swagger
 * /api/schedules/by-day-hour/{day}/{initialHour}/{person}:
 *   delete:
 *     summary: Eliminar horario por día, hora y profesional
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: string
 *         description: Día del horario
 *       - in: path
 *         name: initialHour
 *         required: true
 *         schema:
 *           type: string
 *         description: Hora inicial
 *       - in: path
 *         name: person
 *         required: true
 *         schema:
 *           type: string
 *         description: Email del profesional
 *     responses:
 *       200:
 *         description: Horario eliminado con éxito
 *       404:
 *         description: Horario no encontrado
 */
scheduleRouter.delete('/by-day-hour/:day/:initialHour/:person', remove);