import { Request, Response, NextFunction } from 'express'
import { Person } from './people.entity.js'
import { orm } from '../shared/db/orm.js'

const em = orm.em;

function sanitizePersonInput(req: Request, res: Response, next: NextFunction) {

    req.body.sanitizedInput = {
        email: req.body.email,
        docType: req.body.docType,
        docNumber: req.body.docNumber,
        name: req.body.name,
        surname: req.body.surname,
        phoneNumber: req.body.phoneNumber,
        password: req.body.password,
        active: req.body.active !== undefined ? req.body.active : true, // Default state to true if not provided
    }

    //more checks here

    Object.keys(req.body.sanitizedInput).forEach((key) => {
        if (req.body.sanitizedInput[key] === undefined) {
        delete req.body.sanitizedInput[key]
        }
    })

    next()
}

async function findAll(req: Request, res: Response) {
    try {
        const people = await em.find(Person, {})
        res.status(200).json({ message: 'People found', data: people })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

async function findOne(req: Request, res: Response) {
    try {
        const person = await em.findOneOrFail(Person, { email: req.params.email } )
        res.status(200).json({message: 'Person found', data: person})
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

async function add(req: Request, res: Response) {
    try {
        const person = em.create(Person, req.body.sanitizedInput)
        await em.flush();
        res.status(201).json({ message: 'Person created', data: person })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

async function update(req: Request, res: Response) {
    try {
        const person = await em.findOneOrFail(Person, { email: req.params.email })
        em.assign(person, req.body.sanitizedInput)
        await em.flush();
        res.status(200).json({ message: 'Person updated', data: person })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

    async function remove(req: Request, res: Response) {
        try {
            const email = req.params.email
            const person = await em.findOneOrFail(Person, { email }) //Cambiado por que sino no andaba
            await em.removeAndFlush(person)
            res.status(200).json({ message: 'Person removed' })
        } catch (error: any) {
            res.status(500).json({ message: error.message })
        }
}

export { sanitizePersonInput, findAll, findOne, add, update, remove }