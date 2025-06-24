import { Repository } from '../shared/repository.js'
import { City } from './cities.entity.js'

const cities = [
  new City(
    '01',
    'Rosario',
    '01'
  ),
]

export class CitiesRepository implements Repository<City> {
  public findAll(): City[] | undefined {
    return cities
}

  public findOne(item: { id: string }): City | undefined {
    return cities.find((city) => city.idCity === item.id)
  }

  public add(item: City): City | undefined {
    cities.push(item)
    return item
  }

  public update(item: City): City | undefined {
    const idCityx = cities.findIndex((city) => city.idCity === item.idCity)

    if (idCityx !== -1) {
      cities[idCityx] = { ...cities[idCityx], ...item }
    }
    return cities[idCityx]
  }

  public delete(item: { id: string }): City | undefined {
    const idCityx = cities.findIndex((city) => city.idCity === item.id)

    if (idCityx !== -1) {
      const deletedCities = cities[idCityx]
      cities.splice(idCityx, 1)
      return deletedCities
    }
  }
}