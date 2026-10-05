import { Request, Response, NextFunction } from "express";
import { OfficeService } from "./offices.service.js";
import { sendError } from "../shared/errors.js";
import { officeWords } from "../installation/installation.service.js";

function sanitizeOfficeInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    idOffice: req.body.idOffice,
    description: req.body.description,
    // Vacía queda en null: la sucursal toma la dirección general del consultorio.
    address: req.body.address === undefined ? undefined : String(req.body.address ?? "").trim().slice(0, 160) || null,
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
    const w = await officeWords();
    res.status(200).json({ message: `${w.Lugares} encontrad${w.os("lugar")}`, data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllActive(req: Request, res: Response) {
  try {
    let offices = await officeService.findAllActiveOffices();
    const w = await officeWords();
    res.status(200).json({ message: `${w.Lugares} activ${w.os("lugar")} encontrad${w.os("lugar")}`, data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.findOficeById(id);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Sucursal} encontrad${w.o("sucursal")}`, data: office });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findAllOfficesByProfessional(req: Request, res: Response) {
  try {
    const email = req.params.email;
    const offices = await officeService.findOfficesByProfessional(email);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Lugares} ${w.del("profesional")} encontrad${w.os("lugar")}`, data: offices });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function add(req: Request, res: Response) {
  try {
    const office = await officeService.createOffice(req.body.sanitizedInput);
    const w = await officeWords();
    res.status(201).json({ message: `${w.Sucursal} cread${w.o("sucursal")}`, data: office });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      const w = await officeWords();
      return res.status(409).json({ message: `${w.El("sucursal")} ya existe` });
    }
    sendError(res, error);
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    delete req.body.sanitizedInput.active;
    const office = await officeService.updateOffice(id, req.body.sanitizedInput);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Sucursal} actualizad${w.o("sucursal")}`, data: office });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      const w = await officeWords();
      return res.status(409).json({ message: `${w.El("sucursal")} ya existe` });
    }
    sendError(res, error);
  }
}

async function toggleOfficeState(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice);
    const office = await officeService.toggleOfficeState(id);
    const w = await officeWords();
    res.status(200).json({ message: `${w.Sucursal} y ${w.salas} actualizad${w.os("sala")}`, data: office });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { sanitizeOfficeInput, findAll, findOne, add, update, toggleOfficeState, findAllOfficesByProfessional, findAllActive };
