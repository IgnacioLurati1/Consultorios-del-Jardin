import { orm } from '../shared/db/orm.js';
import { City } from './cities.entity.js';
import { ProvinceService } from '../provinces/provinces.service.js';
import type { RequiredEntityData } from '@mikro-orm/core';
import { ValidationError } from '../errors/ValidationError.js';

const em = orm.em;
export class CityService {

    constructor(private provinceService = new ProvinceService()) {}


    //VALIDATIONS


    async validateCityAdd(sanitizedInput: any): Promise<string[]> {
    const errors: string[] = []

    if (sanitizedInput.nameCity === undefined || sanitizedInput.nameCity === "") {
      errors.push('El nombre de la ciudad es obligatorio');
      }
      else {
        if (typeof sanitizedInput.nameCity !== 'string') {
        errors.push('El nombre de la ciudad debe ser una cadena de texto');
      } 
      if (sanitizedInput.nameCity.length < 2) {
        errors.push('El nombre de la ciudad es obligatorio y debe tener al menos 2 caracteres');
      } 
      if (sanitizedInput.nameCity.length > 100) {
        errors.push('El nombre de la ciudad no puede tener más de 100 caracteres');
      } 
      if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
        errors.push('El nombre de la ciudad solo puede contener letras, espacios, guiones y apóstrofes');
      }

    if(sanitizedInput.province === undefined || sanitizedInput.province === ''){
      errors.push('La provincia es obligatoria')
    }else{
      try{
        const id = Number.parseInt(sanitizedInput.province)
        const province = await this.provinceService.findProvinceById(id)
        if(province && !province.active){
          errors.push('La provincia está deshabilitada')
        }
      }catch(error: any) {
        errors.push('Error al validar estado de la provincia seleccionada')
      }
    }

    if(errors.length == 0){
        try {
              const existingCity = await this.cityExistsWithNameAndProvince(sanitizedInput.nameCity, sanitizedInput.province);

              if (existingCity) {
                errors.push('Ya existe una ciudad con el mismo nombre en la misma provincia')
              }
            }catch(error: any) {
              errors.push('Error al validar ciudades con mismo nombre')
      }
    }
    }

    return errors
  }

  async validateCityUpdate(id: number, sanitizedInput: any): Promise<string[]> {
    const errors: string[] = []

    if ((sanitizedInput.nameCity === undefined || sanitizedInput.nameCity === "")&&(sanitizedInput.province === undefined || sanitizedInput.province === '')){
      errors.push('Se necesita al menos un campo, nombre o provincia, para modificar');
      }
    else if(sanitizedInput.nameCity !== "") {
      if (typeof sanitizedInput.nameCity !== 'string') {
        errors.push('El nombre de la ciudad debe ser una cadena de texto');
      } 
      if (sanitizedInput.nameCity.length < 2) {
        errors.push('El nombre de la ciudad es obligatorio y debe tener al menos 2 caracteres');
      } 
      if (sanitizedInput.nameCity.length > 100) {
        errors.push('El nombre de la ciudad no puede tener más de 100 caracteres');
      } 
      if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameCity)) {
        errors.push('El nombre de la ciudad solo puede contener letras, espacios, guiones y apóstrofes');
      }
    }
    
    if(sanitizedInput.province !== ""){
      try{
        const idProvince = Number.parseInt(sanitizedInput.province)
        const province = await this.provinceService.findProvinceById(idProvince)
        if(province && !province.active){
          errors.push('La provincia está deshabilitada')
        }
      }catch(error: any) {
        errors.push('Error al validar estado de la provincia seleccionada, asegúrese de ingresar una provincia existente')
      }
    }
    

    if(errors.length == 0){
        try {
              const existingCity = await this.cityExistsWithNameAndProvince(sanitizedInput.nameCity, sanitizedInput.province, id);

              if (existingCity) {
                errors.push('Ya existe una ciudad con el mismo nombre en la misma provincia')
              }
            }catch(error: any) {
              errors.push('Error al validar ciudades con mismo nombre')
      }
    }

    return errors
  }

  //SERVICES

  async findAllCities(): Promise<City[]> {
    let cities = await em.find(City, {}, { populate: ['province'] });
    cities = cities.filter(city => city.province.active) ; //Filter all cities by its province state
    return cities;
  }



  async findAllActiveCities(): Promise<City[]> {
    let cities = await em.find(City, {}, { populate: ['province'] });
    cities = cities.filter(city => city.province.active && city.active); //Filter all cities by its province state and its own state
    return cities;
  }



  async findCityById(idCity:number): Promise<City>{
    return await em.findOneOrFail(City, { idCity }, { populate: ['province']})
  }


  
  async createCity(data: RequiredEntityData<City>): Promise<City> {
    const errors = await this.validateCityAdd(data)

    if (errors.length > 0){
      throw new ValidationError(errors.join(", "))
    }

    const city = em.create(City, data);
    await em.flush();

    return await em.findOneOrFail(City, { idCity: city.idCity }, { populate: ['province'] })

  }

  async updateCity(id:number, data:Partial<City>): Promise<City>{
    const errors = await this.validateCityUpdate(id, data)
    
    if(errors.length > 0){
      throw new ValidationError(errors.join(", "))
    }
    
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