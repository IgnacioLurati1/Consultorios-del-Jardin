import { Router } from 'express'
import { 
    sanitizeProvinceInput,
    findAll, 
    findOne, 
    add, 
    update 
} from './provinces.controller.js'

export const provinceRouter = Router()

provinceRouter.get('/', findAll)
provinceRouter.get('/:idProvince', findOne)
provinceRouter.post('/',sanitizeProvinceInput, add)
provinceRouter.put('/:idProvince',sanitizeProvinceInput, update)
provinceRouter.patch('/:idProvince', sanitizeProvinceInput, update)
