import { Entity, Property, PrimaryKey, ManyToOne, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";
import { Recurrence } from "../recurrences/recurrences.entity.js";

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

  // Sobreturno: el profesional lo mete fuera de sus módulos de atención, eligiendo
  // el horario a mano. Un turno normal tiene que caer justo en un módulo suyo y durar
  // lo que dure ese módulo.
  @Property({ default: false })
  overbooked: boolean = false;

  // Quién dio de alta el turno: el paciente desde la app o el profesional a mano.
  // Es nullable porque los turnos anteriores a esta columna no se pueden clasificar
  // con certeza: en analytics se cuentan aparte, como "sin dato".
  @Property({ nullable: true })
  origin?: "patient" | "professional" | null;

  // Si salió de un turno repetible, apunta a la configuración que lo generó (o que se
  // creó a partir de él). Cancelar o editar el turno no toca la configuración, y
  // apagar la configuración no toca los turnos ya creados.
  @ManyToOne(() => Recurrence, { nullable: true })
  recurrence?: Rel<Recurrence> | null;
}
