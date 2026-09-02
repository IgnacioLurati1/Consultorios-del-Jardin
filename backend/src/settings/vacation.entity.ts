import { Entity, PrimaryKey, Property, ManyToOne, Rel } from "@mikro-orm/core";
import { Person } from "../people/people.entity.js";

/**
 * Un período en el que el profesional no atiende.
 *
 * Es una tabla y no dos columnas en `Person` porque las vacaciones se planifican con
 * anticipación: mientras corre una semana de licencia se puede dejar cargada la de
 * enero, y al volver de una hay que poder borrarla sin pisar la otra.
 *
 * No toca los turnos que ya estaban dados. Un paciente que sacó turno antes de que se
 * cargara la licencia sigue teniéndolo, y es el profesional el que decide si lo cancela
 * o lo reprograma: cancelar turnos de terceros en masa es algo que nadie espera de un
 * botón que dice "vacaciones".
 */
@Entity()
export class Vacation {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false })
  professional!: Rel<Person>;

  /** Primer día sin atender, inclusive. */
  @Property({ type: "date" })
  fromDate!: Date;

  /** Último día sin atender, inclusive: se vuelve al día siguiente. */
  @Property({ type: "date" })
  toDate!: Date;

  /** Opcional, para acordarse de qué era. El paciente nunca lo ve. */
  @Property({ nullable: true })
  reason?: string | null;
}
