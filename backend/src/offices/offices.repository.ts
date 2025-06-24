import { Repository } from '../shared/repository.js'
import { Office } from './offices.entity.js'

const offices = [
  new Office(
    '01',
    'Consultorio Azul',
    '01',
    '18:00',
    '08:00'
  ),
]

export class OfficesRepository implements Repository<Office> {
  public findAll(): Office[] | undefined {
    return offices
}

  public findOne(item: { id: string }): Office | undefined {
      return offices.find((office) => office.idOffice === item.id)
    }

  public add(item: Office): Office | undefined {
    offices.push(item)
    return item
  }

  public update(item: Office): Office | undefined {
    const idOfficex = offices.findIndex((office) => office.idOffice === item.idOffice)

    if (idOfficex !== -1) {
      offices[idOfficex] = { ...offices[idOfficex], ...item }
    }
    return offices[idOfficex]
  }

  public delete(item: { id: string }): Office | undefined {
    const idOfficex = offices.findIndex((office) => office.idOffice === item.id)

    if (idOfficex !== -1) {
      const deletedOffices = offices[idOfficex]
      offices.splice(idOfficex, 1)
      return deletedOffices
    }
  }
}