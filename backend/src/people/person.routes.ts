import { Router } from 'express'
import { sanitizePersonInput, findAll, findOne, add, update, remove } from './person.controller.js'

export const personRouter = Router()

personRouter.get('/', findAll)
personRouter.get('/:email', findOne)
personRouter.post('/', sanitizePersonInput, add)
personRouter.put('/:email', sanitizePersonInput, update)
personRouter.patch('/:email', sanitizePersonInput, update)
personRouter.delete('/:email', remove)