import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Cuánta gente estuvo esperando a un profesional, noche por noche, sumado por mes.
 *
 * La lista de espera se vacía sola, así que mirándola hoy no hay forma de saber cuánta
 * gente esperó el mes pasado. Por eso se anota una foto cada noche: `total` es la suma de
 * las fotos y `days` cuántas se sacaron, y el promedio del mes es la división.
 *
 * `lastDay` es lo que deja correr la foto sin cuidado. El servidor se reinicia con cada
 * deploy, y si la foto de un día se sacara dos veces el promedio saldría inflado sin que
 * nadie se diera cuenta.
 */
@Entity()
@Unique({ properties: ["professional", "month"] })
export class WaitlistStat {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  professional!: Rel<Person>;

  /** Clave de mes, "2026-09". */
  @Property()
  month!: string;

  @Property({ type: "integer", default: 0 })
  days: number = 0;

  @Property({ type: "integer", default: 0 })
  total: number = 0;

  /** El último día anotado, "AAAA-MM-DD". */
  @Property({ length: 10, nullable: true })
  lastDay?: string | null;
}
