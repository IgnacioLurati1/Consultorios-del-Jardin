import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * Un toque a un endpoint administrativo delicado.
 *
 * Se anota el intento y no el resultado: un paciente que sondea rutas de admin se come
 * un 403 en cada una, y son exactamente esos 403 los que dibujan el ataque. El estado de
 * la respuesta se completa después, cuando la request termina, porque para decidir si
 * hay que cortar no hace falta esperarla, y para revisar el caso al día siguiente sí
 * importa saber cuáles salieron bien.
 *
 * Vive en la base y no en memoria por tres razones: la ventana de madrugada dura seis
 * horas y un reinicio no puede borrarla, el admin que revisa el caso necesita ver qué se
 * tocó exactamente, y sin ese detalle no hay forma de decidir qué se puede deshacer.
 */
@Entity()
export class SensitiveHit {
  @PrimaryKey()
  id?: number;

  @Property()
  email!: string;

  /** El tipo que decía el token. Se guarda como venía, no como está hoy en la base. */
  @Property()
  role!: string;

  @Property()
  method!: string;

  @Property({ type: "text" })
  path!: string;

  /** Cómo se llama lo que se hizo, en castellano. Es lo que después lee una persona. */
  @Property()
  label!: string;

  /** Cuánto pesa en la cuenta: las que destruyen o exponen datos pesan más. */
  @Property()
  weight!: number;

  /**
   * Con qué respondió el servidor. Nulo mientras la request no terminó.
   *
   * El tipo va escrito a mano: de una propiedad opcional cuyo tipo es una unión
   * (`number | null`) el ORM no puede deducir nada, se queda con `Object` y termina
   * creando una columna de texto. Guardado como texto, un 403 se compara mal contra un
   * número y la pantalla que lo lee lo clasifica al revés.
   */
  @Property({ nullable: true, type: "integer" })
  status?: number | null;

  @Property({ type: "datetime", onCreate: () => new Date() })
  at!: Date;
}
