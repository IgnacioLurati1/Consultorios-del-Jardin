import { Request, Response, NextFunction } from 'express'
import { Office } from './offices.entity.js'

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
  res.status(500).json({ message: 'Not implemented' })
}

function findOne(req: Request, res: Response) {
  res.status(500).json({ message: 'Not implemented' })
}

function add(req: Request, res: Response) {
  res.status(500).json({ message: 'Not implemented' })
}

function update(req: Request, res: Response) {
  res.status(500).json({ message: 'Not implemented' })
}

function remove(req: Request, res: Response) {
  res.status(500).json({ message: 'Not implemented' })
}

export { sanitizeOfficeInput, findAll, findOne, add, update, remove }