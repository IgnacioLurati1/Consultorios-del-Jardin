import { Request, Response, NextFunction } from 'express'
import { Office } from './offices.entity.js'
import { orm } from '../shared/db/orm.js'

function sanitizeOfficeInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    idOffice: req.body.idOffice,
    description: req.body.description,
    idCity: req.body.idCity,
    closingTime: req.body.closingTime,
    openingTime: req.body.openingTime,
  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

export function validateOfficeTimes(req: Request, res: Response, next: NextFunction) {

  if('openingTime' in req.body.sanitizedInput && 'closingTime' in req.body.sanitizedInput) { //This is because our sanitizer function eliminates all keys that are undefined, therefore not working on put or patch http requets that don't have the correct keys
    let openingTime = req.body.sanitizedInput.openingTime
    let closingTime = req.body.sanitizedInput.closingTime

    openingTime = parseInt(openingTime.replace(":", ''), 10)
    closingTime = parseInt(closingTime.replace(":", ''), 10)

      if (openingTime >= closingTime) {
        return res
          .status(400)
          .json({ message: 'La hora de cierre debe ser posterior a la hora de apertura.' })
      }
  }

  next()
}


const em = orm.em

async function findAll(req: Request, res: Response) {
  try {
    const offices = await em.find(Office, {});
    res.status(200).json({ message: 'Find all offices', data: offices })
  } catch (error: any) {
    res.status(500).json({ message: 'Error retrieving offices'})
  }
}
    
async function findOne(req: Request, res: Response) {
 try {
  const id = Number.parseInt(req.params.idOffice)
  const office = await em.findOneOrFail(Office, { idOffice: id }) 
  res.status(200).json({ message: 'Office found', data: office })
 } catch (error: any) {
  res.status(500).json({ message: error.message })
 }
}

async function add(req: Request, res: Response) {
  try {
    const office = em.create(Office, req.body)
    await em.flush()
    res.status(201).json({ message: 'Office created successfully', data: office })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

//CHAQUEAR
async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice)
    const office = em.findOneOrFail(Office, {idOffice: id})
    em.assign(office, req.body)
    await em.flush()
    res.status(200).json({ message: 'Office updated successfully', data: office })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function remove(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.idOffice)
    const office = em.findOneOrFail(Office, { idOffice: id })
    await em.removeAndFlush(office)
    res.status(200).json({ message: 'Office deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export { findAll, findOne, add, update, remove }