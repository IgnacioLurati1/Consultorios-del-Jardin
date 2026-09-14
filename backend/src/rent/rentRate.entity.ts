import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Cómo se calcula la cuota de un profesional, desde un mes en adelante.
 *
 * Hay dos formas:
 *
 * - "fixed": un monto que escribió el administrador. Se mantiene igual mes a mes hasta que
 *   alguien lo cambie o le aplique un aumento.
 * - "blocks": sale de su agenda y de los precios de los bloques de cada consultorio, así
 *   que cambia con el mes (cinco lunes son cinco mañanas). `adjust` es un aumento propio
 *   de este profesional por encima de esos precios, para cuando se lo sube a él solo.
 *
 * Igual que los precios de los bloques, es historia: la regla de un mes es la fila más
 * nueva que ya haya empezado a regir.
 */
@Entity()
@Unique({ properties: ["professional", "fromMonth"] })
export class RentRate {
  @PrimaryKey()
  idRentRate?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  @Property({ type: "string", length: 7 })
  fromMonth!: string;

  @Property({ type: "string", length: 10 })
  kind!: "fixed" | "blocks";

  /** La cuota, cuando es fija. */
  @Property({ type: "integer", nullable: true })
  amount?: number | null;

  /** En centésimos de punto: 1000 es un 10% más. Solo en "blocks". */
  @Property({ type: "integer", default: 0 })
  adjust: number = 0;

  @Property({ type: "datetime", onCreate: () => new Date() })
  createdAt!: Date;
}
