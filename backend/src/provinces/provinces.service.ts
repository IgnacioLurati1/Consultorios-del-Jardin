import { orm } from '../shared/db/orm.js';
import { Province } from './provinces.entity.js';
import { RequiredEntityData } from '@mikro-orm/core';

const em = orm.em;
export class ProvinceService{

    async validateProvinceInput(sanitizedInput: any) : Promise<Boolean>{
        if(sanitizedInput.nameProvince.length > 25 || sanitizedInput.nameProvince.length < 3) return true;
        if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.nameProvince)) return true;
        
        return false;
    }
    
    async findAllProvinces(): Promise<Province[]> {
        return await em.find(Province, {});
    }

    async findAllActiveProvinces(): Promise<Province[]>{
        return await em.find(Province, {active: true});
    }
    
    async findProvinceById(idProvince:number): Promise<Province>{
        return await em.findOneOrFail(Province, { idProvince });
    }

    async createProvince(data: RequiredEntityData<Province>): Promise<Province> {
        const error = await this.validateProvinceInput(data)

        if(error) throw Error("Error al crear provincia, datos inválidos")

        const province = em.create(Province, data);
        await em.flush();

        return province;
        
    }

    async updateProvince(id:number, data:Partial<Province>): Promise<Province>{
        const error = await this.validateProvinceInput(data)

        if(error) throw Error("Error al modificar provincia, datos inválidos")

        const province = await em.findOneOrFail(Province, { idProvince: id });

        if(!province.active) throw Error("Provincia desactivada, active primero antes de modificar")

        em.assign(province, data);
        await em.flush();
        return province;
    }

    async toggleProvinceState(id: number):Promise<Province>{
        const province = await em.findOneOrFail(Province, { idProvince: id }, {populate: ['cities']});
        province.active = !province.active;

        if(province.cities?.length > 0 && !province.active) {
            province.cities.map(city => city.active = false);
        }

        await em.flush();
        return province;
    }
}