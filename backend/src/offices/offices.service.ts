import { orm } from '../shared/db/orm.js';
import { Office } from './offices.entity.js';
import { RequiredEntityData } from '@mikro-orm/core';

const em = orm.em;

export class OfficeService {
  // Devuelve true si hay error (tu lógica actual)
  async validateOfficeInput(input: any, isCreate = false): Promise<boolean> {
    // en create, description es obligatoria
    if (isCreate && (input.description == null || String(input.description).trim() === "")) {
      return true;
    }

    // si description viene, validar; si no viene, no rompas
    if (input.description !== undefined) {
      const desc = String(input.description).trim();
      if (desc.length < 3 || desc.length > 50) return true;
      if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(desc)) return true;
    }

    return false;
  }

  async findAllOffices(): Promise<Office[]> {
    return await em.find(Office, {});
  }

  async findAllActiveOffices(): Promise<Office[]> {
    return await em.find(Office, { active: true });
  }

  async findOficeById(idOffice: number): Promise<Office> {
    return await em.findOneOrFail(Office, { idOffice });
  }

  async createOffice(data: RequiredEntityData<Office>): Promise<Office> {
    const error = await this.validateOfficeInput(data, true); // <- exigir description en create
    if (error) throw Error("Error al crear consultorio, datos inválidos");

    const office = em.create(Office, data);
    await em.flush();
    return office;
  }

  async updateOffice(id: number, data: Partial<Office>): Promise<Office> {
    const error = await this.validateOfficeInput(data, false); // <- permitir parciales
    if (error) throw Error("Error al modificar consultorio, datos inválidos");

    const office = await em.findOneOrFail(Office, { idOffice: id });
    if (!office.active) throw Error("Consultorio desactivado, actívelo antes de modificar");

    em.assign(office, data);
    await em.flush();
    return office;
  }

    async toggleOfficeState(id: number): Promise<Office>{
        const office = await em.findOneOrFail(Office, {idOffice: id}, {populate: ['rooms']});
        office.active = !office.active;

        if(office.rooms?.length > 0 && !office.active){
            office.rooms.map(room => room.active = false);
        }

        await em.flush();
        return office;
    }
}