import { Request, Response, NextFunction} from 'express'
import { Province } from './provinces.entity.js'
import { orm } from '../shared/db/orm.js'

function sanitizeProvinceInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    idProvince: req.body.idProvince,
    cities: req.body.cities

  }

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

const em = orm.em

async function findAll(req: Request, res: Response) {
  try {

    const provinces = await em.find(Province, {})
    res.status(200).json({message: 'finded all Provinces', data:provinces })
  
  }catch(error: any){
    res.status(500).json({ message: error.message })
  }
}

async function findOne(req: Request, res: Response) {
  try {

    const id = Number.parseInt(req.params.idProvince)
    const province = await em.findOneOrFail(Province, { idProvince: id })
    res.status(200).json({ message: 'finded Province', data: province })
  
  }catch(error: any) {
    res.status(500).json({ message: error.message })
  }
}


async function add(req: Request, res: Response) {
  try {

    const province = em.create(Province, req.body.sanitizedInput)
    await em.flush()
    res.status(201).json({ message: 'Province created', data: province })
  
  }catch(error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function update(req: Request, res: Response) {
  try {
    
    const id = Number.parseInt(req.params.idProvince)
    const province = await em.findOneOrFail(Province, id as any)
    em.assign(province, req.body.sanitizedInput)
    await em.flush()
    res.status(200).json({ message: 'Province updated', data: province })

  }catch(error: any) {
    res.status(500).json({ message: error.message })
  }
}

async function remove(req: Request, res: Response) {
  try {

    const id = Number.parseInt(req.params.idProvince)
    const province = em.getReference(Province, id as any)
    await em.removeAndFlush(province)

    res.status(204).json({ message: 'Province removed' })

  }catch(error: any) {
    res.status(500).json({ message: error.message })
  }
}

export {sanitizeProvinceInput, findAll, findOne, add, update, remove }