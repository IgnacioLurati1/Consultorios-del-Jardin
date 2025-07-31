import { Router } from 'express'
import { findAll, findOne, add, update, remove } from './offices.controller.js'

export const officeRouter = Router()

officeRouter.get('/', findAll)
officeRouter.get('/:idOffice', findOne)
officeRouter.post('/', add)
officeRouter.put('/:idOffice', update)
officeRouter.patch('/:idOffice', update)
officeRouter.delete('/:idOffice', remove)