import { Repository } from '../shared/repository.js'
import { Province } from './provinces.entity.js'

const provinces = [
  new Province(
    '01',
    'Santa Fe',
  ),
]

export class ProvincesRepository implements Repository<Province> {
  public findAll(): Province[] | undefined {
    return provinces
}

  public findOne(item: { idProvince: string }): Province | undefined {
    return provinces.find((province) => province.idProvince === item.idProvince)
  }

  public add(item: Province): Province | undefined {
    provinces.push(item)
    return item
  }

  public update(item: Province): Province | undefined {
    const idProvincex = provinces.findIndex((province) => province.idProvince === item.idProvince)

    if (idProvincex !== -1) {
      provinces[idProvincex] = { ...provinces[idProvincex], ...item }
    }
    return provinces[idProvincex]
  }

  public delete(item: { idProvince: string }): Province | undefined {
    const idProvincex = provinces.findIndex((province) => province.idProvince === item.idProvince)

    if (idProvincex !== -1) {
      const deletedProvinces = provinces[idProvincex]
      provinces.splice(idProvincex, 1)
      return deletedProvinces
    }
  }
}