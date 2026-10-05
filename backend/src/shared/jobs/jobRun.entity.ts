import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * Una vuelta de una tarea programada, ya tomada por alguien.
 *
 * La fila es el candado. La clave primaria es el nombre de la tarea más la ventana de
 * tiempo, así que el segundo que intenta insertarla choca contra la clave única y se da
 * cuenta de que esa vuelta ya la está haciendo otro. Es atómico porque lo decide la base,
 * no el proceso: dos instancias que arrancan en el mismo minuto no pueden ganar las dos.
 *
 * Hacía falta porque las tareas corren adentro del proceso web. Con una sola instancia no
 * se notaba; con dos, cada recordatorio sale dos veces, cada turno se cierra dos veces y
 * las cuentas vencidas se borran dos veces. Y la plataforma puede levantar una segunda
 * instancia sola, mientras despliega la nueva versión y todavía no bajó la vieja.
 */
@Entity()
export class JobRun {
  /** `nombre:ventana`, por ejemplo `recordatorios:482913`. */
  @PrimaryKey({ length: 120 })
  key!: string;

  /** Cuándo se tomó. Sirve para limpiar las viejas y para mirar si una tarea dejó de correr. */
  @Property()
  startedAt: Date = new Date();

  /**
   * Quién la tomó.
   *
   * No identifica a la instancia de verdad —la plataforma no da un nombre estable—, es un
   * azar por proceso. Alcanza para lo único que se pregunta mirando esto: si las vueltas
   * se las está llevando siempre el mismo proceso o se reparten.
   */
  @Property({ length: 60 })
  instance!: string;
}
