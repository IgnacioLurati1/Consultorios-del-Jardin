import { Entity, Index, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * La cuota de un profesional en un mes, con lo que pagó.
 *
 * Se guarda el monto ya calculado, no la regla: la agenda y los precios cambian, y la
 * cuota de un mes que ya pasó tiene que seguir diciendo lo que se cobró ese mes. Por eso
 * se crea al empezar el mes y a partir de ahí solo la cambia alguien a propósito.
 *
 * El estado (pagó, parcial, no pagó) no se guarda: sale de comparar lo pagado con la
 * cuota. Así, si la cuota sube después de haberla pagado, la diferencia aparece sola como
 * saldo pendiente en vez de quedar tapada por un "pagado" escrito antes.
 */
@Entity()
@Unique({ properties: ["professional", "month"] })
@Index({ properties: ["month"] })
export class RentCharge {
  @PrimaryKey()
  idRentCharge?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  /** "2026-09". */
  @Property({ type: "string", length: 7 })
  month!: string;

  @Property({ type: "integer" })
  amount!: number;

  /** De dónde salió el monto: escrito a mano o calculado con los bloques. */
  @Property({ type: "string", length: 10 })
  kind!: "fixed" | "blocks";

  /** Cuántas veces usa un bloque en el mes. Solo en las calculadas. */
  @Property({ type: "integer", nullable: true })
  blocks?: number | null;

  /** El detalle del cálculo, como JSON: qué bloques, cuántas veces y a qué precio. */
  @Property({ type: "text", nullable: true })
  breakdown?: string | null;

  @Property({ type: "integer", default: 0 })
  paidAmount: number = 0;

  /** "AAAA-MM-DD". Texto y no fecha: se compara con el vencimiento sin pasar por husos. */
  @Property({ type: "string", length: 10, nullable: true })
  paidOn?: string | null;

  @Property({ type: "datetime", onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt!: Date;
}
