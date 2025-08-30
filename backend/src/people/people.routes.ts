import { Router } from 'express'
import { sanitizePersonInput, findAll, findOne, add, update, loginWithEmailAndPassword } from './people.controller.js'

export const personRouter = Router()

personRouter.get('/', findAll)
personRouter.get('/:email', findOne)
personRouter.post('/', sanitizePersonInput, add)
personRouter.post('/login', loginWithEmailAndPassword)
personRouter.put('/:email', sanitizePersonInput, update)
personRouter.patch('/:email', sanitizePersonInput, update)