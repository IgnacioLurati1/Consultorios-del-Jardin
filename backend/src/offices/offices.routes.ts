import { Router } from 'express'
import {sanitizeOfficeInput, findAll, findOne, add, update, toggleOfficeState, findAllActive, findAllOfficesByProfessional} from './offices.controller.js'
import { verifyAdmin } from "../config/middlewares.js";

export const officeRouter = Router()

officeRouter.get('/',verifyAdmin, findAll)
officeRouter.get('/active', findAllActive)
officeRouter.get('/:idOffice', findOne)
officeRouter.get('/professional/:email', findAllOfficesByProfessional)
officeRouter.post('/',verifyAdmin, sanitizeOfficeInput, add)
officeRouter.put('/:idOffice',verifyAdmin, sanitizeOfficeInput, update)
officeRouter.patch('/:idOffice',verifyAdmin, sanitizeOfficeInput , update)
officeRouter.patch('/:idOffice/toggle',verifyAdmin, toggleOfficeState)

