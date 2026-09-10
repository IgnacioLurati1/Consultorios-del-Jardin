import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/** Un aviso que ya salió: qué horario se liberó y cuándo se le avisó. */
export interface WaitlistNotice {
  /** "AAAA-MM-DD" del turno que se liberó. */
  date: string;
  /** "HH:MM". */
  initialHour: string;
  at: string;
}

/**
 * Una persona esperando que se libere un horario con un profesional.
 *
 * Dice qué días de la semana y en qué franja le sirve, y nada más: no reserva nada ni
 * ocupa lugar. Lo único que hace es que, si alguien da de baja un turno que cae ahí con
 * tiempo, le llegue el aviso junto con los demás que esperan lo mismo.
 *
 * Vive poco a propósito. Se borra a las dos semanas, al tercer aviso o cuando la persona
 * consigue turno con ese profesional en lo que había pedido, lo que pase primero: una
 * lista que no se vacía sola se llena de gente que ya no está buscando nada.
 */
@Entity()
// Una por persona y profesional. Volver al botón es mirar la que ya tiene, no sumar otra.
@Unique({ properties: ["patient", "professional"] })
export class WaitlistEntry {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  patient!: Rel<Person>;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  professional!: Rel<Person>;

  /**
   * Los días de la semana que le sirven, con el número de `getDay()` y separados por coma:
   * "1,3" es lunes y miércoles. Nunca se filtra por esto en la base, se lee junto con la
   * fila, así que una columna de texto alcanza.
   */
  @Property({ length: 20 })
  days!: string;

  /** Desde qué hora le sirve, "HH:MM". Texto y no `time` para compararlo como texto, igual que las horas de los turnos. */
  @Property({ length: 5 })
  fromHour!: string;

  /** Hasta qué hora, "HH:MM". El turno tiene que terminar antes o justo a esta hora. */
  @Property({ length: 5 })
  toHour!: string;

  @Property({ type: "datetime" })
  createdAt!: Date;

  /** Cuándo se borra sola: dos semanas después de anotarse. */
  @Property({ type: "datetime" })
  expiresAt!: Date;

  // El tipo va escrito a mano: sin eso la metadata no alcanza para saber que es un número
  // y la columna sale como texto (ver mikroorm-columnas-numericas).
  @Property({ type: "integer", default: 0 })
  noticesSent: number = 0;

  /** Lo que ya se le avisó, para que lo pueda ver al volver al botón. */
  @Property({ type: "json", nullable: true })
  notices?: WaitlistNotice[] | null;
}
