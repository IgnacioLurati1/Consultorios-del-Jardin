import { Request, Response, NextFunction } from "express";
import { ProvinceService } from "./provinces.service.js";
import { sendError } from "../shared/errors.js";

function sanitizeProvinceInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nameProvince: req.body.nameProvince,
    idProvince: req.body.idProvince,
    cities: req.body.cities,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

const provinceService = new ProvinceService();

async function findAll(req: Request, res: Response) {
  try {
    const provinces = await provinceService.findAllProvinces();
    res.status(200).json({ message: "Provincias encontradas", data: provinces });
  } catch (error: any) {
    sendError(res, error);
  }
}

export async function findAllActive(req: Request, res: Response) {
  try {
    let provinces = await provinceService.findAllActiveProvinces();
    res.status(200).json({ message: "Provincias activas encontradas", data: provinces });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idProvince);
    const province = await provinceService.findProvinceById(id);
    res.status(200).json({ message: "Provincia encontrada", data: province });
  } catch (error: any) {
    sendError(res, error);
  }
}

async function add(req: Request, res: Response) {
  try {
    const province = await provinceService.createProvince(req.body.sanitizedInput);
    res.status(201).json({ message: "Provincia creada", data: province });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "La provincia ya existe" });
    }
    sendError(res, error);
  }
}

async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idProvince);
    delete req.body.sanitizedInput.active;
    const province = await provinceService.updateProvince(id, req.body.sanitizedInput);
    res.status(200).json({ message: "Provincia actualizada", data: province });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "La provincia ya existe" });
    }
    sendError(res, error);
  }
}

async function toggleProvinceState(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idProvince);
    const province = await provinceService.toggleProvinceState(id);
    res.status(200).json({ message: "Provincia y ciudades actualizadas", data: province });
  } catch (error: any) {
    sendError(res, error);
  }
}

export { sanitizeProvinceInput, findAll, findOne, add, update, toggleProvinceState };
