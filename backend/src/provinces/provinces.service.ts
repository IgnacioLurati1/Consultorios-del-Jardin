import { orm } from '../shared/db/orm.js';
import { Province } from './provinces.entity.js';
import { RequiredEntityData } from '@mikro-orm/core';

const em = orm.em;

export class ProvinceService{
    async findAllProvinces(): Promise<Province[]> {
        return await em.find(Province, {});
    }

    async findAllActiveProvinces(): Promise<Province[]>{
        let provinces = await em.find(Province, {});
        provinces = provinces.filter(province => province.active);
        return provinces;
    }
    
    async findProvinceById(idProvince:number): Promise<Province>{
        return await em.findOneOrFail(Province, { idProvince });
    }

    async createProvince(data: RequiredEntityData<Province>): Promise<Province> {
        const province = em.create(Province, data);
        await em.flush();
        return province;
    }

    async updateProvince(id:number, data:Partial<Province>): Promise<Province>{
        const province = await em.findOneOrFail(Province, { idProvince: id });
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