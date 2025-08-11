import { Request, Response, NextFunction } from "express"
import { Room } from './rooms.entity.js'
import {orm} from '../shared/db/orm.js'

const em = orm.em


function sanitizeRoomInput(req:Request, res:Response, next:NextFunction) {
  req.body.sanitizedInput = {
    idRoom: req.body.idRoom,
    description: req.body.description,
    office: req.body.office,
    state: req.body.state !== undefined ? req.body.state : true, // Default state to true if not provided
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

function validateRoomInput(req: Request, res: Response, next: NextFunction) {
  if (!req.body.sanitizedInput.description || !req.body.sanitizedInput.office || req.body.sanitizedInput.description.trim() === '' || req.body.sanitizedInput.office.trim() === '') {
    return res.status(400).json({ message: 'Description and Office ID are required.' })
  }

  next()
}

function validateRoomUpdateInput(req: Request, res: Response, next: NextFunction) {
  if (
    (!req.body.sanitizedInput.description && !req.body.sanitizedInput.office) ||
    (req.body.sanitizedInput.description !== undefined && req.body.sanitizedInput.description.trim() === '')||
    (req.body.sanitizedInput.office !== undefined && req.body.sanitizedInput.office.trim() === '')
  ){
    return res.status(400).json({ message: 'Fields cannot be empty.' })
  }
  next()
    }

async function findAll(req: Request, res: Response) {
  try {
    const rooms = await em.find(Room, {})
    res.status(200).json({message: 'finded all rooms', data: rooms})
} catch (error: any) {
  res.status(500).json({ error: error.message })
}
}

async function findOne(req: Request, res: Response) {
  try {
    const idRoom = Number.parseInt(req.params.idRoom);
    const room = await em.findOneOrFail(Room, {idRoom})
    res.status(200).json({ message: 'finded one room', data: room })
  }
  catch(error:any) {
    res.status(500).json({ error: error.message })
  }
}

async function add(req: Request, res: Response) {
  try{
    const room = em.create(Room, req.body.sanitizedInput)
    await em.flush()
    res.status(201).json({ message: 'room created', data: room })
  }
  catch(error:any) {
    res.status(500).json({ error: error.message })

  }
}

  async function update(req: Request, res: Response) {
  try{
    const idRoom = Number.parseInt(req.params.idRoom);
    const room = em.getReference(Room, idRoom as any)
    em.assign(room, req.body.sanitizedInput)
    await em.flush()
    res.status(200).json({ message: 'room updated', data: room })
  }
  catch(error:any) {
    res.status(500).json({ error: error.message })
  }
}   

export {sanitizeRoomInput, validateRoomInput,validateRoomUpdateInput, findAll, findOne, add, update}