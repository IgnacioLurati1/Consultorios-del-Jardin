import { Request, Response, NextFunction } from "express";
import { ScheduleService } from "./schedule.service.js";

interface RequestWithUser extends Request {
  user?: any;
}

function sanitizeScheduleInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    day: req.body.day,
    initialHour: req.body.initialHour,
    person: req.body.person,
    room: req.body.room,
    finalHour: req.body.finalHour,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
    duration: req.body.duration,
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

const scheduleService = new ScheduleService();

async function findAll(req: Request, res: Response) {
  try {
    const schedules = await scheduleService.findAllSchedules();
    res.status(200).json({ message: "Horarios encontrados", data: schedules });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// findAllActive

async function findOne(req: Request, res: Response) {
  try {
    const day = req.params.day; // req.body.sanitizedInput.day para futuro
    const initialHour = req.params.initialHour; // req.body.sanitizedInput.initialHour para futuro
    const person = req.params.person; // req.body.sanitizedInput.person para futuro
    const schedule = await scheduleService.findScheduleByPK(day, initialHour, person);
    res.status(200).json({ message: "Horario encontrado", data: schedule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findByProfesionalLogged(req: RequestWithUser, res: Response) {
  try {
    const email = req.user.email;
    const schedule = await scheduleService.findScheduleByEmail(email);
    res.status(200).json({ message: "Horarios del profesional encontrado", data: schedule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findByEmail(req: Request, res: Response) {
  // Este endpoint es solo para PRUEBAS
  try {
    const email = req.params.email;
    const schedule = await scheduleService.findScheduleByEmail(email);
    res.status(200).json({ message: "Horario encontrado", data: schedule });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function add(req: Request, res: Response) {
  try {
    const schedule = await scheduleService.createSchedule(req.body.sanitizedInput);
    res.status(201).json({ message: "Horario creado", data: schedule });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El horario ya existe" });
    }
    res.status(500).json({ message: error.message });
  }
}

async function update(req: Request, res: Response) {
  try {
    delete req.body.sanitizedInput.active; // no se puede cambiar el estado con este endpoint
    const schedule = await scheduleService.updateSchedule(req.body.sanitizedInput);
    res.status(200).json({ message: "Horario actualizado", data: schedule });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El horario ya existe" });
    }
    res.status(500).json({ message: error.message });
  }
}

async function remove(req: Request, res: Response) {
  try {
    const day = req.params.day;
    const initialHour = req.params.initialHour;
    const person = req.params.person;
    await scheduleService.removeSchedule(day, initialHour, person);
    res.status(200).json({ message: "Horario eliminado" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
/*
async function toggleScheduleState(req: Request, res: Response) {
  try {
    const day = req.body.sanitizedInput.day
    const initialHour = req.body.sanitizedInput.initialHour
    const schedule = await scheduleService.toggleScheduleState(day, initialHour)
    res.status(200).json({ message: 'Estado actualizado', data: schedule })

  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}
*/
export { sanitizeScheduleInput, findAll, findOne, add, update, remove, findByEmail, findByProfesionalLogged };
