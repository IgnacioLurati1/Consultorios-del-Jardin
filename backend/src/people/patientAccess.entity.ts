import { Entity, ManyToOne, PrimaryKey, Property, Rel, Unique } from "@mikro-orm/core";
import { Person } from "./people.entity.js";

/**
 * Un profesional que también ve a un paciente sin cuenta que cargó otro.
 *
 * Un paciente sin cuenta lo ven quien lo cargó y la administración. Si un segundo
 * profesional intenta cargar el mismo email, no se puede crear otro, porque el email es la
 * clave. En vez de frenarlo con un error, se le avisa que ya estaba cargado y desde ahí lo
 * ve también. Esta fila es ese permiso.
 *
 * No le da permiso para corregir los datos: eso sigue siendo de quien lo cargó
 * (`createdBy`). Cuando la persona se registra deja de ser sin cuenta, la ve todo el
 * consultorio y esta fila ya no cambia nada.
 */
@Entity()
@Unique({ properties: ["patient", "professional"] })
export class PatientAccess {
  @PrimaryKey()
  id?: number;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  patient!: Rel<Person>;

  @ManyToOne(() => Person, { nullable: false, deleteRule: "cascade" })
  professional!: Rel<Person>;

  @Property({ type: "datetime", onCreate: () => new Date() })
  createdAt?: Date;
}
