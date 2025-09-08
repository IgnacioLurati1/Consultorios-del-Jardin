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

  /*isOverlappingSchedule(day: string, initialHour: string, finalHour: string, personMail: string, roomId: number): boolean {
    const existingSchedulesByDayPersonRoom = em.find(Schedule, { day, person: personMail, room: roomId });

  }*/

  //CRUD basico

  async findAllSchedules() : Promise<Schedule[]> {
    return await em.find(Schedule, {});
  }

  async findScheduleById(id: number): Promise<Schedule> {
    return await em.findOneOrFail(Schedule, { idSchedule: id });
  }

  async findScheduleByEmailAndRoom(email: string, Id: number) : Promise<Schedule[]> {
    return await em.find(Schedule, { person: { email }, room: { idRoom: Id } });
  }

  async createSchedule(data: RequiredEntityData<Schedule>) : Promise<Schedule> {

    //Validaciones debiles
    const isValid = this.isValidDay(data.day) && 
                    this.isValidHourFormat(data.initialHour) && 
                    this.isValidHourFormat(data.finalHour) && 
                    this.isValidHourRange(data.initialHour, data.finalHour);

    if (!isValid) {
      throw new Error("Invalid schedule data");
    }
    
    //Creacion
    const schedule = em.create(Schedule, data);
    await em.flush();
    return schedule;
    
  }

  async updateSchedule(day: string, initialHour: string, data: Partial<Schedule>) : Promise<Schedule> {

    const schedule = await em.findOneOrFail(Schedule, { day, initialHour });

    if (!schedule) throw new Error("Schedule not found");

    em.assign(schedule, data);
    await em.flush();
    return schedule;
  }

  async toggleScheduleState(day: string, initialHour: string) {

    const schedule = await em.findOneOrFail(Schedule, { day, initialHour });

    if (!schedule) throw new Error("Schedule not found");

    schedule.active = !schedule.active;
    
    await em.flush();
    return schedule;
  }
}


