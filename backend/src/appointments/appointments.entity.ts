import { Entity, Property, PrimaryKey, ManyToOne, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";

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

  // pending -> accepted -> assisted. Al cancelar se guarda un ISO timestamp,
  // para que el unique index de arriba permita volver a sacar turno en el mismo horario.
  @Property({ default: "pending" })
  state: string = "pending";

  // Observaciones clínicas que carga el profesional (antes vivían en Diagnostic)
  @Property({ nullable: true, type: "text" })
  observations?: string | null;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  // Un turno tiene un solo paciente. Es nullable porque el profesional puede
  // crear el turno primero y asignar el paciente después.
  @ManyToOne(() => Person, { nullable: true })
  patient?: Rel<Person> | null;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;

  @Property({ default: "not sent" })
  reminderSent: "not sent" | "sent" = "not sent";
}
