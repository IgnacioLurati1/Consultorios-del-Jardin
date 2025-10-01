import { Request, Response, NextFunction } from "express";
import { AppointmentService } from "./appointments.service.js";

const appointmentService = new AppointmentService();

export function sanitizeAppointmentInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    numAppointment: req.body.numAppointment,
    date: req.body.date,
    initialHour: req.body.initialHour,
    duration: req.body.duration,
    value: req.body.value,
    type: req.body.type,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

 
