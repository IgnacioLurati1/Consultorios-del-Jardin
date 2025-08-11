import { Router } from 'express'
import {sanitizeCityInput, validateCityInput, findAll, findOne, add, update, remove} from './cities.controller.js'

export const cityRouter = Router()

cityRouter.get('/', findAll)
cityRouter.get('/:idCity', findOne)
cityRouter.post('/',sanitizeCityInput, add)
cityRouter.put('/:idCity',sanitizeCityInput, validateCityInput, update)
cityRouter.delete('/:idCity', remove)