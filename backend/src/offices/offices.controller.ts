import { Request, Response, NextFunction } from "express";
import { OfficeService } from "./offices.service.js";
import { sendError } from "../shared/errors.js";

function sanitizeOfficeInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    idOffice: req.body.idOffice,
    description: req.body.description,
    city: req.body.city,
    closingTime: req.body.closingTime,
    openingTime: req.body.openingTime,
    active: req.body.active !== undefined ? req.body.active : true,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

const officeService = new OfficeService();

async function findAll(req: Request, res: Response) {
  try {
    const offices = await officeService.findAllOffices();
    res.status(200).json({ message: "Consultorios encontrados", data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllActive(req: Request, res: Response) {
  try {
    let offices = await officeService.findAllActiveOffices();
    res.status(200).json({ message: "Consultorios activos encontrados", data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.findOficeById(id);
    res.status(200).json({ message: "Consultorio encontrado", data: office });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllOfficesByProfessional(req: Request, res: Response) {
  try {
    const email = req.params.email;
    const offices = await officeService.findOfficesByProfessional(email);
    res.status(200).json({ message: "Consultorios del profesional encontrados", data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function add(req: Request, res: Response) {
  try {
    const office = await officeService.createOffice(req.body.sanitizedInput);
    res.status(201).json({ message: "Consultorio creado", data: office });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El consultorio ya existe" });
    }
    sendError(res, error);
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    delete req.body.sanitizedInput.active;
    const office = await officeService.updateOffice(id, req.body.sanitizedInput);
    res.status(200).json({ message: "Consultorio actualizado", data: office });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "El consultorio ya existe" });
    }
    sendError(res, error);
  }
}

async function toggleOfficeState(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.toggleOfficeState(id);
    res.status(200).json({ message: "Sucursal y consultorios actualizados", data: office });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { sanitizeOfficeInput, findAll, findOne, add, update, toggleOfficeState, findAllOfficesByProfessional, findAllActive };
