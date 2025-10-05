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
appointmentRouter.get("/:numAppointment/diagnostic", getDiagnostic);
appointmentRouter.get("/:numAppointment/diagnostics", getAppointmentDiagnostics);
appointmentRouter.patch("/:numAppointment/observations", sanitizeAppointmentInput, addObservation);
appointmentRouter.patch("/:numAppointment/accept", sanitizeAppointmentInput, acceptAppointment);
appointmentRouter.patch("/:numAppointment/cancel", cancelAppointment);
appointmentRouter.post("/", sanitizeAppointmentInput, createPatientAppointment);
appointmentRouter.put("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.patch("/:numAppointment/diagnostic", sanitizeAppointmentInput, updateDiagnostic);
appointmentRouter.put("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.patch("/:numAppointment", sanitizeAppointmentInput, updateAppointment);
appointmentRouter.delete("/:numAppointment", deleteAppointment);
