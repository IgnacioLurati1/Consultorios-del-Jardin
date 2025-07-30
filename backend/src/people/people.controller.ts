import { Request, Response, NextFunction } from 'express'
import { Person } from './people.entity.js'


function sanitizePersonInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitizedInput = {
        email: req.body.email,
        docType: req.body.docType,
        docNumber: req.body.docNumber,
        name: req.body.name,
        surname: req.body.surname,
        phoneNumber: req.body.phoneNumber,
        password: req.body.password,
    }
    //more checks here

    Object.keys(req.body.sanitizedInput).forEach((key) => {
        if (req.body.sanitizedInput[key] === undefined) {
        delete req.body.sanitizedInput[key]
        }
    })
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

export { sanitizePersonInput, findAll, findOne, add, update, remove }