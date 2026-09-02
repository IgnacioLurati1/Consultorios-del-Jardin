import { Entity, PrimaryKey, Property, ManyToOne, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Cuántos pedidos de turno rechazó un profesional en un mes.
 *
 * Es un contador y no una consulta sobre los turnos porque el turno ya no está: rechazar
 * un pedido pendiente lo borra de la base (a diferencia de cancelar uno confirmado, que
 * deja la fila con el timestamp en `state`). Guardar los rechazados solo para poder
 * contarlos sería arrastrar filas muertas por años; una fila por profesional y por mes
 * alcanza para la pregunta que se hace el admin.
 *
 * Por eso también se pierde el detalle: acá no hay de qué paciente era ni de qué día.
 * Es a propósito.
 */
@Entity()
@Unique({ properties: ["professional", "month"] })
export class Denial {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  /** Clave de mes, "2026-09". La misma que usan los gráficos de analytics. */
  @Property()
  month!: string;

  /** Pedidos que quedaron sin turno: los que rechazó a mano más los que venció el sistema. */
  @Property({ default: 0 })
  denied: number = 0;

  /** De los anteriores, los que se cayeron solos porque nunca los contestó. */
  @Property({ default: 0 })
  expired: number = 0;
}
