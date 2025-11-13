import { orm } from "../shared/db/orm.js";
import { Room } from "./rooms.entity.js";
import { EntityManager } from "@mikro-orm/core";
//import { OfficeService } from '../offices/offices.service.js'; ----------- FALTA LO DE ALAN -
import type { RequiredEntityData } from "@mikro-orm/core";

const em = orm.em;
export class RoomService {
  //constructor(private officeService = new OfficeService()) {} ----------- FALTA LO DE ALAN -

  //VALIDATIONS

  async validateRoomInput(sanitizedInput: any): Promise<boolean> {
    if (sanitizedInput.description.length < 3 || sanitizedInput.description.length > 40) {
      return true;
    } else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitizedInput.description)) {
      return true;
    }

    try {
      //const office = await this.officeService.findOfficeById(sanitizedInput.office) ----------- FALTA LO DE ALAN -

      if (true) {
        // cambiar a office.active ----------- FALTA LO DE ALAN -
        return false;
      }
      return true;
    } catch (error: any) {
      return true;
    }
  }

  //SERVICES

  async findAllRooms(): Promise<Room[]> {
    let rooms = await em.find(Room, { office: { active: true } }, { populate: ["office.city"] });
    return rooms;
  }

  async findAllActiveRooms(): Promise<Room[]> {
    let rooms = await em.find(Room, { active: true, office: { active: true } }, { populate: ["office.city"] });
    return rooms;
  }

  async findRoomById(idRoom: number, emT?: EntityManager): Promise<Room> {
    return await (em || emT).findOneOrFail(Room, { idRoom }, { populate: ["office.city"] });
  }

  async createRoom(data: RequiredEntityData<Room>): Promise<Room> {
    const error = await this.validateRoomInput(data);

    if (error) {
      throw new Error("Error al crear sala, datos inválidos");
    }

    const room = em.create(Room, data);
    await em.flush();

    return await em.findOneOrFail(Room, { idRoom: room.idRoom }, { populate: ["office"] });
  }

  async updateRoom(id: number, data: Partial<Room>): Promise<Room> {
    const error = await this.validateRoomInput(data);

    if (error) {
      throw new Error("Error al modificar sala, datos inválidos");
    }

    const room = await em.findOneOrFail(Room, { idRoom: id });

    if (room.active) {
      em.assign(room, data);
      await em.flush();
      return await em.findOneOrFail(Room, { idRoom: id }, { populate: ["office.city"] });
    } else {
      throw new Error("Sala desactivada, active primero antes de modificar");
    }
  }

  async toggleRoomState(id: number): Promise<Room> {
    const room = await em.findOneOrFail(Room, { idRoom: id }, { populate: ["office"] });

    room.active = !room.active;

    /*if (room.offices?.length > 0 && !room.active) {
        room.offices.map(office => office.active = room.active);
        } ----------- Aca iria si room tuviera una relacion donde algo dependa de ella, para hacer la baja en casacada - */

    await em.flush();
    return room;
  }

  async roomExistsWithDescriptionAndOffice(description: string, office: string, excludeId?: number) {
    const whereClause: any = { description: { $like: description.trim() }, office };
    if (excludeId) whereClause.idRoom = { $ne: excludeId };
    return await em.findOne(Room, whereClause);
  }
}
