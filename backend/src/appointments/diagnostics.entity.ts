import { Entity, Property, ManyToOne, Rel } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Appointment } from "./appointments.entity.js";

@Entity()
export class Diagnostic {
  @ManyToOne(() => Appointment, { primary: true, fieldName: "num_appointment" })
  appointment!: Rel<Appointment>;

  @ManyToOne(() => Person, { primary: true, fieldName: "patient_email" })
  patient!: Rel<Person>;

  @Property()
  state!: string;

  @Property({ nullable: true })
  observations?: string;
}
