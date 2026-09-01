import { Router } from "express";
import { onlyProfessional, getRecurrences, createRecurrence, updateRecurrence, stopRecurrence } from "./recurrences.controller.js";

export const recurrenceRouter = Router();

recurrenceRouter.use(onlyProfessional);

/**
 * @swagger
 * /api/recurrences:
 *   get:
 *     summary: Turnos repetibles activos del profesional logueado
 *     tags: [Recurrences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repeticiones con sus próximos turnos ya generados
 *       403:
 *         description: Solo para profesionales
 */
recurrenceRouter.get("/", getRecurrences);

/**
 * @swagger
 * /api/recurrences:
 *   post:
 *     summary: Marcar un turno como repetible (semanal o quincenal)
 *     description: >
 *       Crea la repetición a partir de un turno existente y deja generados los turnos
 *       de las próximas cuatro semanas. Como el paciente solo puede sacar turno a
 *       catorce días, no puede pisar ninguno de esos horarios.
 *     tags: [Recurrences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [numAppointment, frequency]
 *             properties:
 *               numAppointment:
 *                 type: integer
 *               frequency:
 *                 type: string
 *                 enum: [weekly, biweekly]
 *     responses:
 *       201:
 *         description: Repetición creada, con cuántos turnos generó
 *       404:
 *         description: El turno no existe, está cancelado o no es del profesional
 *       409:
 *         description: Ese turno ya se está repitiendo
 */
recurrenceRouter.post("/", createRecurrence);

/**
 * @swagger
 * /api/recurrences/{idRecurrence}:
 *   patch:
 *     summary: Cambiar la configuración de una repetición
 *     description: >
 *       Afecta solo a los turnos que falta generar. Los que ya están creados no se
 *       tocan: se editan o se cancelan uno por uno, como cualquier otro turno.
 *     tags: [Recurrences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRecurrence
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Repetición actualizada
 *       404:
 *         description: No existe o no es del profesional
 */
recurrenceRouter.patch("/:idRecurrence", updateRecurrence);

/**
 * @swagger
 * /api/recurrences/{idRecurrence}:
 *   delete:
 *     summary: Frenar la generación automática
 *     description: No borra ni modifica los turnos ya creados.
 *     tags: [Recurrences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRecurrence
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Repetición frenada
 *       404:
 *         description: No existe o no es del profesional
 */
recurrenceRouter.delete("/:idRecurrence", stopRecurrence);
