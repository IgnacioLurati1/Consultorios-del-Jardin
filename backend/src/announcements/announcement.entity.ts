import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * Un aviso que el admin cuelga para pacientes, para profesionales o para los dos.
 *
 * Es el reemplazo del cartel pegado en la recepción: "el jueves no hay luz", "cambió el
 * teléfono", "ya se puede pagar con transferencia". Vive en una tabla y no en una
 * constante del código porque lo escribe alguien que no programa, y porque tiene que
 * poder bajarse el día que deja de ser cierto.
 */
@Entity()
export class Announcement {
  @PrimaryKey()
  id?: number;

  @Property()
  title!: string;

  @Property({ type: "text" })
  body!: string;

  /**
   * Qué tan urgente es, que en pantalla es de qué color sale.
   *
   * Tres y no más: en cuanto hay cinco niveles nadie distingue el tercero del cuarto y
   * todo termina publicándose en rojo, que es la manera de que el rojo deje de
   * significar algo.
   */
  @Property()
  level!: "error" | "warning" | "news";

  @Property()
  audience!: "client" | "professional" | "both";

  /**
   * Por dónde llega. Un aviso en el panel lo ve quien entra; una notificación interrumpe
   * a la persona esté donde esté. Que sean cosas distintas es a propósito: no todo lo
   * que vale la pena contar vale la pena que suene el teléfono.
   */
  @Property({ default: "banner" })
  channel: "banner" | "notification" | "both" = "banner";

  // Bajar un aviso no lo borra: queda el registro de qué se comunicó y cuándo.
  @Property({ default: true })
  active: boolean = true;

  @Property({ type: "datetime", onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ nullable: true })
  createdBy?: string | null;
}
