import { Entity, Property, PrimaryKey, ManyToOne, Rel, Unique, ManyToMany, OneToMany, Collection } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Diagnostic } from "./diagnostics.entity.js";

@Entity()
@Unique({ properties: ["date", "initialHour", "professional", "cancelDate"] })
export class Appointment {
  @PrimaryKey()
  numAppointment?: number;

  @Property({ nullable: false })
  date!: Date;

  @Property({ nullable: false, type: "time" })
  initialHour!: string;

  @Property({ nullable: false, type: "time" })
  finalHour!: string;

  @Property({ nullable: true })
  value!: number;

  @Property({ nullable: false })
  type!: "single" | "group";

  @OneToMany(() => Diagnostic, (diagnostic) => diagnostic.appointment)
  diagnostics = new Collection<Diagnostic>(this);

  @Property({ default: "Pending" })
  cancelDate: string = "Pending";

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;
}
