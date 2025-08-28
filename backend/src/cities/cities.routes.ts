import { Router } from 'express'
import {findAll, findAllActive, findOne, add, update, toggleCityState} from './cities.controller.js'

export const cityRouter = Router()

cityRouter.get('/', findAll)
cityRouter.get('/active', findAllActive)
cityRouter.get('/:idCity', findOne)
cityRouter.post('/', add)
cityRouter.put('/:idCity', update)
cityRouter.patch('/:idCity', update)
cityRouter.patch('/:idCity/toggle-state', toggleCityState);

