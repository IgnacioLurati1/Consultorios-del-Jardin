import { orm } from "../shared/db/orm.js";
import { Schedule } from "./schedules.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";

const em = orm.em;
export class ScheduleService {

  //Validaciones

  async existingSchedule(day: string, initialHour: string): Promise<boolean> {
    const schedule = await em.findOne(Schedule, { day, initialHour });
    return !!schedule; // Retorna true si el horario ya existe
  }

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

  //CRUD basico

  async findAllSchedules() : Promise<Schedule[]> {
    return await em.find(Schedule, {});
  }

  async findScheduleByPK(day: string, initialHour: string): Promise<Schedule | null> {
    return await em.findOne(Schedule, { day, initialHour });
  }

  async createSchedule(data: RequiredEntityData<Schedule>) : Promise<Schedule | null> {

    //Validaciones fuertes
    if (await this.existingSchedule(data.day, data.initialHour)) {
      throw new Error("Schedule with the same primary key already exists");
    }

    //Validaciones debiles
    const isValid = this.isValidDay(data.day) && 
                    this.isValidHourFormat(data.initialHour) && 
                    this.isValidHourFormat(data.finalHour) && 
                    this.isValidHourRange(data.initialHour, data.finalHour);

    if (!isValid) {
      return null;
    }else {
      const schedule = em.create(Schedule, data);
      await em.flush();
      return schedule;
    }
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


