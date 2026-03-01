import { Router } from "express";
import {
  getPatientAppointments,
  getDiagnostic,
  getProfessionalAppointments,
  getAppointmentDiagnostics,
  createPatientAppointment,
  getPendingAppointments,
  updateAppointment,
  deleteAppointment,
  sanitizeAppointmentInput,
  addObservation,
  acceptAppointment,
  updateDiagnostic,
  cancelAppointment,
  createProfessionalAppointment,
  addPatientToAppointment,
  getAvailableAppointmentsForPatient,
  getPatientMedicalHistory,
  getPersonalMedicalHistory,
} from "./appointments.controller.js";

export const appointmentRouter = Router();

/**
 * @swagger
 * /api/appointments/patient/{page}:
 *   get:
 *     summary: Obtener turnos del paciente logueado
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número de página
 *     responses:
 *       200:
 *         description: Lista de turnos del paciente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
appointmentRouter.get("/patient/:page", getPatientAppointments);

/**
 * @swagger
 * /api/appointments/professional/{page}:
 *   get:
 *     summary: Obtener turnos del profesional logueado
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número de página
 *     responses:
 *       200:
 *         description: Lista de turnos del profesional
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
appointmentRouter.get("/professional/:page", getProfessionalAppointments);

/**
 * @swagger
 * /api/appointments/pending:
 *   get:
 *     summary: Obtener turnos pendientes
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de turnos pendientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
appointmentRouter.get("/pending", getPendingAppointments);

/**
 * @swagger
 * /api/appointments/medical-history:
 *   get:
 *     summary: Obtener historial médico personal del paciente logueado
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial médico personal
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
appointmentRouter.get("/medical-history", getPersonalMedicalHistory);

/**
 * @swagger
 * /api/appointments/medical-history/{patientEmail}:
 *   get:
 *     summary: Obtener historial médico de un paciente por email
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientEmail
 *         required: true
 *         schema:
 *           type: string
 *         description: Email del paciente
 *     responses:
 *       200:
 *         description: Historial médico del paciente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 */
appointmentRouter.get("/medical-history/:patientEmail", getPatientMedicalHistory);

/**
 * @swagger
 * /api/appointments/{numAppointment}/diagnostic:
 *   get:
 *     summary: Obtener diagnóstico de un turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Diagnóstico encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Diagnostic'
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.get("/:numAppointment/diagnostic", getDiagnostic);

/**
 * @swagger
 * /api/appointments/{numAppointment}/diagnostics:
 *   get:
 *     summary: Obtener todos los diagnósticos de un turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de diagnósticos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Diagnostic'
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.get("/:numAppointment/diagnostics", getAppointmentDiagnostics);

/**
 * @swagger
 * /api/appointments/{numAppointment}/observations:
 *   patch:
 *     summary: Agregar observación a un diagnóstico
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiagnosticInput'
 *     responses:
 *       200:
 *         description: Observación agregada con éxito
 */
appointmentRouter.patch("/:numAppointment/observations", sanitizeAppointmentInput, addObservation);

/**
 * @swagger
 * /api/appointments/{numAppointment}/accept:
 *   patch:
 *     summary: Aceptar un turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno aceptado con éxito
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.patch("/:numAppointment/accept", sanitizeAppointmentInput, acceptAppointment);

/**
 * @swagger
 * /api/appointments/{numAppointment}/cancel:
 *   patch:
 *     summary: Cancelar un turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno cancelado con éxito
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.patch("/:numAppointment/cancel", cancelAppointment);

/**
 * @swagger
 * /api/appointments/getAppointments:
 *   post:
 *     summary: Obtener turnos disponibles para un paciente
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professional:
 *                 type: string
 *                 example: doctor@mail.com
 *               date:
 *                 type: string
 *                 format: date
 *                 example: '2026-03-15'
 *     responses:
 *       200:
 *         description: Lista de turnos disponibles
 */
appointmentRouter.post("/getAppointments", sanitizeAppointmentInput, getAvailableAppointmentsForPatient);

/**
 * @swagger
 * /api/appointments/professional:
 *   post:
 *     summary: Crear turno como profesional
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       201:
 *         description: Turno creado con éxito
 *       401:
 *         description: No autorizado
 */
appointmentRouter.post("/professional", sanitizeAppointmentInput, createProfessionalAppointment);

/**
 * @swagger
 * /api/appointments/patient/{numAppointment}:
 *   post:
 *     summary: Agregar paciente a un turno existente
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientEmail:
 *                 type: string
 *                 example: paciente@mail.com
 *     responses:
 *       200:
 *         description: Paciente agregado con éxito
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.post("/patient/:numAppointment", sanitizeAppointmentInput, addPatientToAppointment);

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Crear turno como paciente
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       201:
 *         description: Turno creado con éxito
 *       401:
 *         description: No autorizado
 */
appointmentRouter.post("/", sanitizeAppointmentInput, createPatientAppointment);

/**
 * @swagger
 * /api/appointments/{numAppointment}/diagnostic:
 *   put:
 *     summary: Actualizar diagnóstico de un turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiagnosticInput'
 *     responses:
 *       200:
 *         description: Diagnóstico actualizado con éxito
 *   patch:
 *     summary: Actualizar diagnóstico parcialmente
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiagnosticInput'
 *     responses:
 *       200:
 *         description: Diagnóstico actualizado con éxito
 */
appointmentRouter.put("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.patch("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);

/**
 * @swagger
 * /api/appointments/{numAppointment}:
 *   put:
 *     summary: Actualizar turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       200:
 *         description: Turno actualizado con éxito
 *   patch:
 *     summary: Actualizar turno parcialmente
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       200:
 *         description: Turno actualizado con éxito
 *   delete:
 *     summary: Eliminar turno
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: numAppointment
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno eliminado con éxito
 *       404:
 *         description: Turno no encontrado
 */
appointmentRouter.put("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.patch("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.delete("/:numAppointment", deleteAppointment);