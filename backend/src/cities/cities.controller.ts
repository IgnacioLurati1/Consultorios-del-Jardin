import { Request, Response, NextFunction} from 'express'
import { orm } from '../shared/db/orm.js'
import { City } from './cities.entity.js'
import { error } from 'console'
import { create } from 'domain'

const em = orm.em

function sanitizeCityInput(req: Request, res: Response, next: NextFunction) {
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

function validateCityData(req: Request, res:Response, next: NextFunction) {
  const { sanitizedInput } = req.body
  const errors: string[] = []

  if (sanitizedInput.nameCity !== undefined) {
    if (typeof sanitizedInput.nameCity !== 'string') {
      errors.push('El nombre de la ciudad debe ser una cadena de texto');
    } else if (sanitizedInput.nameCity.trim().length < 2) {
      errors.push('El nombre de la ciudad es obligatorio y debe tener al menos 2 caracteres');
    } else if (sanitizedInput.nameCity.length > 100) {
      errors.push('El nombre de la ciudad no puede tener más de 100 caracteres');
    } else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
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

async function validateCreateAndUpdateCityInput(req: Request, res: Response, next: NextFunction) {
  const {sanitizedInput} = req.body
  const errors: string[] = []

  if (!sanitizedInput.nameCity) {
    errors.push('El nombre de la ciudad es obligatorio');
  }

  if (!sanitizedInput.province || sanitizedInput.province === '') {
    errors.push('La provincia es obligatoria');
  }

  if(sanitizedInput.nameCity && sanitizedInput.province){
    try {
      const whereClause: any = { 
        nameCity: { $like: sanitizedInput.nameCity.trim() },  //Creo una ciudad con el mismo nombre, pero insensible a mayusculas y minusculas y misma prov
        province: sanitizedInput.province 
      }

      const cityId = req.params.idCity ? Number.parseInt(req.params.idCity) : null

      if (cityId) {
        whereClause.idCity = { $ne: cityId } //le agrego el id con $ne que es un operador de MikroORM que significa "not equal", busca pero ignora la que tiene ese id
      }


      const existingCity = await em.findOne(City, whereClause) 

      if (existingCity) {
        errors.push('Ya existe una ciudad con el mismo nombre en la misma provincia')
      }
  } catch(error: any) {
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

function validateUpdateCityInput(req: Request, res: Response, next: NextFunction) {
  const { sanitizedInput } = req.body;
  
  if (!sanitizedInput.nameCity && !sanitizedInput.province && sanitizedInput.active === undefined) {
    return res.status(400).json({ 
      message: 'Se necesita al menos un campo para actualizar' 
    });
  }

  next();
}

async function findAll(req: Request, res: Response) {
  try {
    const cities = await em.find(City, {}, {populate: ['province']})
    res.status(200).json({ message: 'find all cities', data: cities })
  }catch (error : any) {
    res.status(500).json({ message: error.message })
  }
}

async function findOne(req: Request, res: Response) {
  try{
    const id = Number.parseInt(req.params.idCity)
    const city = await em.findOneOrFail(City, { idCity : id })
    res
      .status(200)
      .json({ message: 'found one city', data: city })
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function add(req: Request, res: Response) {
  try{
  const city = em.create(City, req.body.sanitizedInput)
  await em.flush()
  const createdCity = await em.findOne(City, { idCity: city.idCity }, {populate: ['province']})
  res.status(201).json({ message: 'City created successfully', data: createdCity })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function update(req: Request, res: Response) {
  try{
    const id = Number.parseInt(req.params.idCity)
    const city = await em.findOneOrFail(City,  { idCity : id })
    em.assign(city, req.body.sanitizedInput)
    await em.flush() 
    const updatedCity = await em.findOneOrFail(City, { idCity: id }, {populate: ['province']})
    res.status(200).json({ message: 'City updated successfully', data: updatedCity })
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export {sanitizeCityInput, validateCityData, validateCreateAndUpdateCityInput, validateUpdateCityInput, findAll, findOne, add, update}