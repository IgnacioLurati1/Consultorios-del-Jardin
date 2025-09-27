import { orm } from "../shared/db/orm.js";
import { Schedule } from "./schedules.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";

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

  isValidAllowedTypes(allowedType: string): boolean {
    const normalizedType = this.removeAccents(allowedType.trim().toLowerCase()); // Convierte a minúsculas y elimina acentos
    const validTypes = ["simple", "taller"]; // Tipos permitidos
    return validTypes.includes(normalizedType); // Retorna false si el tipo no es válido
  }

  async isOverlappingSchedule(day: string, initialHour: string, finalHour: string, person: Person): Promise<boolean> {
    const existingSchedules = await this.findScheduleByEmailAndDay(person, day);

    for (const schedule of existingSchedules) {
      if ((initialHour < schedule.finalHour) && (finalHour > schedule.initialHour)) {
        return true; // Hay solapamiento
      }
    }
    return false;
  }

  async isOverlappingInRoom(day: string, initialHour: string, finalHour: string, room: Room): Promise<boolean> {
    const existingSchedules = await this.findScheduleByRoomAndDay(day, room);

    for (const schedule of existingSchedules) {
      if ((initialHour < schedule.finalHour) && (finalHour > schedule.initialHour)) {
        return true; // Hay solapamiento
      }
    }
    return false;
  }

  //CRUD basico

  async findAllSchedules() : Promise<Schedule[]> {
    return await em.find(Schedule, {});
  }

  async findScheduleByPK(day: string, initialHour: string, person: string): Promise<Schedule> {
    return await em.findOneOrFail(Schedule, { day, initialHour, person: { email: person } });
  }

  async findScheduleByEmail(email: string) : Promise<Schedule[]> {
    return await em.find(Schedule, { person: { email } }, { populate: ['room','person'] });
  }

  async findScheduleByEmailAndDay(person: Person, day: string) : Promise<Schedule[]> {
    return await em.find(Schedule, { person, day });
  }

  async findScheduleByRoomAndDay(day: string, room: Room) : Promise<Schedule[]> {
    return await em.find(Schedule, {day, room});
  } // Metodo para buscar horarios por sala y día

  async createSchedule(data: RequiredEntityData<Schedule>) : Promise<Schedule> {

    //Validaciones fuertes
    const overlapping = await this.isOverlappingSchedule(data.day, data.initialHour, data.finalHour, data.person as Person);

    if (overlapping) {
      throw new Error("Horario solapado");
    }

    const existingInRoom = await this.isOverlappingInRoom(data.day, data.initialHour, data.finalHour, data.room as Room);

    if (existingInRoom) {
      throw new Error("La sala ya está ocupada en ese horario");
    }

    //Validaciones debiles
    const isValid = this.isValidDay(data.day) && 
                    this.isValidHourFormat(data.initialHour) && 
                    this.isValidHourFormat(data.finalHour) && 
                    this.isValidHourRange(data.initialHour, data.finalHour) &&
                    this.isValidAllowedTypes(data.allowedType);

    if (!isValid) {
      throw new Error("Invalid schedule data");
    }
    
    //Creacion
    const schedule = em.create(Schedule, data);
    await em.flush();
    return await em.findOneOrFail(Schedule, { person: schedule.person, day: schedule.day, initialHour: schedule.initialHour }, { populate: ['room','person'] });
    
  }

  async updateSchedule(data: Partial<Schedule>) : Promise<Schedule> {

    const schedule = await em.findOneOrFail(Schedule, { day : data.day, initialHour: data.initialHour, person: data.person as Person });

    if (!schedule) throw new Error("Schedule not found");

    em.assign(schedule, data);
    await em.flush();
    return schedule;
  }

  async removeSchedule(day: string, initialHour: string, person: string) : Promise<void> {

    const deleted = await em.nativeDelete(Schedule, { day, initialHour, person: { email: person } });

    if (deleted === 0) throw new Error("Schedule not found");
  }


  //esto se podria eliminar
  async toggleScheduleState(day: string, initialHour: string) {

    const schedule = await em.findOneOrFail(Schedule, { day, initialHour });

    if (!schedule) throw new Error("Schedule not found");

    schedule.active = !schedule.active;
    
    await em.flush();
    return schedule;
  }
}


