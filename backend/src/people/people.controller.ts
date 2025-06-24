import { Request, Response, NextFunction } from 'express'
import { PeopleRepository } from './people.repository.js'
import { Person } from './people.entity.js'

const repository = new PeopleRepository()

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
    res.json({ data: repository.findAll() })
}

function findOne(req: Request, res: Response) {
    const id = req.params.email
    const person = repository.findOne({id})
    if (!person) {
        return res.status(404).send({ message: 'Person not found' })
    }
    res.json({ data: person })
}

function add(req: Request, res: Response) {
    const input = req.body.sanitizedInput
    const personInput = new Person(
        input.email,
        input.docType,
        input.docNumber,
        input.name,
        input.surname,
        input.phoneNumber,
        input.password,
    )

    const person = repository.add(personInput)
    return res.status(201).send({ message: 'Person created', data: person })
}

function update(req: Request, res: Response) {
    req.body.sanitizedInput.email = req.params.email
    const person = repository.update(req.body.sanitizedInput)

    if (!person) {
        return res.status(404).send({ message: 'Person not found' })
    }

    return res.status(200).send({ message: 'Person updated successfully', data: person })
}

    function remove(req: Request, res: Response) {
    const id = req.params.email
    const person = repository.delete({id})

    if (!person) {
        res.status(404).send({ message: 'Person not found' })
    } else {
        res.status(200).send({ message: 'Person deleted successfully' })
    }
}

export { sanitizePersonInput, findAll, findOne, add, update, remove }