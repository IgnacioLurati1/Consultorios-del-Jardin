import { Router } from 'express'
import {sanitizeCityInput, validateCityData, validateCreateAndUpdateCityInput, validateUpdateCityInput,findAll, findOne, add, update, toggleCityState} from './cities.controller.js'

export const cityRouter = Router()

cityRouter.get('/', findAll)
cityRouter.get('/:idCity', findOne)
cityRouter.post('/',sanitizeCityInput, validateCityData, validateCreateAndUpdateCityInput, add)
cityRouter.put('/:idCity',sanitizeCityInput, validateCityData, validateUpdateCityInput, validateCreateAndUpdateCityInput, update)
cityRouter.patch('/:idCity',sanitizeCityInput, validateUpdateCityInput, update)
cityRouter.patch('/cities/:idCity/toggle-state', toggleCityState);
