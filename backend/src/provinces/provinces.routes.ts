import { Router } from 'express'
import { 
    findAll, 
    findOne, 
    add, 
    update, 
    remove 
} from './provinces.controller.js'

export const provinceRouter = Router()

provinceRouter.get('/', findAll)
provinceRouter.get('/:idProvince', findOne)
provinceRouter.post('/', add)
provinceRouter.put('/:idProvince', update)
provinceRouter.delete('/:idProvince', remove)