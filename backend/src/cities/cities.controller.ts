import { Request, Response, NextFunction } from "express";
import { CityService } from "./cities.service.js";
import { wrap } from "@mikro-orm/core";

const cityService = new CityService();

export function sanitizeCityInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nameCity: req.body.nameCity?.toString().trim(),
    idCity: req.body.idCity,
    province: req.body.province && req.body.province.toString().trim() !== "" ? req.body.province : undefined,
    offices: req.body.offices,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

export async function findAll(req: Request, res: Response) {
  try {
    const cities = await cityService.findAllCities();
    res.status(200).json({ message: "Localidades encontradas", data: cities });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function findAllActive(req: Request, res: Response) {
  try {
    const cities = await cityService.findAllActiveCities();
    res.status(200).json({ message: "Localidades activas encontradas", data: cities });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idCity);
    const city = await cityService.findCityById(id);
    res.status(200).json({ message: "Localidad encontrada", data: city });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function add(req: Request, res: Response) {
  try {
    const city = await cityService.createCity(req.body.sanitizedInput);
    res.status(201).json({ message: "Localidad creada correctamente", data: wrap(city).toObject() });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "La localidad ya existe en esa provincia" });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idCity);
    const updatedCity = await cityService.updateCity(id, req.body.sanitizedInput);
    res.status(200).json({ message: "Localidad actualizada correctamente", data: wrap(updatedCity).toObject() });
  } catch (error: any) {
    if (error && (error.code === "ER_DUP_ENTRY" || (error.message && error.message.includes("Duplicate entry")))) {
      return res.status(409).json({ message: "La localidad ya existe en esa provincia" });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function toggleCityState(req: Request, res: Response) {
  try {
    const idCity = Number(req.params.idCity);
    const city = await cityService.toggleCityState(idCity);
    res.status(200).json({ message: "Estado de la localidad y consultorios actualizado", data: city });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
