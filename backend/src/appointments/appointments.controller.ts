import { Request, Response, NextFunction } from "express";
import { AppointmentService } from "./appointments.service.js";
import { sendError } from "../shared/errors.js";

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
    office: req.body.office,
    professionalEmail: req.body.professionalEmail,
    room: req.body.room,
    observations: req.body.observations,
    patientEmail: req.body.patientEmail,
    state: req.body.state,
    overbooked: req.body.overbooked,
    page: req.body.page,
    message: req.body.message,
    history: req.body.history,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

// GETS

// Los cancelados no se muestran salvo que se pidan expresamente (?includeCancelled=true)
function wantsCancelled(req: RequestWithUser): boolean {
  return req.query.includeCancelled === "true";
}

async function getPatientAppointments(req: RequestWithUser, res: Response) {
  // Email is obtained from the authenticated user token
  try {
    const page = Number.parseInt((req.params.page as string) || "0");
    const appointments = await appointmentService.findPatientAppointmentsByEmail(req.user.email, page, wantsCancelled(req));
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getDiagnostic(req: RequestWithUser, res: Response) {
  try {
    const numAppointment = Number.parseInt(req.params.numAppointment);
    const diagnostic = await appointmentService.getDiagnostic(req.user.email, numAppointment);
    res.status(200).json({ data: diagnostic });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getPersonalMedicalHistory(req: RequestWithUser, res: Response) {
  try {
    const medicalHistory = await appointmentService.getPersonalMedicalHistory(req.user.email);
    res.status(200).json({ data: medicalHistory });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getPatientMedicalHistory(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const medicalHistory = await appointmentService.getPatientMedicalHistory(req.user.email, req.params.patientEmail);
    res.status(200).json({ data: medicalHistory });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getProfessionalAppointments(req: RequestWithUser, res: Response) {
  // Email is obtained from the authenticated user token
  // Additionally, it populates the room and diagnostics data for each appointment
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });
    const page = Number.parseInt((req.params.page as string) || "0");
    const appointments = await appointmentService.findProfessionalAppointmentsByEmail(req.user.email, page, wantsCancelled(req));
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

// Solo admin. Vista de control: ve los turnos de cualquier profesional, sin diagnósticos
// y sin poder modificar nada.
async function getAppointmentsByProfessional(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "admin") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const page = Number.parseInt((req.params.page as string) || "0");
    // ?kind=overbooked | normal | all (por defecto, todos)
    const kind = req.query.kind === "overbooked" || req.query.kind === "normal" ? req.query.kind : "all";

    const appointments = await appointmentService.findProfessionalAppointmentsForAdmin(
      req.params.email,
      page,
      req.query.includePast === "true",
      kind
    );
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getAppointmentDiagnostics(req: RequestWithUser, res: Response) {
  // This method retrieves all diagnostics for a given appointment, professional only

  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const diagnostic = await appointmentService.getAppointmentDiagnostics(numAppointment, req.user.email);
    res.status(200).json({ data: diagnostic });
  } catch (error: any) {
    sendError(res, error);
  }
}

// Turnos del profesional logueado dentro de un rango de fechas (grilla semanal)
async function getProfessionalAppointmentsInRange(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return res.status(400).json({ message: "Faltan los parámetros from y to" });

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()))
      return res.status(400).json({ message: "Fechas inválidas" });

    const appointments = await appointmentService.findProfessionalAppointmentsInRange(
      req.user.email,
      fromDate,
      toDate,
      wantsCancelled(req)
    );
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getPendingAppointments(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const appointments = await appointmentService.findPendingProfessionalAppointmentsByEmail(req.user.email);
    res.status(200).json({ data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

// POST

async function createPatientAppointment(req: RequestWithUser, res: Response) {
  try {
    const { date, initialHour, professionalEmail, office } = req.body.sanitizedInput;
    const appointment = await appointmentService.createPatientAppointment(req.user.email, date, initialHour, professionalEmail, office);
    res.status(201).json({ message: "Turno creado con éxito", data: appointment });
  } catch (error: any) {
    sendError(res, error, { duplicate: "Ese horario ya está ocupado. Elegí otro" });
  }
}

// UPDATE

async function updateAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const { date, initialHour, room, value, finalHour } = req.body.sanitizedInput;
    const appointment = await appointmentService.updateAppointment(numAppointment, req.user.email, {
      date,
      initialHour,
      room,
      value,
      finalHour,
    });

    res.status(200).json({ message: "Turno actualizado con éxito" });
  } catch (error: any) {
    sendError(res, error, {
      duplicate: "Ya tenés otro turno en esa fecha y horario",
      missing: "Ese turno no existe, ya fue cancelado o no es tuyo",
    });
  }
}

// DELETE
// This delete only allows deleting appointments that have not been cancelled or confirmed yet
async function deleteAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const appointment = await appointmentService.deleteAppointment(numAppointment, req.user.email);

    res.status(200).json({ message: "Turno eliminado con éxito" });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function addObservation(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const patientEmail = req.body.sanitizedInput.patientEmail;
    const observations = req.body.sanitizedInput.observations;
    const diagnostic = await appointmentService.addObservation(numAppointment, req.user.email, observations, patientEmail);
    res.status(200).json({ message: "Observación añadida con éxito", data: diagnostic });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function acceptAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const appointment = await appointmentService.acceptAppointment(numAppointment, req.user.email);

    res.status(200).json({ message: "Turno aceptado exitosamente" });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function updateDiagnostic(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const { observations, state, patientEmail } = req.body.sanitizedInput;
    const diagnostic = await appointmentService.updateDiagnostic(numAppointment, patientEmail, req.user.email, { observations, state });
    res.status(200).json({ message: "Diagnóstico actualizado con éxito", data: diagnostic });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function cancelAppointment(req: RequestWithUser, res: Response) {
  try {
    const numAppointment = Number.parseInt(req.params.numAppointment);
    const appointment = await appointmentService.cancelAppointment(numAppointment, req.user.email, req.user.type);

    res.status(200).json({ message: "Turno cancelado con éxito" });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function createProfessionalAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const { date, initialHour, finalHour, room, value, patientEmail, overbooked } = req.body.sanitizedInput;
    const professionalEmail = req.user.email;
    const appointment = await appointmentService.createProfessionalAppointment(
      date,
      initialHour,
      finalHour,
      room,
      value,
      professionalEmail,
      patientEmail,
      overbooked === true
    );
    res.status(201).json({ message: "Turno creado con éxito", data: appointment });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function addPatientToAppointment(req: RequestWithUser, res: Response) {
  try {
    if (req.user.type !== "professional") return res.status(403).json({ message: "Esta acción es solo para profesionales" });

    const numAppointment = Number.parseInt(req.params.numAppointment);
    const patientEmail = req.body.sanitizedInput.patientEmail;

    await appointmentService.addPatientToAppointment(numAppointment, patientEmail, req.user.email);

    res.status(201).json({ message: "Paciente añadido con éxito!" });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function getAvailableAppointmentsForPatient(req: RequestWithUser, res: Response) {
  try {
    const { office, professionalEmail } = req.body.sanitizedInput;
    const appointments = await appointmentService.getAvailableAppointmensForPatient(office, professionalEmail, req.user.email);
    res.status(200).json({ message: "Turnos posibles", data: appointments });
  } catch (error: any) {
    sendError(res, error);
  }
}

export {
  getPatientAppointments,
  getDiagnostic,
  getProfessionalAppointments,
  getProfessionalAppointmentsInRange,
  getAppointmentsByProfessional,
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
  getPersonalMedicalHistory,
  getPatientMedicalHistory,
};
