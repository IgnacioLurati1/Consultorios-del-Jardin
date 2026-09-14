import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * El valor a mano de la parte de un horario que cae fuera de los bloques.
 *
 * De 13 a 14 no hay bloque, así que no hay precio: lo pone el administrador, por cada vez
 * que se usa, igual que un bloque. Se identifica con el horario (día y hora de inicio del
 * profesional), que es la clave de la agenda.
 *
 * Va en su propia tabla y no en la agenda para no mezclar la plata con los horarios. Si el
 * horario se borra, esta fila queda sin nada que cobrar y el cálculo la ignora.
 */
@Entity()
@Unique({ properties: ["professional", "day", "initialHour"] })
export class RentExtra {
  @PrimaryKey()
  idRentExtra?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  @Property({ type: "string", length: 12 })
  day!: string;

  @Property({ type: "string", length: 5 })
  initialHour!: string;

  @Property({ type: "integer" })
  price!: number;
}
