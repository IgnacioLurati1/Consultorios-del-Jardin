import { EntityManager } from "@mikro-orm/mysql";
import { OfficeService } from "../offices/offices.service.js";
import { PeopleService } from "../people/people.service.js";
import { RoomService } from "../rooms/rooms.services.js";
import { ScheduleService } from "../schedule/schedule.service.js";
import { AppointmentService } from "./appointments.service.js";

export class AppointmentEngine {
  private peopleService: PeopleService;
  private scheduleService: ScheduleService;
  private officeService: OfficeService;
  private roomService: RoomService;
  private appointmentService: AppointmentService;
  private em: EntityManager;

  constructor(
    people: PeopleService,
    schedule: ScheduleService,
    office: OfficeService,
    room: RoomService,
    appointment: AppointmentService,
    em: EntityManager
  ) {
    this.peopleService = people;
    this.scheduleService = schedule;
    this.officeService = office;
    this.roomService = room;
    this.appointmentService = appointment;
    this.em = em;
  }
}
