import { Request, Response, NextFunction } from 'express'
import { OfficesRepository } from './offices.repository.js'
import { Office } from './offices.entity.js'

const repository = new OfficesRepository()

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



function findAll(req: Request, res: Response) {
  res.json({ data: repository.findAll() })
}

function findOne(req: Request, res: Response) {
  const id = req.params.idOffice
  const office = repository.findOne({id})
  if (!office) {
    return res.status(404).send({ message: 'Office not found' })
  }
  res.json({ data: office })
}

function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput
  const officeInput = new Office(
    input.idOffice,
    input.description,
    input.idCity,
    input.openingTime,
    input.closingTime
  )

  const office = repository.add(officeInput)
  return res.status(201).send({ message: 'Office created', data: office })
}

function update(req: Request, res: Response) {
  req.body.sanitizedInput.idOffice = req.params.idOffice
  const office = repository.update(req.body.sanitizedInput)

  if (!office) {
    return res.status(404).send({ message: 'Office not found' })
  }

  return res.status(200).send({ message: 'Office updated successfully', data: office })
}

function remove(req: Request, res: Response) {
  const id = req.params.idOffice
  const office = repository.delete({ id })

  if (!office) {
    res.status(404).send({ message: 'Office not found' })
  } else {
    res.status(200).send({ message: 'Office deleted successfully' })
  }
}

export { sanitizeOfficeInput, findAll, findOne, add, update, remove }