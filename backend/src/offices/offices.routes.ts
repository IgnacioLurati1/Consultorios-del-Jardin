import { Router } from 'express'
import { sanitizeOfficeInput, findAll, findOne, add, update, remove } from './offices.controller.js'

export const officeRouter = Router()

officeRouter.get('/', findAll)
officeRouter.get('/:idOffice', findOne)
officeRouter.post('/', sanitizeOfficeInput, add)
officeRouter.put('/:idOffice', sanitizeOfficeInput, update)
officeRouter.patch('/:idOffice', sanitizeOfficeInput, update)
officeRouter.delete('/:idOffice', remove)