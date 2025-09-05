import { Request, Response, NextFunction} from 'express'
import { RoomService } from './rooms.services.js'
import { wrap } from '@mikro-orm/core';


const roomService = new RoomService();

export function sanitizeRoomInput(req:Request, res:Response, next:NextFunction) {
  req.body.sanitizedInput = {
    idRoom: req.body.idRoom,
    description: req.body.description?.toString().trim(),
    office: req.body.office && req.body.office.toString().trim() !== '' 
      ? req.body.office 
      : undefined,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

export async function findAll(req: Request, res: Response) {
  try {
    let rooms = await roomService.findAllRooms()
    res.status(200).json({message: 'finded all rooms', data: rooms})
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export async function findAllActive(req:Request, res:Response){
  try {
    let rooms = await roomService.findAllActiveRooms()
    res.status(200).json({ message: 'find all active rooms', data: rooms })
  }catch (error : any) {
    res.status(500).json({ message: error.message })
  }
}


export async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idRoom);
    const room = await roomService.findRoomById(id)
    res.status(200).json({ message: 'finded one room', data: room })
  }
  catch(error:any) {
    res.status(500).json({ error: error.message })
  }
}

export async function add(req: Request, res: Response) {
  try{
  
    const room = await roomService.createRoom(req.body.sanitizedInput)
    res.status(201).json({ message: 'Room created successfully', data: wrap(room).toObject() })
  
    } catch (error: any) {

      res.status(500).json({ message: 'Internal Server Error' })
    
  }
}

export async function update(req: Request, res: Response) {
  try{
      const id = Number.parseInt(req.params.idRoom)
      const updatedRoom = await roomService.updateRoom(id, req.body.sanitizedInput)
      res.status(200).json({ message: 'Room updated successfully', data: wrap(updatedRoom).toObject() })
    }catch (error: any) {
        res.status(error.statusCode).json({message: error.message});
      
      res.status(500).json({ message: 'Internal Server Error' })
    }
  }

export async function toggleRoomState(req: Request, res: Response) {
  try {
    const id = Number(req.params.idCity);
    const room = await roomService.toggleRoomState(id);
    res.status(200).json({ message: 'Room state updated successfully', data: room });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
