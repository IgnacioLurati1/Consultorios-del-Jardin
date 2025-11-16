import { Entity, Property, PrimaryKey, ManyToOne, Rel, Unique, ManyToMany, OneToMany, Collection, Cascade } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Diagnostic } from "./diagnostics.entity.js";

@Entity()
@Unique({ properties: ["date", "initialHour", "professional", "state"] })
export class Appointment {
  @PrimaryKey()
  numAppointment?: number;

  @Property({ nullable: false, type: "date" })
  date!: Date;

  @Property({ nullable: false, type: "time" })
  initialHour!: string;

  @Property({ nullable: false, type: "time" })
  finalHour!: string;

  @Property({ nullable: true })
  value!: number;

  @Property({ nullable: false })
  type!: "simple" | "taller";

  @OneToMany(() => Diagnostic, (diagnostic) => diagnostic.appointment, { orphanRemoval: true, cascade: [Cascade.REMOVE] })
  diagnostics = new Collection<Diagnostic>(this);

  @Property({ default: "pending" })
  state: string = "pending";

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;

  @Property({ default: "not sent" })
  reminderSent: "not sent" | "sent" = "not sent";
}
