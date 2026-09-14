import { Request, Response, NextFunction } from "express";
import { ScheduleService } from "./schedule.service.js";
import { sendError } from "../shared/errors.js";

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
    sendError(res, error);
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
    sendError(res, error);
  }
}

async function findByProfesionalLogged(req: RequestWithUser, res: Response) {
  try {
    const email = req.user.email;
    const schedule = await scheduleService.findScheduleByEmail(email);
    res.status(200).json({ message: "Horarios del profesional encontrado", data: schedule });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findByEmail(req: Request, res: Response) {
  // Este endpoint es solo para PRUEBAS
  try {
    const email = req.params.email;
    const schedule = await scheduleService.findScheduleByEmail(email);
    res.status(200).json({ message: "Horario encontrado", data: schedule });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findByRoom(req: Request, res: Response) {
  try {
    const idRoom = Number.parseInt(req.params.idRoom);
    const schedules = await scheduleService.findSchedulesByRoom(idRoom);
    res.status(200).json({ message: "Horarios del consultorio encontrados", data: schedules });
  } catch (error: any) {
    sendError(res, error);
  }
}

// Un profesional solo puede tocar sus propios horarios; el admin, los de cualquiera.
function ownsSchedule(req: RequestWithUser): boolean {
  if (req.user?.type === "admin") return true;
  return req.user?.type === "professional" && req.body.sanitizedInput.person === req.user.email;
}

// Los horarios de atención los carga y los saca la administración: son los que reservan
// cada consultorio. El profesional decide solo cuánto dura cada turno (ver update). La
// página ya lo respetaba escondiendo los botones; va acá para que ninguna pantalla, ni una
// versión vieja de la app que siga instalada, pueda saltearlo.
const ONLY_ADMIN = "Los horarios de atención los maneja la administración del consultorio";

function isAdmin(req: RequestWithUser): boolean {
  return req.user?.type === "admin";
}

async function add(req: RequestWithUser, res: Response) {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: ONLY_ADMIN });

    const schedule = await scheduleService.createSchedule(req.body.sanitizedInput);
    res.status(201).json({ message: "Horario creado", data: schedule });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El horario ya existe" });
    }
    sendError(res, error);
  }
}

async function update(req: RequestWithUser, res: Response) {
  try {
    delete req.body.sanitizedInput.active; // no se puede cambiar el estado con este endpoint

    if (req.user?.type === "professional") {
      // De un horario suyo, el profesional cambia solo la duración. La franja y el
      // consultorio son de la administración, aunque el body los mande.
      const { day, initialHour, duration } = req.body.sanitizedInput;
      req.body.sanitizedInput = { day, initialHour, person: req.user.email };
      if (duration !== undefined) req.body.sanitizedInput.duration = duration;
    }
    if (!ownsSchedule(req)) return res.status(403).json({ message: "No podés modificar horarios de otro profesional" });

    const schedule = await scheduleService.updateSchedule(req.body.sanitizedInput);
    res.status(200).json({ message: "Horario actualizado", data: schedule });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El horario ya existe" });
    }
    sendError(res, error);
  }
}

async function remove(req: RequestWithUser, res: Response) {
  try {
    const day = req.params.day;
    const initialHour = req.params.initialHour;
    const person = req.params.person;

    // Antes solo se frenaba a un profesional borrando horarios ajenos: los propios los
    // podía borrar, y cualquier otra cuenta con sesión, los de cualquiera.
    if (!isAdmin(req)) return res.status(403).json({ message: ONLY_ADMIN });
    await scheduleService.removeSchedule(day, initialHour, person);
    res.status(200).json({ message: "Horario eliminado" });
  } catch (error: any) {
    sendError(res, error);
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
    sendError(res, error)
  }
}
*/
export { sanitizeScheduleInput, findAll, findOne, add, update, remove, findByEmail, findByProfesionalLogged, findByRoom };
