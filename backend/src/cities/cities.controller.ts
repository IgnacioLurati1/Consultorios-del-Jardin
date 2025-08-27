import { Request, Response, NextFunction} from 'express'
import { CityService } from './cities.service.js'
import { error } from 'console';

const cityService = new CityService();

export function sanitizeCityInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nameCity: req.body.nameCity?.toString().trim(),
    idCity: req.body.idCity,
    province: req.body.province && req.body.province.toString().trim() !== '' 
      ? req.body.province 
      : undefined,
    offices: req.body.offices,
    active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

export function validateCityData(req: Request, res:Response, next: NextFunction) {
  const { sanitizedInput } = req.body
  const errors: string[] = []

  if (sanitizedInput.nameCity !== undefined) {
    if (typeof sanitizedInput.nameCity !== 'string') {
      errors.push('El nombre de la ciudad debe ser una cadena de texto');
    } 
    if (sanitizedInput.nameCity.trim().length < 2) {
      errors.push('El nombre de la ciudad es obligatorio y debe tener al menos 2 caracteres');
    } 
    if (sanitizedInput.nameCity.length > 100) {
      errors.push('El nombre de la ciudad no puede tener más de 100 caracteres');
    } 
    if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
      errors.push('El nombre de la ciudad solo puede contener letras, espacios, guiones y apóstrofes');
    }
  }

  if(errors.length > 0) {
    const errorMessage = errors.join(', ')
    return res.status(400).json({ 
      message: errorMessage
    });
  }
  next()
}

export async function validateCreateAndUpdateCityInput(req: Request, res: Response, next: NextFunction) {
  const {sanitizedInput} = req.body
  const errors: string[] = []

  if(sanitizedInput.nameCity && sanitizedInput.province){
      try {
      const cityId = req.params.idCity ? Number(req.params.idCity) : undefined;
      const existingCity = await cityService.cityExistsWithNameAndProvince(sanitizedInput.nameCity, sanitizedInput.province, cityId);
      
      //The city is created even when the province is inactive >>IMPORTANTE<<
      
      if (existingCity) {
        errors.push('Ya existe una ciudad con el mismo nombre en la misma provincia')
      }
    }catch(error: any) {
      errors.push('Error al validar ciudades con mismo nombre')
    }
  }

  if (errors.length > 0) {
    const errorMessage = errors.join(', ')
    return res.status(400).json({ 
      message: errorMessage
    });
  }
  next();

}

export function validateUpdateCityInput(req: Request, res: Response, next: NextFunction) {
  const { sanitizedInput } = req.body;
  
  if (!sanitizedInput.nameCity && !sanitizedInput.province && sanitizedInput.active === undefined) {
    return res.status(400).json({ 
      message: 'Se necesita al menos un campo para actualizar' 
    });
  }

  next();
}

export async function findAll(req: Request, res: Response) {
  try {
    let cities = await cityService.findAllCities()
    cities = cities.filter(city => city.province.active) //Filter all cities by state
    res.status(200).json({ message: 'find all cities', data: cities })
  }catch (error : any) {
    res.status(500).json({ message: error.message })
  }
}

export async function findOne(req: Request, res: Response) {
  try{
    const id = Number.parseInt(req.params.idCity)
    const city = await cityService.findCityById(id)
    res
      .status(200)
      .json({ message: 'found one city', data: city })
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export async function add(req: Request, res: Response) {
  try{
  const city = cityService.createCity(req.body.sanitizedInput)
  res.status(201).json({ message: 'City created successfully', data: city }) // City created successfully
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export async function update(req: Request, res: Response) {
  try{
    const id = Number.parseInt(req.params.idCity)
    delete req.body.sanitizedInput.active // Prevent changing active state through this endpoint  
    const updatedCity = cityService.updateCity(id, req.body.sanitizedInput)
    res.status(200).json({ message: 'City updated successfully', data: updatedCity })
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export async function toggleCityState(req: Request, res: Response) {
  try {
    const idCity = Number(req.params.idCity);
    const city = await cityService.toggleCityState(idCity);
    res.status(200).json({ message: 'Estado de la ciudad y offices actualizado', data: city });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
