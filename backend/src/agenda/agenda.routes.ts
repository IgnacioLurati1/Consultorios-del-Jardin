import { Router } from "express";
import { getDay, getWeek } from "./agenda.controller.js";
import { verifyAdmin } from "../config/middlewares.js";

/**
 * La agenda del consultorio entero, mirada por día.
 *
 * Todo el router es solo para el admin: acá se ven los pacientes y los horarios de todo
 * el equipo junto. Por eso el `verifyAdmin` va a nivel del router y no repetido en cada
 * endpoint: así una ruta nueva nace protegida y no hay que acordarse.
 */
export const agendaRouter = Router();

agendaRouter.use(verifyAdmin);

/**
 * @swagger
 * /api/agenda/week:
 *   get:
 *     summary: Cómo viene la semana, día por día (solo admin)
 *     description: >
 *       Por cada día: a qué hora abre y cierra el consultorio (y quién), la franja de una
 *       hora con más turnos solapados con el detalle de esos turnos, y cuántos pacientes y
 *       profesionales van a pasar. La apertura mira los módulos de atención y los turnos
 *       juntos: un sobreturno temprano también obliga a abrir.
 *     tags: [Agenda]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: weeksAhead
 *         schema: { type: integer, enum: [0, 1], default: 0 }
 *         description: 0 es la semana en curso, 1 la que viene.
 *     responses:
 *       200:
 *         description: Los siete días, de lunes a domingo
 *       403:
 *         description: Solo para el administrador
 */
agendaRouter.get("/week", getWeek);

/**
 * @swagger
 * /api/agenda/day/{date}:
 *   get:
 *     summary: Los horarios y los turnos de un día, por consultorio (solo admin)
 *     description: >
 *       Devuelve las dos cosas en la misma respuesta porque la pantalla alterna entre
 *       ellas con un botón. Los turnos cancelados no vienen; su cantidad sí, en `cancelled`.
 *     tags: [Agenda]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-09-01" }
 *         description: La fecha, como AAAA-MM-DD.
 *     responses:
 *       200:
 *         description: Salas, módulos de atención y turnos de ese día
 *       400:
 *         description: La fecha no tiene el formato esperado
 *       403:
 *         description: Solo para el administrador
 */
agendaRouter.get("/day/:date", getDay);
