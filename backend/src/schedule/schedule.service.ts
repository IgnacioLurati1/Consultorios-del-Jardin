import { orm } from "../shared/db/orm.js";
import { Schedule } from "./schedules.entity.js";
import { RequiredEntityData } from "@mikro-orm/core";

const em = orm.em;
export class ScheduleService {

  async findAllSchedules() : Promise<Schedule[]> {
    return await em.find(Schedule, {});
  }

  async findScheduleByPK(day: string, initialHour: string): Promise<Schedule | null> {
    return await em.findOne(Schedule, { day, initialHour });
  }

  async createSchedule(data: RequiredEntityData<Schedule>) : Promise<Schedule> {
    //MAS VALIDACIONES A FUTURO

    const existingSchedule = await this.findScheduleByPK(data.day, data.initialHour);

    if (existingSchedule) throw new Error("Schedule with the same primary key already exists");

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


