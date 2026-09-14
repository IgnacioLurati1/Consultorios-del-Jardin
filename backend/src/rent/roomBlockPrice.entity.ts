import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Room } from "../rooms/rooms.entity.js";

/**
 * Cuánto sale un bloque de un consultorio, desde un mes en adelante.
 *
 * Se guarda como historia y no pisando un único precio: un aumento que rige desde el mes
 * que viene no puede cambiar lo que se está cobrando este mes. El precio de un mes es el
 * de la fila más nueva que ya haya empezado a regir.
 */
@Entity()
@Unique({ properties: ["room", "block", "fromMonth"] })
export class RoomBlockPrice {
  @PrimaryKey()
  idRoomBlockPrice?: number;

  @ManyToOne(() => Room, { nullable: false })
  room!: Rel<Room>;

  /** "morning" o "afternoon". Ver BLOCKS en rent.rules.ts. */
  @Property({ type: "string", length: 12 })
  block!: string;

  /** "2026-09": desde qué mes rige. */
  @Property({ type: "string", length: 7 })
  fromMonth!: string;

  /** Por cada vez que se usa el bloque. En null, desde ese mes el bloque no tiene precio. */
  @Property({ type: "integer", nullable: true })
  price?: number | null;

  @Property({ type: "datetime", onCreate: () => new Date() })
  createdAt!: Date;
}
