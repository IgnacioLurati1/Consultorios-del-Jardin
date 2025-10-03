import { Request, Response, NextFunction } from "express";
import { AppointmentService } from "./appointments.service.js";

interface RequestWithUser extends Request {
  user?: any;
}

const appointmentService = new AppointmentService();

function sanitizeAppointmentInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    numAppointment: req.body.numAppointment,
    date: req.body.date,
    initialHour: req.body.initialHour,
    finalHour: req.body.finalHour,
    value: req.body.value,
    type: req.body.type,
    idOffice: req.body.idOffice,
    professionalEmail: req.body.professionalEmail,
    room: req.body.room,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

// GETS

async function getPatientAppointments(req: RequestWithUser, res: Response) {
  // This method does not retrieve diagnostics, only appointments
  // Email is obtained from the authenticated user token
  try {
    const appointments = await appointmentService.findPatientAppointmentsByEmail(req.user.email);
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getDiagnostic(req: RequestWithUser, res: Response) {
  try {
    const numAppointment = Number.parseInt(req.params.numAppointment);
    const diagnostic = await appointmentService.getDiagnostic(req.user.email, numAppointment);
    res.status(200).json({ data: diagnostic });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getProfessionalAppointments(req: RequestWithUser, res: Response) {
  // This method does not retrieve diagnostics, only appointments
  // Email is obtained from the authenticated user token
  // Additionally, it populates the room and office data for each appointment
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });
    const appointments = await appointmentService.findProfessionalAppointmentsByEmail(req.user.email);
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getAppointmentDiagnostics(req: RequestWithUser, res: Response) {
  // This method retrieves all diagnostics for a given appointment, professional only

  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const diagnostic = await appointmentService.getAppointmentDiagnostics(numAppointment);
    res.status(200).json({ data: diagnostic });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getPendingAppointments(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const appointments = await appointmentService.findPendingProfessionalAppointmentsByEmail(req.user.email);
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// POST

async function createPatientAppointment(req: RequestWithUser, res: Response) {
  try {
    const { date, initialHour, type, professionalEmail, officeId } = req.body.sanitizedInput;
    const appointment = await appointmentService.createPatientAppointment(
      req.user.email,
      date,
      initialHour,
      type,
      professionalEmail,
      officeId
    );
    res.status(201).json({ message: "Appointment created successfully", data: appointment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// UPDATE

async function updateAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const { date, initialHour, type, room, value, finalHour } = req.body.sanitizedInput;

    const appointment = await appointmentService.updateAppointment(numAppointment, req.user.email, {
      date,
      initialHour,
      type,
      room,
      value,
      finalHour,
    });

    res.status(200).json({ message: "Appointment updated successfully", data: appointment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// DELETE
// This delete only allows deleting appointments that have not been cancelled or confirmed yet
async function deleteAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    await appointmentService.deleteAppointment(numAppointment, req.user.email);
    res.status(200).json({ message: "Appointment deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export {
  getPatientAppointments,
  getDiagnostic,
  getProfessionalAppointments,
  getAppointmentDiagnostics,
  createPatientAppointment,
  getPendingAppointments,
  updateAppointment,
  deleteAppointment,
  sanitizeAppointmentInput,
};
