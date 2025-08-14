import { Request, Response, NextFunction} from 'express'
import { orm } from '../shared/db/orm.js'
import { City } from './cities.entity.js'
import { error } from 'console'
import { create } from 'domain'

function sanitizeCityInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nameCity: req.body.nameCity,
    idCity: req.body.idCity,
    province: req.body.province,
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

function validateCityInput(req: Request, res: Response, next: NextFunction) {
  if (!req.body.sanitizedInput.nameCity || 
    !req.body.sanitizedInput.idCity || 
    !req.body.sanitizedInput.province ||
    req.body.sanitizedInput.nameCity.trim() === '') {
    return res.status(400).json({ message: 'Description and province are required.' })
  }
  next()
}

function validateCreateCityInput(req: Request, res: Response, next: NextFunction) {
  if (!req.body.sanitizedInput.nameCity || 
    !req.body.sanitizedInput.province ||
    req.body.sanitizedInput.nameCity.trim() === '') {
    return res.status(400).json({ message: 'Description and province are required.' })
  }
  next()
}

const em = orm.em

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

export {sanitizeCityInput, validateCityInput, validateCreateCityInput, findAll, findOne, add, update}