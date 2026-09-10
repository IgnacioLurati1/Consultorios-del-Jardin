import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Cuántas veces se anotó una persona a una lista de espera en un mes.
 *
 * Es un contador y no una cuenta sobre las filas de la lista porque esas filas se borran:
 * al tercer aviso, a las dos semanas o al darse de baja. Contando las que quedan, alguien
 * que se anota y se borra cinco veces por día no sumaría nunca. El tope es de anotarse,
 * no de estar anotado, así que borrarse no devuelve el lugar.
 *
 * Mismo molde que el de los rechazos: una fila por persona y por mes.
 */
@Entity()
@Unique({ properties: ["person", "month"] })
export class WaitlistUsage {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  person!: Rel<Person>;

  /** Clave de mes, "2026-09". */
  @Property()
  month!: string;

  @Property({ type: "integer", default: 0 })
  created: number = 0;
}
