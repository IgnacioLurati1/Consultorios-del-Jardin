import { Request, Response, NextFunction } from "express";
import { RoomService } from "./rooms.service.js";
import { wrap } from "@mikro-orm/core";
import { sendError } from "../shared/errors.js";
import { officeWords } from "../installation/installation.service.js";
import { capital } from "../shared/capital.js";

const roomService = new RoomService();

function sanitizeRoomInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    idRoom: req.body.idRoom,
    description: req.body.description?.toString().trim(),
    office: req.body.office && req.body.office.toString().trim() !== "" ? req.body.office : undefined,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

async function findAll(req: Request, res: Response) {
  try {
    let rooms = await roomService.findAllRooms();
    const w = await officeWords();
    res.status(200).json({ message: `${w.Salas} encontrad${w.os("sala")}`, data: rooms });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllActive(req: Request, res: Response) {
  try {
    let rooms = await roomService.findAllActiveRooms();
    const w = await officeWords();
    res.status(200).json({ message: `${w.Salas} activ${w.os("sala")} encontrad${w.os("sala")}`, data: rooms });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idRoom);
    const room = await roomService.findRoomById(id);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Sala} encontrad${w.o("sala")}`, data: room });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findRoomsByOfficeAndProfessional(req: Request, res: Response) {
  try {
    const officeId = Number.parseInt(req.params.officeId);
    const professionalEmail = req.params.email;
    const rooms = await roomService.findRoomsByOfficeAndProfessional(officeId, professionalEmail);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Salas} encontrad${w.os("sala")} para ${w.el("sucursal")} y ${w.el("profesional")}`, data: rooms });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function add(req: Request, res: Response) {
  try {
    const room = await roomService.createRoom(req.body.sanitizedInput);
    const w = await officeWords();
    res.status(201).json({ message: `${w.Sala} cread${w.o("sala")} correctamente`, data: wrap(room).toObject() });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      const w = await officeWords();
      return res.status(409).json({ message: `${capital(w.ese("sala"))} ya existe` });
    }
    sendError(res, error);
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idRoom);
    const updatedRoom = await roomService.updateRoom(id, req.body.sanitizedInput);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Sala} actualizad${w.o("sala")} correctamente`, data: wrap(updatedRoom).toObject() });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      const w = await officeWords();
      return res.status(409).json({ message: `${capital(w.ese("sala"))} ya existe` });
    }
    sendError(res, error);
  }
}

async function toggleRoomState(req: Request, res: Response) {
  try {
    const id = Number(req.params.idCity);
    const room = await roomService.toggleRoomState(id);
    const w = await officeWords();
    res.status(200).json({ message: `Estado ${w.del("sala")} actualizado`, data: room });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { sanitizeRoomInput, findAll, findOne, add, update, toggleRoomState, findAllActive, findRoomsByOfficeAndProfessional };