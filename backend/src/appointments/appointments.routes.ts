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
} from "./appointments.controller.js";

export const appointmentRouter = Router();

appointmentRouter.get("/patient", getPatientAppointments);
appointmentRouter.get("/professional", getProfessionalAppointments);
appointmentRouter.get("/pending", getPendingAppointments);
appointmentRouter.get("/:id/diagnostic", getDiagnostic);
appointmentRouter.get("/:id/diagnostics", getAppointmentDiagnostics);
appointmentRouter.post("/", sanitizeAppointmentInput, createPatientAppointment);
appointmentRouter.put("/:id", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.delete("/:id", deleteAppointment);
