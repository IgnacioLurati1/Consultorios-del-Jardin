import { Schedule } from "../schedule/schedules.entity.js";
import { orm } from "../shared/db/orm.js";
import { Office } from "./offices.entity.js";
import { EntityManager, RequiredEntityData } from "@mikro-orm/core";
import { Request, Response, NextFunction } from "express";

const em = orm.em;

export class OfficeService {
  async validateOfficeInput(input: any, isCreate = false): Promise<boolean> {
    if (isCreate && (input.description == null || String(input.description).trim() === "")) {
      return true;
    }

    const timesValid = await this.validateOfficeTimes(input);
    if (!timesValid) return true;

    if (input.description !== undefined) {
      const desc = String(input.description).trim();
      if (desc.length < 3 || desc.length > 50) return true;
      if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(desc)) return true;
    }
    return false;
  }

  async findAllOffices(): Promise<Office[]> {
    return await em.find(Office, {}, { populate: ["city", "city.province"] });
  }

  async findAllActiveOffices(): Promise<Office[]> {
    let offices = await em.find(Office, { active: true, city: { active: true } }, { populate: ["city", "city.province"] });
    return offices;
  }

  async findOficeById(idOffice: number, emT?: EntityManager): Promise<Office> {
    return await (emT || em).findOneOrFail(Office, { idOffice }, { populate: ["city", "city.province"] });
  }

  async findOfficesByProfessional(email: string): Promise<Office[]> {
    const query = em
      .createQueryBuilder(Schedule, "s")
      .select("o.*")
      .distinct()
      .join("s.person", "p")
      .join("s.room", "r")
      .join("r.office", "o")
      .where({ "p.email": email, "o.active": true });
    return await query.execute();
  }

  async createOffice(data: RequiredEntityData<Office>): Promise<Office> {
    const error = await this.validateOfficeInput(data, true);
    if (error) throw Error("Error al crear consultorio, datos inválidos");

    const office = em.create(Office, data);
    await em.flush();
    return await em.findOneOrFail(Office, { idOffice: office.idOffice }, { populate: ["city", "city.province"] });
  }

  async updateOffice(id: number, data: Partial<Office>): Promise<Office> {
    const error = await this.validateOfficeInput(data, false);
    if (error) throw Error("Error al modificar consultorio, datos inválidos");

    const office = await em.findOneOrFail(Office, { idOffice: id }, { populate: ["city", "city.province"] });
    if (!office.active) throw Error("Consultorio desactivado, actívelo antes de modificar");

    em.assign(office, data);
    await em.flush();
    await em.populate(office, ["city", "city.province"]);
    return office;
  }

  async toggleOfficeState(id: number): Promise<Office> {
    const office = await em.findOneOrFail(Office, { idOffice: id }, { populate: ["rooms"] });
    office.active = !office.active;

    if (office.rooms?.length > 0 && !office.active) {
      office.rooms.map((room) => (room.active = false));
    }

    await em.flush();
    return office;
  }

  private async validateOfficeTimes(input: any): Promise<boolean> {
    if (input?.openingTime && input?.closingTime) {
      const openingTime = parseInt(input.openingTime.replace(":", ""), 10);
      const closingTime = parseInt(input.closingTime.replace(":", ""), 10);

      if (openingTime < closingTime) {
        return true; // horario correcto
      }

      return false; // horario inválido
    }

    return false; // faltan datos
  }
}
