import { Request , Response , NextFunction } from "express"
import { ScheduleService } from "./schedule.service.js"

interface RequestWithUser extends Request {
    user?: any;
}

function sanitizeScheduleInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    idSchedule: req.body.idSchedule,
    day: req.body.day,
    initialHour: req.body.initialHour,
    person: req.body.person,
    room: req.body.room,
    finalHour: req.body.finalHour,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
    allowedType: req.body.allowedType,
    durations: req.body.durations
}
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

const scheduleService = new ScheduleService()

async function findAll(req: Request, res: Response) {
  try {
    const schedules = await scheduleService.findAllSchedules()
    res.status(200).json({  message: 'Horarios encontrados', data: schedules })

  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}

// findAllActive 

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idSchedule)
    const schedule = await scheduleService.findScheduleById(id)
    res.status(200).json({ message: 'Horario encontrado', data: schedule })

  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}

async function findByEmailAndRoom(req: RequestWithUser, res: Response) {
  try {
    const email = req.params.email
    const idRoom = Number.parseInt(req.params.idRoom)
    const schedule = await scheduleService.findScheduleByEmailAndRoom(email, idRoom)
    res.status(200).json({ message: 'Horario encontrado', data: schedule })
  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}

async function add(req: Request, res: Response) {
  try {
    const schedule = await scheduleService.createSchedule(req.body.sanitizedInput)
    res.status(201).json({ message: 'Horario creado', data: schedule })

  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}

async function update(req: Request, res: Response) {
  try {
    const day = req.body.sanitizedInput.day
    const initialHour = req.body.sanitizedInput.initialHour
    delete req.body.sanitizedInput.active // no se puede cambiar el estado con este endpoint
    const schedule = await scheduleService.updateSchedule(day, initialHour, req.body.sanitizedInput)
    res.status(200).json({ message: 'Horario actualizado', data: schedule })

  } catch (error : any) {
    res.status(500).json({ message : error.message })
  }
}

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

export { sanitizeScheduleInput, findAll, findOne, add, update, toggleScheduleState , findByEmailAndRoom }
