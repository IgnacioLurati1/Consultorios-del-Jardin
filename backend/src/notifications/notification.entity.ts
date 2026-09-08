import { Entity, Index, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Un aviso de la campanita, guardado del lado del consultorio.
 *
 * Antes esto no existía y cada pantalla lo deducía sola: guardaba una foto de cómo
 * estaban las cosas y la próxima vez comparaba. Andaba, pero solo dentro del navegador
 * que ya tenía una foto guardada, y esa es la parte que en la práctica no se cumple casi
 * nunca. La primera vez no hay con qué comparar, así que no avisa nada; y una persona que
 * entra, mira y se va vuelve a ser la primera vez cada vez que entra desde otro equipo,
 * desde el teléfono, o después de que el navegador limpió sus datos. El resultado era el
 * que se vio probándolo: se sacaba un turno, se entraba a la cuenta y no había ningún
 * aviso, porque justo esa vuelta era la primera.
 *
 * Guardarlo acá lo arregla de raíz. El hecho se anota cuando pasa, del lado que sabe que
 * pasó, y queda esperando a que la persona entre por donde entre. Es la misma razón por
 * la que el mail se manda en ese momento y no cuando alguien abre la aplicación.
 */
@Entity()
// Lo que se pide siempre es "los últimos de esta persona", que es exactamente esto.
@Index({ properties: ["person", "createdAt"] })
/**
 * El mismo hecho no se anota dos veces.
 *
 * `eventKey` nombra al hecho, no a la fila: el turno 312 confirmado es `t312:confirmado`
 * y lo va a ser siempre. Sirve para dos cosas que pasan de verdad: un reintento que
 * repite la operación, y un aviso que la persona borró y que no tiene que volver a
 * aparecer por una segunda anotación del mismo hecho.
 */
@Unique({ properties: ["person", "eventKey"] })
export class Notification {
  @PrimaryKey()
  idNotification?: number;

  /** A quién le llega. Es el dueño del aviso y el único que lo puede ver o borrar. */
  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  person!: Rel<Person>;

  @Property()
  eventKey!: string;

  @Property()
  title!: string;

  @Property({ type: "text", nullable: true })
  body?: string | null;

  /** De qué color sale y cuánto grita. Los mismos cuatro que ya usaba la campanita. */
  @Property()
  tone!: "info" | "good" | "warn" | "urgent";

  /**
   * A dónde lleva tocarlo, dicho por lo que es y no por la dirección.
   *
   * La página y la aplicación tienen rutas distintas para la misma pantalla, así que una
   * dirección guardada acá andaría en una sola de las dos. Cada cliente traduce estos
   * nombres a lo suyo, y el que no conozca uno lo deja sin destino, que es lo que ya hace
   * con un aviso de algo que no está en ninguna pantalla.
   *
   * En null cuando no hay a dónde ir: un turno que se dio de baja no tiene ficha que
   * abrir, y llevar hasta una pantalla que va a decir que no existe es peor que no llevar.
   */
  @Property({ nullable: true })
  target?: "appointments" | "booking" | "security" | null;

  @Property({ type: "datetime", onCreate: () => new Date() })
  createdAt!: Date;

  /** Cuándo lo vio. En null es el que hace que la campanita tenga número. */
  @Property({ type: "datetime", nullable: true })
  readAt?: Date | null;

  /**
   * Cuándo lo borró. La fila queda, y por eso borrar es definitivo.
   *
   * Si se borrara de verdad, la clave del hecho quedaría libre y una segunda anotación
   * del mismo hecho —un reintento, un doble click sobre el botón de confirmar— lo
   * traería de vuelta a una pantalla de la que la persona ya lo sacó. Marcarlo cuesta una
   * columna y convierte eso en imposible. La limpieza de lo viejo se lo lleva igual.
   */
  @Property({ type: "datetime", nullable: true })
  dismissedAt?: Date | null;
}
