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
  generateSecretaryResponse,
} from "./appointments.controller.js";

export const appointmentRouter = Router();

appointmentRouter.get("/patient/:page", getPatientAppointments);
appointmentRouter.get("/professional/:page", getProfessionalAppointments);
appointmentRouter.get("/pending", getPendingAppointments);
appointmentRouter.get("/:numAppointment/diagnostic", getDiagnostic);
appointmentRouter.get("/:numAppointment/diagnostics", getAppointmentDiagnostics);
appointmentRouter.get("/medical-history", getPersonalMedicalHistory);
appointmentRouter.get("/medical-history/:patientEmail", getPatientMedicalHistory);

appointmentRouter.patch("/:numAppointment/observations", sanitizeAppointmentInput, addObservation);
appointmentRouter.patch("/:numAppointment/accept", sanitizeAppointmentInput, acceptAppointment);
appointmentRouter.patch("/:numAppointment/cancel", cancelAppointment);

appointmentRouter.post("/getAppointments", sanitizeAppointmentInput, getAvailableAppointmentsForPatient);
appointmentRouter.post("/professional", sanitizeAppointmentInput, createProfessionalAppointment);
appointmentRouter.post("/patient/:numAppointment", sanitizeAppointmentInput, addPatientToAppointment);
appointmentRouter.post("/", sanitizeAppointmentInput, createPatientAppointment);
appointmentRouter.post("/secretary-response", sanitizeAppointmentInput, generateSecretaryResponse);

appointmentRouter.put("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.patch("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.put("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.patch("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.delete("/:numAppointment", deleteAppointment);
