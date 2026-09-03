import { Router } from "express";
import {
  onlyProfessional,
  getSettings,
  updateSettings,
  acceptPending,
  addVacation,
  removeVacation,
  deletePatientAppointments,
} from "./settings.controller.js";

export const settingsRouter = Router();

settingsRouter.use(onlyProfessional);

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Configuración del consultorio del profesional logueado
 *     description: >
 *       Las dos automatizaciones (confirmar pedidos y cerrar turnos vencidos), cuántos
 *       pedidos están esperando respuesta ahora, los períodos de licencia cargados y los
 *       avisos por mail que se pueden apagar.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actual
 *       403:
 *         description: Solo para profesionales
 */
settingsRouter.get("/", getSettings);

/**
 * @swagger
 * /api/settings:
 *   patch:
 *     summary: Cambiar las automatizaciones
 *     description: >
 *       Los campos que no vengan quedan como estaban. `autoMark` en null apaga el cierre
 *       automático.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoAccept:
 *                 type: boolean
 *                 description: Confirmar solos los turnos que pide un paciente.
 *               autoMark:
 *                 type: string
 *                 nullable: true
 *                 enum: [assisted, missed]
 *                 description: Con qué estado se cierran los turnos vencidos. Null apaga.
 *               autoMarkWhen:
 *                 type: string
 *                 enum: [appointment, day]
 *                 description: Al terminar el turno, o al terminar el día.
 *               mails:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 description: >
 *                   Qué avisos por mail quiere recibir, por clave (`slot-freed`). Solo se
 *                   tocan las claves que vengan. Los mails de la cuenta (contraseña,
 *                   bienvenida, aviso de seguridad) no se pueden apagar y no están acá.
 *     responses:
 *       200:
 *         description: Configuración guardada
 */
settingsRouter.patch("/", updateSettings);

/**
 * @swagger
 * /api/settings/pending:
 *   post:
 *     summary: Confirmar de una todos los pedidos que están esperando
 *     description: >
 *       Acción de una sola vez, independiente de la confirmación automática: esa vale
 *       para los pedidos que entren de acá en adelante.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuántos pedidos se confirmaron
 */
settingsRouter.post("/pending", acceptPending);

/**
 * @swagger
 * /api/settings/vacations:
 *   post:
 *     summary: Cargar un período sin atender
 *     description: >
 *       Durante esos días el profesional no aparece en la búsqueda del paciente y no se
 *       ofrece ningún horario suyo. Los turnos ya dados no se tocan.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromDate, toDate]
 *             properties:
 *               fromDate:
 *                 type: string
 *                 format: date
 *               toDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Período cargado
 *       400:
 *         description: Fechas inválidas o pisadas con otro período
 */
settingsRouter.post("/vacations", addVacation);

/**
 * @swagger
 * /api/settings/vacations/{id}:
 *   delete:
 *     summary: Borrar un período sin atender
 *     tags: [Settings]
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
 *         description: Período borrado
 *       404:
 *         description: No existe o no es del profesional
 */
settingsRouter.delete("/vacations/:id", removeVacation);

/**
 * @swagger
 * /api/settings/patients/{email}/appointments:
 *   delete:
 *     summary: Borrar los turnos que el profesional tiene con un paciente
 *     description: >
 *       Definitivo: los turnos se van de la base con sus observaciones. Frena además las
 *       repeticiones con ese paciente, que si no volverían a generar lo borrado.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [future, all]
 *           default: future
 *         description: >
 *           `future` borra de hoy en adelante y conserva lo ya atendido. `all` se lleva
 *           también el historial.
 *     responses:
 *       200:
 *         description: Cuántos turnos se borraron
 *       404:
 *         description: Ese paciente no existe
 */
settingsRouter.delete("/patients/:email/appointments", deletePatientAppointments);
