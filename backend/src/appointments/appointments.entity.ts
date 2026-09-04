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

  /**
   * Cuánto sale el turno.
   *
   * Puede no estar. Un turno importado de un calendario donde nadie anotó el precio no
   * tiene valor, y ponerle cero diría otra cosa: que se atendió gratis. Null es "no se
   * sabe", y las cuentas del mes lo tratan como lo que es, un dato que falta.
   */
  // El tipo va escrito a mano por lo mismo que en `paidAmount`: de `number | null` la
  // metadata de TypeScript no puede deducir que es un número y el ORM arma la columna como
  // varchar. Guardada así, la plata se suma concatenando y las comparaciones ordenan
  // alfabéticamente, con lo cual 900 es mayor que 10000.
  @Property({ nullable: true, type: "integer" })
  value?: number | null;

  // pending -> accepted -> assisted. Al cancelar se guarda un ISO timestamp,
  // para que el unique index de arriba permita volver a sacar turno en el mismo horario.
  @Property({ default: "pending" })
  state: string = "pending";

  // Observaciones clínicas que carga el profesional (antes vivían en Diagnostic)
  @Property({ nullable: true, type: "text" })
  observations?: string | null;

  /**
   * Si el turno se cobró, y cómo.
   *
   * Nullable y sin valor por defecto a propósito. Los turnos anteriores a esta columna no
   * tienen cómo saber si se pagaron: darlos por impagos llenaría la lista de deuda con
   * toda la historia del consultorio, y darlos por pagados sería inventar. Null quiere
   * decir "no se registró" y no cuenta como deuda en ningún lado.
   *
   * Los turnos nuevos nacen en "unpaid": ahí sí se sabe que todavía no se cobró.
   */
  @Property({ nullable: true })
  paymentState?: "unpaid" | "partial" | "paid" | null;

  /**
   * Cuánto se cobró, solo cuando el pago fue parcial.
   *
   * En "paid" no hace falta (es el valor del turno) y en "unpaid" no significa nada, así
   * que en los dos casos se guarda en null y no queda un número viejo dando vueltas.
   */
  // El tipo va escrito a mano: de `number | null` la metadata de TypeScript no puede
  // deducir que es un número, y MikroORM creaba la columna como varchar. Guardado como
  // texto, sumar montos concatena en vez de sumar ("4500" + 2000 = "45002000").
  @Property({ nullable: true, type: "integer" })
  paidAmount?: number | null;

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

  // Quién dio de alta el turno: el paciente desde la app, el profesional a mano, o una
  // importación de un calendario externo. Es nullable porque los turnos anteriores a esta
  // columna no se pueden clasificar con certeza: en analytics se cuentan aparte, como
  // "sin dato".
  //
  // "import" además marca: un turno importado se cargó tal como estaba en el calendario
  // de origen, así que puede no encajar en la grilla de horarios ni tener paciente.
  @Property({ nullable: true })
  origin?: "patient" | "professional" | "import" | null;

  // Si salió de un turno repetible, apunta a la configuración que lo generó (o que se
  // creó a partir de él). Cancelar o editar el turno no toca la configuración, y
  // apagar la configuración no toca los turnos ya creados.
  @ManyToOne(() => Recurrence, { nullable: true })
  recurrence?: Rel<Recurrence> | null;

  // Cuándo se dio de alta el turno, que no es lo mismo que para cuándo es. Sirve para
  // mirar el ritmo con el que alguien saca turnos: diez turnos en un día es una cosa si
  // se pidieron a lo largo de la tarde y otra si salieron todos en el mismo minuto.
  //
  // Nullable porque los turnos anteriores a esta columna no tienen cómo saberlo. Los
  // controles de abuso solo miran lo que tiene fecha, así que el pasado no dispara nada.
  @Property({ nullable: true, type: "datetime", onCreate: () => new Date() })
  createdAt?: Date | null;
}
