import { Request, Response, NextFunction } from "express";
import { OfficeService } from "./offices.service.js";

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
    res.status(500).json({ message: error.message });
  }
}

export async function findAllActive(req: Request, res: Response) {
  try {
    let offices = await officeService.findAllActiveOffices();
    res.status(200).json({ message: "Consultorios activos encontrados", data: offices });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.findOficeById(id);
    res.status(200).json({ message: "Consultorio encontrado", data: office });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
}

async function toggleOfficeState(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.toggleOfficeState(id);
    res.status(200).json({ message: "Consultorio y salas actualizadas", data: office });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeOfficeInput, findAll, findOne, add, update, toggleOfficeState };
