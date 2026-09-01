import { Entity, Property, PrimaryKey } from "@mikro-orm/core";

/**
 * Una consulta al asistente, con lo que costó.
 *
 * Se guarda una fila por mensaje de la persona, no por llamada al modelo: un solo
 * "sacame turno con nutrición" puede dar tres vueltas contra el modelo, y lo que
 * interesa saber es cuánto sale una consulta, no cuánto sale una vuelta.
 *
 * No se guarda el texto de la conversación. Para medir gasto y uso alcanzan los
 * números, y lo que no se guarda no se filtra.
 */
@Entity()
export class AssistantUsage {
  @PrimaryKey()
  id?: number;

  @Property()
  createdAt: Date = new Date();

  @Property()
  email!: string;

  @Property()
  role!: string;

  @Property({ default: 0 })
  promptTokens: number = 0;

  @Property({ default: 0 })
  completionTokens: number = 0;

  @Property({ default: 0 })
  totalTokens: number = 0;

  /** Cuántas veces hubo que ir al modelo para contestar este mensaje. */
  @Property({ default: 1 })
  calls: number = 1;

  /** Qué herramientas se usaron, como lista JSON. Se cuentan después, en memoria. */
  @Property({ type: "text", nullable: true })
  tools?: string | null;
}
