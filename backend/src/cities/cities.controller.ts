import { Request, Response, NextFunction} from 'express'
import { orm } from '../shared/db/orm.js'
import { City } from './cities.entity.js'

function sanitizeCityInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    idCity: req.body.idCity,
    province: req.body.idProvince,
    offices: req.body.offices
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

const em = orm.em

async function findAll(req: Request, res: Response) {
  try {
    const cities = await em.find(City, {})
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
  const city = em.create(City, req.body.sanitizeCityInput)
  await em.flush()
  res.status(201).json({ message: 'City created successfully', data: city })
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
    res.status(200).json({ message: 'City updated successfully'})
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function remove(req: Request, res: Response) {
  try{
    const id = Number.parseInt(req.params.idCity)
    const city = em.getReference(City, id as any)
    await em.removeAndFlush(city)
    res.status(200).json({ message: 'City removed successfully' })
  }catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export {sanitizeCityInput, findAll, findOne, add, update, remove }