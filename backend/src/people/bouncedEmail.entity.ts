import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * Una dirección que no existe, según el correo mismo.
 *
 * Cuando un mail sale y el servidor del otro lado contesta que esa casilla no existe, el
 * proveedor lo anota como rebote duro y deja de escribirle. Eso es lo único que prueba de
 * verdad que una casilla no existe: preguntarlo antes de mandar nada no se puede.
 *
 * Vive en su propia tabla y no en una columna de la persona porque tiene que sobrevivirla.
 * El caso que hay que cortar es el de siempre: el mail se carga mal, rebota, se borra al
 * paciente y se lo vuelve a cargar con el mismo error. Con el dato acá, la segunda vez el
 * alta lo frena.
 */
@Entity()
export class BouncedEmail {
  @PrimaryKey()
  email!: string;

  @Property({ type: "datetime" })
  bouncedAt!: Date;

  /** Lo que contestó el servidor del otro lado, como viene. Es para mirarlo, no para leerlo en pantalla. */
  @Property({ type: "text", nullable: true })
  reason?: string | null;

  /**
   * Qué clase de rebote fue, según lo que contestó el otro servidor.
   *
   * `missing` es la casilla que no existe, y es la única que se puede afirmar: el servidor
   * lo dice con todas las letras ("does not exist", "user unknown"). `blocked` es todo lo
   * demás que no se pudo entregar —la casilla llena, la cuenta inactiva, el correo que
   * rechaza al remitente—, que tiene una consecuencia parecida, que a esa persona no le
   * llega nada, pero no significa que la dirección esté mal escrita.
   *
   * Meter las dos en la misma bolsa hacía que un correo perfecto figurara como inexistente.
   */
  @Property({ default: "missing" })
  kind: "missing" | "blocked" = "missing";

  /** Si ya se le avisó a quien lo cargó. Sin esto, cada vuelta del reloj avisaría de nuevo. */
  @Property({ default: false })
  notified: boolean = false;
}
