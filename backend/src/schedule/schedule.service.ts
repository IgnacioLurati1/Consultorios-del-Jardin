import { orm } from "../shared/db/orm.js";
import { Schedule } from "./schedules.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Office } from "../offices/offices.entity.js";
import { EntityManager } from "@mikro-orm/mysql";

const em = orm.em;
export class ScheduleService {
  //Validaciones

  removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Elimina acentos y caracteres especiales
  }

  isValidDay(day: string): boolean {
    const normalizedDay = this.removeAccents(day.trim().toLowerCase()); // Convierte a minúsculas y elimina acentos
    const validDays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]; // Días válidos de la semana EN MINUSCULA Y SIN ACENTOS
    return validDays.includes(normalizedDay); // Retorna false si el día no es válido
  }

  isValidHourFormat(hour: string): boolean {
    const hourRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // Formato HH:MM (24 horas)
    return hourRegex.test(hour);
  }

  isValidHourRange(initialHour: string, finalHour: string): boolean {
    return initialHour < finalHour;
  }

  async isOverlappingSchedule(day: string, initialHour: string, finalHour: string, person: Person): Promise<boolean> {
    const existingSchedules = await this.findScheduleByEmailAndDay(person, day);

    for (const schedule of existingSchedules) {
      if (initialHour < schedule.finalHour && finalHour > schedule.initialHour) {
        return true; // Hay solapamiento
      }
    }
    return false;
  }

  async isOverlappingInRoom(day: string, initialHour: string, finalHour: string, room: Room): Promise<boolean> {
    const existingSchedules = await this.findScheduleByRoomAndDay(day, room);

    for (const schedule of existingSchedules) {
      if (initialHour < schedule.finalHour && finalHour > schedule.initialHour) {
        return true; // Hay solapamiento
      }
    }
    return false;
  }

  async isOutOfWorkingHours(RoomId: number, initialHour: string, finalHour: string): Promise<boolean> {
    const selectedRoom = await em.findOne(Room, { idRoom: RoomId }, { populate: ["office"] });

    if (!selectedRoom || !selectedRoom.office) {
      throw new Error("Office not found for the given room");
    }

    return initialHour < selectedRoom.office.openingTime || finalHour > selectedRoom.office.closingTime;
  }

  //CRUD basico

  async findAllSchedules(): Promise<Schedule[]> {
    return await em.find(Schedule, {});
  }

  async findScheduleByPK(day: string, initialHour: string, person: string): Promise<Schedule> {
    return await em.findOneOrFail(Schedule, { day, initialHour, person: { email: person } });
  }

  async findScheduleByEmail(email: string): Promise<Schedule[]> {
    return await em.find(Schedule, { person: { email } }, { populate: ["room", "person"] });
  }

  async findScheduleByEmailAndDay(person: Person, day: string): Promise<Schedule[]> {
    return await em.find(Schedule, { person, day });
  }

  async findScheduleByHourRange(initialHour: string, day: string, person: Person, office: Office, emT?: EntityManager): Promise<Schedule> {
    return await (emT || em).findOneOrFail(
      Schedule,
      {
        initialHour: { $lte: initialHour },
        finalHour: { $gt: initialHour },
        day,
        person,
        room: { office },
      },
      { populate: ["room"] }
    );
  }

  async findScheduleByRoomAndDay(day: string, room: Room): Promise<Schedule[]> {
    return await em.find(Schedule, { day, room });
  } // Metodo para buscar horarios por sala y día

  async findSchedulesByProfessionalAndOffice(professional: Person, office: Office, emT?: EntityManager): Promise<Schedule[]> {
    return await (emT || em).find(Schedule, { person: professional, room: { office } }, { populate: ["room"] });
  }

  async createSchedule(data: RequiredEntityData<Schedule>): Promise<Schedule> {
    data.day = this.removeAccents(data.day.trim().toLowerCase());

    const isValid =
      this.isValidDay(data.day) &&
      this.isValidHourFormat(data.initialHour) &&
      this.isValidHourFormat(data.finalHour) &&
      this.isValidHourRange(data.initialHour, data.finalHour);

    if (!isValid) {
      throw new Error("Invalid schedule data");
    }
    //Validaciones de solapamiento y horario laboral en paralelo
    const [overlapping, existingInRoom, outOfHours] = await Promise.all([
      this.isOverlappingSchedule(data.day, data.initialHour, data.finalHour, data.person as Person),
      this.isOverlappingInRoom(data.day, data.initialHour, data.finalHour, data.room as Room),
      this.isOutOfWorkingHours(data.room as any as number, data.initialHour, data.finalHour),
    ]);

    if (overlapping) {
      throw new Error("Horario solapado");
    }

    if (existingInRoom) {
      throw new Error("La sala ya está ocupada en ese horario");
    }

    if (outOfHours) {
      throw new Error("Fuera del horario laboral del consultorio");
    }

    const schedule = em.create(Schedule, data);
    await em.populate(schedule, ["room", "person"]);
    await em.flush();
    return schedule;
  }

  async updateSchedule(data: Partial<Schedule>): Promise<Schedule> {
    const schedule = await em.findOneOrFail(Schedule, { day: data.day, initialHour: data.initialHour, person: data.person as Person });

    if (!schedule) throw new Error("Schedule not found");

    em.assign(schedule, data);
    await em.flush();
    return schedule;
  }

  async removeSchedule(day: string, initialHour: string, person: string): Promise<void> {
    const deleted = await em.nativeDelete(Schedule, { day, initialHour, person: { email: person } });

    if (deleted === 0) throw new Error("Schedule not found");
  }

  //esto se podria eliminar
  /*
  async toggleScheduleState(day: string, initialHour: string) {
    const schedule = await em.findOneOrFail(Schedule, { day, initialHour });

    if (!schedule) throw new Error("Schedule not found");

    schedule.active = !schedule.active;

    await em.flush();
    return schedule;
  } */
}
