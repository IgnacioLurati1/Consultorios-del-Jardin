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
} from "./appointments.controller.js";

export const appointmentRouter = Router();

appointmentRouter.get("/patient", getPatientAppointments);
appointmentRouter.get("/professional", getProfessionalAppointments);
appointmentRouter.get("/pending", getPendingAppointments);
appointmentRouter.get("/:id/diagnostic", getDiagnostic);
appointmentRouter.get("/:id/diagnostics", getAppointmentDiagnostics);
appointmentRouter.post("/:numAppointment/observations", sanitizeAppointmentInput, addObservation);
appointmentRouter.post("/:numAppointment/accept", sanitizeAppointmentInput, acceptAppointment);
appointmentRouter.post("/:numAppointment/cancel", cancelAppointment);
appointmentRouter.post("/", sanitizeAppointmentInput, createPatientAppointment);
appointmentRouter.put("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.patch("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.put("/:id", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.patch("/:id", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.delete("/:id", deleteAppointment);
