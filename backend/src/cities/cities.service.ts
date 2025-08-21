import { orm } from '../shared/db/orm.js';
import { City } from './cities.entity.js';
import { Office } from '../offices/offices.entity.js';
import type { RequiredEntityData } from '@mikro-orm/core';

const em = orm.em;

export class CityService {

  async findAllCities(): Promise<City[]> {
    return await em.find(City, {}, { populate: ['province'] });
  }

  async findCityById(idCity:number): Promise<City>{
    return await em.findOneOrFail(City, { idCity }, { populate: ['province']})
  }


  async createCity(data: RequiredEntityData<City>): Promise<City> {
    const city = em.create(City, data);
    await em.flush();
    return await em.findOneOrFail(City, { idCity: city.idCity }, { populate: ['province'] });
  }

  async updateCity(id:number, data:Partial<City>): Promise<City>{
    const city = await em.findOneOrFail(City,  { idCity : id })
    em.assign(city, data)
    await em.flush() 
    return await em.findOneOrFail(City, { idCity: id }, {populate: ['province']})
  }

  async toggleCityState(id: number):Promise<City>{
    const city = await em.findOneOrFail(City,  { idCity : id }, {populate: ['offices']})

    city.active = !city.active;

    if (city.offices?.length > 0 && !city.active) {
      city.offices.map(office => office.active = city.active);
    }

    await em.flush();
    return city;
  }

  async cityExistsWithNameAndProvince(nameCity: string, province: string, excludeId?: number) {
        const whereClause: any = { nameCity: { $like: nameCity.trim() }, province };
        if (excludeId) whereClause.idCity = { $ne: excludeId };
        return await em.findOne(City, whereClause);
  }
  
}