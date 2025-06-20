import { Request, Response, NextFunction } from 'express'
import { ProvincesRepository } from './provinces.repository.js'
import { Province } from './provinces.entity.js'

const repository = new ProvincesRepository()

function sanitizeProvinceInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    idProvince: req.body.idProvince
  }
  //more checks here

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key]
    }
  })
  next()
}

function findAll(req: Request, res: Response) {
  res.json({ data: repository.findAll() })
}

function findOne(req: Request, res: Response) {
  const idProvince = req.params.idProvince
  const province = repository.findOne({idProvince})
  if (!province) {
    return res.status(404).send({ message: 'Province not found' })
  }
  res.json({ data: province })
}

function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput
  const provinceInput = new Province(
    input.idProvince,
    input.name
  )

  const province = repository.add(provinceInput)
  return res.status(201).send({ message: 'Province created', data: province })
}

function update(req: Request, res: Response) {
  req.body.sanitizedInput.idProvince = req.params.idProvince
  const province = repository.update(req.body.sanitizedInput)

  if (!province) {
    return res.status(404).send({ message: 'Province not found' })
  }

  return res.status(200).send({ message: 'Province updated successfully', data: province })
}

function remove(req: Request, res: Response) {
  const idProvince = req.params.idProvince
  const province = repository.delete({ idProvince })

  if (!province) {
    res.status(404).send({ message: 'Province not found' })
  } else {
    res.status(200).send({ message: 'Province deleted successfully' })
  }
}

export { sanitizeProvinceInput, findAll, findOne, add, update, remove }