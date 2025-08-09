import { Router } from 'express'
import {sanitizeCityInput, findAll, findOne, add, update, remove } from './cities.controller.js'

export const cityRouter = Router()

cityRouter.get('/', findAll)
cityRouter.get('/:idCity', findOne)
cityRouter.post('/',sanitizeCityInput, add)
cityRouter.put('/:idCity',sanitizeCityInput, update)
cityRouter.delete('/:idCity', remove)