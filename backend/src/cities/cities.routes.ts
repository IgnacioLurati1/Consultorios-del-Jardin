import { Router } from 'express'
import { findAll, findOne, add, update, remove } from './cities.controller.js'

export const cityRouter = Router()

cityRouter.get('/', findAll)
cityRouter.get('/:idCity', findOne)
cityRouter.post('/', add)
cityRouter.put('/:idCity', update)
cityRouter.delete('/:idCity', remove)