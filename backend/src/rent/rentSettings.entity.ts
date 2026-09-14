import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * La configuración del cobro de alquileres. Es una sola fila, la número 1.
 *
 * Una tabla para un número parece mucho, pero es el lugar donde van a caer las próximas
 * decisiones del mismo tipo, y guardarlo en una variable de entorno obligaría a
 * redesplegar para cambiar el día de vencimiento.
 */
@Entity()
export class RentSettings {
  @PrimaryKey({ autoincrement: false })
  id!: number;

  /** El día del mes en que vence la cuota de ese mismo mes. Pagar después es pagar tarde. */
  @Property({ type: "integer", default: 10 })
  dueDay: number = 10;
}
