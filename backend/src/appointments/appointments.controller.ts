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
    office: req.body.office,
    professionalEmail: req.body.professionalEmail,
    room: req.body.room,
    observations: req.body.observations,
    patientEmail: req.body.patientEmail,
    state: req.body.state,
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

async function getPersonalMedicalHistory(req: RequestWithUser, res: Response) {
  try {
    const medicalHistory = await appointmentService.getPersonalMedicalHistory(req.user.email);
    res.status(200).json({ data: medicalHistory });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getPatientMedicalHistory(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const medicalHistory = await appointmentService.getPatientMedicalHistory(req.user.email, req.body.patientEmail);
    res.status(200).json({ data: medicalHistory });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getProfessionalAppointments(req: RequestWithUser, res: Response) {
  // Email is obtained from the authenticated user token
  // Additionally, it populates the room and diagnostics data for each appointment
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
    const diagnostic = await appointmentService.getAppointmentDiagnostics(numAppointment, req.user.email);
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
    const { date, initialHour, type, professionalEmail, office } = req.body.sanitizedInput;
    const appointment = await appointmentService.createPatientAppointment(
      req.user.email,
      date,
      initialHour,
      type,
      professionalEmail,
      office
    );
    res.status(201).json({ message: "Turno creado con éxito", data: appointment });
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
    //Devolver algo?
    res.status(200).json({ message: "Turno actualizado con éxito" });
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
    res.status(200).json({ message: "Turno eliminado con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function addObservation(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const patientEmail = req.body.sanitizedInput.patientEmail;
    const observations = req.body.sanitizedInput.observations;
    const diagnostic = await appointmentService.addObservation(numAppointment, req.user.email, observations, patientEmail);
    res.status(200).json({ message: "Observación añadida con éxito", data: diagnostic });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function acceptAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const appointment = await appointmentService.acceptAppointment(numAppointment, req.user.email);
    res.status(200).json({ message: "Turno aceptado exitosamente", data: appointment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function updateDiagnostic(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const { observations, state, patientEmail } = req.body.sanitizedInput;
    const diagnostic = await appointmentService.updateDiagnostic(numAppointment, patientEmail, req.user.email, { observations, state });
    res.status(200).json({ message: "Diagnóstico actualizado con éxito", data: diagnostic });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function cancelAppointment(req: RequestWithUser, res: Response) {
  try {
    const numAppointment = Number.parseInt(req.params.numAppointment);
    await appointmentService.cancelAppointment(numAppointment, req.user.email, req.user.type);
    res.status(200).json({ message: "Turno cancelado con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function createProfessionalAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const { date, initialHour, finalHour, room, value, type, patientEmail } = req.body.sanitizedInput;
    const professionalEmail = req.user.email;
    const appointment = await appointmentService.createProfessionalAppointment(
      date,
      initialHour,
      finalHour,
      type,
      room,
      value,
      professionalEmail,
      patientEmail
    );
    res.status(201).json({ message: "Turno creado con éxito", data: appointment });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function addPatientToAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Forbidden" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const patientEmail = req.body.sanitizedInput.patientEmail;

    const diagnostic = await appointmentService.addPatientToAppointment(numAppointment, patientEmail, req.user.email);
    res.status(201).json({ message: "Paciente añadido con éxito!", data: diagnostic });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getAvailableAppointmentsForPatient(req: RequestWithUser, res: Response) {
  try {
    const { office, professionalEmail } = req.body.sanitizedInput;
    const appointments = await appointmentService.getAvailableAppointmensForPatient(office, professionalEmail, req.user.email);
    res.status(200).json({ message: "Turnos posibles", data: appointments });
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
  addObservation,
  acceptAppointment,
  updateDiagnostic,
  cancelAppointment,
  createProfessionalAppointment,
  addPatientToAppointment,
  getAvailableAppointmentsForPatient,
};
