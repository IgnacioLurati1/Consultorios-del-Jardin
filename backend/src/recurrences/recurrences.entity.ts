import { Entity, Property, PrimaryKey, ManyToOne, Rel } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";
import { Room } from "../rooms/rooms.entity.js";

export type RecurrenceFrequency = "weekly" | "biweekly";

/**
 * Turno repetible: la configuración con la que el backend va creando, solo, los turnos
 * que se repiten todas las semanas o cada dos semanas.
 *
 * No es un turno: es la receta. Los turnos que salen de acá son turnos comunes y
 * corrientes (se cancelan, se editan y se cobran igual), apenas apuntan de vuelta a
 * la receta que los creó.
 */
@Entity()
export class Recurrence {
  @PrimaryKey()
  idRecurrence?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  // El paciente puede faltar, igual que en un turno suelto que todavía no tiene a quién.
  @ManyToOne(() => Person, { nullable: true })
  patient?: Rel<Person> | null;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;

  @Property({ nullable: false, type: "time" })
  initialHour!: string;

  @Property({ nullable: false, type: "time" })
  finalHour!: string;

  @Property({ nullable: true })
  value!: number;

  @Property()
  frequency!: RecurrenceFrequency;

  // Los turnos que genera nacen con esta marca, igual que el que le dio origen.
  @Property({ default: false })
  overbooked: boolean = false;

  // Fecha del turno que la originó. Fija el día de la semana y, en las quincenales,
  // de qué semana se trata.
  @Property({ nullable: false, type: "date" })
  startDate!: Date;

  // Hasta dónde llegó la generación. El job sigue desde acá, así no repite ni saltea.
  @Property({ nullable: false, type: "date" })
  lastGeneratedDate!: Date;

  // Último día en el que se puede crear un turno de esta repetición. En null se repite
  // sin fecha de corte, que es lo que hace falta para un paciente de tratamiento largo.
  // Cuando la generación pasa esta fecha, la repetición se frena sola.
  @Property({ nullable: true, type: "date" })
  endDate?: Date | null;

  // Apagarla corta la generación de acá en adelante y no toca ningún turno ya creado.
  @Property({ default: true })
  active: boolean = true;

  @Property({ nullable: true })
  stoppedAt?: Date | null;
}
