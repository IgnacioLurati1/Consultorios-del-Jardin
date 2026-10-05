import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * Una foto de la portada que subió el consultorio.
 *
 * Vive en la base de cada instalación y no en un disco ni en un servicio aparte. El disco
 * de la plataforma se borra en cada despliegue, así que una foto guardada ahí desaparece
 * sola; y un servicio de archivos es una cuenta más por cliente para configurar. En la base
 * viaja con el respaldo, y para las veinte fotos que puede tener una portada no pesa.
 *
 * Se guardan dos tamaños y una vista previa. Ninguno es el archivo que se subió: el servidor
 * lo vuelve a codificar (ver images.service), y eso le saca los datos de la cámara y de la
 * ubicación, y deja sin efecto un archivo armado para hacer daño.
 */
@Entity()
export class SiteImage {
  /** Al azar y no correlativo: va en la dirección pública de la foto. */
  @PrimaryKey({ length: 24 })
  id!: string;

  /** Dónde va: `hero` es la portada, `gallery` la galería. */
  @Property({ length: 20 })
  slot!: string;

  /** El orden adentro de su lugar, de menor a mayor. */
  @Property({ type: "integer" })
  position!: number;

  /** Lo que lee un lector de pantalla. Vacío si es decorativa. */
  @Property({ length: 200, default: "" })
  alt: string = "";

  @Property({ type: "integer" })
  width!: number;

  @Property({ type: "integer" })
  height!: number;

  /**
   * La grande, de hasta 1600 px de ancho, en WebP.
   *
   * Las dos van en mediumblob y no en blob: el blob de MySQL aguanta 64 KB, y una foto
   * pesa varios cientos. Y son lazy: un listado de fotos no tiene por qué traer los bytes.
   */
  @Property({ type: "blob", columnType: "mediumblob", lazy: true })
  large!: Buffer;

  /** La chica, de hasta 640 px de ancho, para el celular y la grilla del panel. */
  @Property({ type: "blob", columnType: "mediumblob", lazy: true })
  small!: Buffer;

  /**
   * Una versión de 24 px, como texto, para mostrar algo borroso mientras llega la de verdad.
   * Es lo mismo que hace la portada con sus fotos de siempre (ver photoPreviews en la web).
   */
  @Property({ type: "text" })
  preview!: string;

  /**
   * Subida y todavía sin guardar. No sale en la página ni en la lista de la configuración:
   * se publica cuando se guarda la configuración que la usa, y si nadie guarda, se borra
   * sola a las pocas horas (ver images.service). Las de antes de que esto existiera
   * nacen publicadas.
   */
  @Property({ default: false })
  pending: boolean = false;

  @Property()
  createdAt: Date = new Date();
}
