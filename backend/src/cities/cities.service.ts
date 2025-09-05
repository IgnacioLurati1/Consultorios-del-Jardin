import { orm } from '../shared/db/orm.js';
import { City } from './cities.entity.js';
import { ProvinceService } from '../provinces/provinces.service.js';
import type { RequiredEntityData } from '@mikro-orm/core';

const em = orm.em;
export class CityService {

    constructor(private provinceService = new ProvinceService()) {}


    //VALIDATIONS


   async validateCityAdd(sanitizedInput: any): Promise<boolean> {

    if (sanitizedInput.nameCity.length < 3 || sanitizedInput.nameCity.length > 25) {
      return true
    } 
    else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
      return true
    }

    try{
      const province = await this.provinceService.findProvinceById(sanitizedInput.province)
      
      if(province.active){
        return false
      }
      return true

    } catch(error:any){
      return true
    }
  }


  async validateCityUpdate(id: number, sanitizedInput: any): Promise<boolean> {

      if (sanitizedInput.nameCity.length < 2 || sanitizedInput.nameCity.length > 100) {
        return true;
      } 
      else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
        return true;
      }
  
    try{
      const province = await this.provinceService.findProvinceById(sanitizedInput.province)
      
      if(province.active){
        return false
      }
      return true

    } catch(error:any){

      return true

    }
  }
    
  //SERVICES

  async findAllCities(): Promise<City[]> {
    let cities = await em.find(City, {province: {active: true}}, { populate: ['province'] });
    return cities;
  }

  async findAllActiveCities(): Promise<City[]> {
    let cities = await em.find(City, {active: true, province: {active: true}}, { populate: ['province'] });
    return cities;
  }

  async findCityById(idCity:number): Promise<City>{
    return await em.findOneOrFail(City, { idCity }, { populate: ['province']})
  }

  async createCity(data: RequiredEntityData<City>): Promise<City> {
    const error = await this.validateCityAdd(data)

    if (error){
      throw new Error("Error al crear localidad, datos inválidos")
    }

    const city = em.create(City, data);
    await em.flush();

    return await em.findOneOrFail(City, { idCity: city.idCity }, { populate: ['province'] })

  }

  async updateCity(id:number, data:Partial<City>): Promise<City>{
    const error = await this.validateCityUpdate(id, data)
    
    if(error){
      throw new Error("Error al modificar localidad, datos inválidos")
    }
    
    const city = await em.findOneOrFail(City,  { idCity : id })

    if(city.active){
      em.assign(city, data)
      await em.flush() 
      return await em.findOneOrFail(City, { idCity: id }, {populate: ['province']})
    
    } else {
      throw new Error("Localidad desactivada, active primero antes de modificar")
    }
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