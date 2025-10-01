import { Entity, Property, PrimaryKey, ManyToOne, Rel, Unique, ManyToMany } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";

@Entity()
export class Appointment {
  @PrimaryKey()
  numAppointment?: number;

  @Property({ nullable: false })
  date!: Date;

  @Property({ nullable: false })
  initialHour!: string;

  @Property({ nullable: false })
  duration!: number;

  @Property({ nullable: false })
  value!: number;

  @Property({ nullable: false })
  type!: string;

  @ManyToMany(() => Person, (person) => person.appointments, { owner: true })
  pacients!: Rel<Person[]>;

  @ManyToOne(() => Schedule, { nullable: true })
  schedule!: Rel<Schedule>;
}
