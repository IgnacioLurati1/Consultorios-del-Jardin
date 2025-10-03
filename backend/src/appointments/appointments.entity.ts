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

  @Property({ nullable: false })
  duration!: number;

  @Property({ nullable: false })
  value!: number;

  @Property({ nullable: false })
  type!: "single" | "group";

  @OneToMany(() => Diagnostic, (diagnostic) => diagnostic.appointment)
  diagnostics = new Collection<Diagnostic>(this);

  @Property({ default: "NO" })
  cancelDate: string = "NO";

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;
}
