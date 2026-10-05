import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

/**
 * La configuración de esta instalación. Es una sola fila, la número 1.
 *
 * El mismo código corre en más de un consultorio. Lo que cambia entre uno y otro estaba
 * escrito en el código: el nombre, la dirección, el horizonte de reserva, cuánto antes sale
 * el recordatorio. Acá es donde pasa a vivir, y el molde es el de `RentSettings`: una tabla
 * de una fila, creada la primera vez que alguien la pide.
 *
 * **Los valores por omisión son exactamente los que el código tiene hoy.** Es a propósito:
 * mover un número del código a la base no tiene que cambiar nada de lo que ve nadie. Si
 * después de esto en Consultorios del Jardín algo se comporta distinto, es un error, no una
 * mejora. Las decisiones nuevas —prender el realineado, poner un colchón— se toman después
 * y de a una.
 *
 * Qué no está acá: las claves, los limitadores, la zona horaria y los orígenes permitidos.
 * Eso sigue en variables de entorno porque lo configuro yo y no el consultorio, y porque un
 * limitador que se puede bajar desde una pantalla es un limitador que alguien va a bajar.
 */
@Entity()
export class Installation {
  @PrimaryKey({ autoincrement: false })
  id!: number;

  /* ============================================================
     Identidad
     ============================================================ */

  /** Cómo se llama el consultorio. Sale en los mails, en el asistente y en la web. */
  @Property({ length: 120, default: "Consultorios del Jardín" })
  name: string = "Consultorios del Jardín";

  /** Qué atiende, en una línea. Es la bajada de la portada y el encabezado del prompt. */
  @Property({ length: 200, default: "Consultorios en Rosario, con turnos online y elección de profesional y horario." })
  tagline: string = "Consultorios en Rosario, con turnos online y elección de profesional y horario.";

  /** La calle y el número, tal como se escriben en un mail. Sin la ciudad: va aparte. */
  @Property({ length: 160, default: "9 de Julio 3672" })
  address: string = "9 de Julio 3672";

  /**
   * La ciudad.
   *
   * Separada de la dirección porque no se usan igual: el recordatorio dice "en 9 de Julio
   * 3672", que es lo que necesita quien ya sabe en qué ciudad está, y la portada y los
   * buscadores dicen "9 de Julio 3672, Rosario".
   */
  @Property({ length: 80, default: "Rosario" })
  city: string = "Rosario";

  /**
   * El horario que se publica.
   *
   * No es el horario con el que trabaja el sistema: ese sale de cada sucursal
   * (`offices.entity`) y hoy va de 08:00 a 21:00. Este es el que se le cuenta a la gente, y
   * los dos venían diciendo cosas distintas sin que nada los comparara.
   */
  @Property({ length: 120, default: "Lunes a viernes, de 9 a 20" })
  publicHours: string = "Lunes a viernes, de 9 a 20";

  /**
   * Lo que se atiende, separado por comas, en el orden en que se muestra.
   *
   * Estaba escrito tres veces —la web, la aplicación del celular y el asistente— y una
   * cuarta en la cabecera de los mails, en otro orden. Queda el orden de la web, que es el
   * de la pantalla de reservas.
   */
  @Property({ length: 400, default: "Psicología, Psicopedagogía, Psiquiatría, Nutrición, Fonoaudiología" })
  services: string = "Psicología, Psicopedagogía, Psiquiatría, Nutrición, Fonoaudiología";

  /**
   * La casilla que se publica en la web y que da el asistente.
   *
   * No es la que manda los mails (`MAIL`, que tiene que estar verificada en el proveedor)
   * ni la que recibe el formulario de contacto (`CONTACT_MAIL`): es la que el consultorio
   * quiere que la gente vea. Hoy las tres son la misma, y eso puede cambiar.
   */
  @Property({ length: 160, default: "consultoriosjardinok@gmail.com" })
  email: string = "consultoriosjardinok@gmail.com";

  /**
   * El mapa de la portada, como lo da Google Maps al tocar "Compartir" y "Insertar un mapa".
   *
   * Vacío, la portada arma uno buscando la dirección, que sirve para empezar pero ubica por
   * texto: el que pega el consultorio marca su puerta exacta.
   *
   * Varchar y no text: MikroORM lleva el valor de abajo a la tabla como valor por omisión,
   * y MySQL no acepta uno en una columna text ("can't have a default value"), así que la
   * migración fallaba al crear la tabla. 2000 es el mismo tope que controla el servicio.
   */
  @Property({ type: "string", length: 2000, nullable: true })
  mapEmbedUrl: string | null = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.1345729661225!2d-60.677700222686624!3d-32.947456271932246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b7aca0aae14deb%3A0x8faaf2cd4420949f!2s9%20de%20Julio%203672%2C%20S2000%20Rosario%2C%20Santa%20Fe!5e0!3m2!1ses!2sar!4v1789172471192!5m2!1ses!2sar";

  /** El link de "Cómo llegar". Vacío, se arma con la dirección. */
  @Property({ length: 400, nullable: true })
  directionsUrl: string | null = "https://www.google.com/maps/dir/?api=1&destination=9+de+Julio+3672,+Rosario,+Santa+Fe";

  /**
   * Si se ofrece el recorrido en 3D del espacio.
   *
   * Es de este consultorio y de ningún otro: el hall, los pasillos y el jardín están
   * modelados a mano y no se arman desde datos. Otra instalación lo deja apagado. Lo
   * prendo yo, no el consultorio, así que no se edita desde el panel.
   */
  @Property({ default: true })
  spaceTour: boolean = true;

  /** El usuario de Instagram, sin arroba. Vacío lo saca de la web y de los mails. */
  @Property({ length: 80, default: "consultorios_jardin" })
  instagram: string = "consultorios_jardin";

  /** El teléfono que se publica, como se escribe. Vacío no se muestra en ningún lado. */
  @Property({ length: 40, default: "" })
  phone: string = "";

  /** El número de WhatsApp, con el código de país. Vacío no se muestra en ningún lado. */
  @Property({ length: 40, default: "" })
  whatsapp: string = "";

  /** El consejo del recordatorio, impersonal como el resto de los textos. Vacío no sale ninguno. */
  @Property({ length: 160, default: "Se recomienda llegar cinco minutos antes" })
  visitAdvice: string = "Se recomienda llegar cinco minutos antes";

  /* ============================================================
     Marca y portada
     ============================================================ */

  /**
   * El tono de la marca, de 0 a 360.
   *
   * `null` es lo de siempre: el color cambia con la estación del año (ver SeasonContext en
   * la web). Con un número, el color queda fijo en ese tono y la estación deja de mandar,
   * que es lo que quiere un consultorio cuya marca tiene un color propio.
   */
  @Property({ type: "integer", nullable: true })
  brandHue: number | null = null;

  /** La saturación de ese tono, de 0 a 100. Sin tono, no se usa. */
  @Property({ type: "integer", nullable: true })
  brandSaturation: number | null = null;

  /**
   * El estilo de los paneles: tipografía, redondeo, sombras y cuánto color llevan los
   * grises. El color en sí es otra cosa (`brandHue` o la estación) y se combina con
   * cualquiera de estos. `jardin` es el de siempre.
   */
  @Property({ length: 20, default: "jardin" })
  panelSkin: string = "jardin";

  /**
   * El diseño de la portada: `jardin` (la de siempre), `clasico` o `minimal`. Cada uno es
   * una variante de la hoja de la portada en la web; elegirlo en el panel propone además un
   * estilo de portada y un orden de bloques, que después se pueden cambiar.
   */
  @Property({ length: 20, default: "jardin" })
  homeTemplate: string = "jardin";

  /**
   * Cómo es la portada.
   *
   * `collage` es la de siempre, con las cinco fotos y el nombre con las hojas del logo
   * haciendo de tilde. Ese título está armado a mano para este nombre, así que un
   * consultorio con otro nombre usa `text` (el nombre en letras, sin dibujo) o `photo` (una
   * foto de fondo con el nombre encima).
   */
  @Property({ length: 20, default: "collage" })
  heroStyle: string = "collage";

  /**
   * Los bloques de la portada para quien no inició sesión, en orden y separados por coma.
   * Un bloque que no está, no se muestra. Es el orden que tenía la portada.
   */
  @Property({ length: 200, default: "garland,hero,services,gallery,yourSpace,location,footer" })
  homeBlocksGuest: string = "garland,hero,services,gallery,yourSpace,location,footer";

  /** Lo mismo para quien ya inició sesión, que ve primero sus accesos. */
  @Property({ length: 200, default: "garland,hero,yourSpace,gallery,services,location,footer" })
  homeBlocksMember: string = "garland,hero,yourSpace,gallery,services,location,footer";

  /**
   * El diseño elegido para cada sección de la portada, en JSON, por sección. La que no
   * está usa la del diseño general (`homeTemplate`); nula es el diseño general entero.
   */
  @Property({ type: "text", nullable: true })
  homeVariants: string | null = null;

  /** Los colores propios de la barra, el pie y los mails, en JSON. Nula es seguir a la marca. Ver shared/elementColors. */
  @Property({ type: "text", nullable: true })
  elementColors: string | null = null;

  /**
   * Las palabras del rubro: turno, profesional, paciente, lugar, sala y especialidad, cada
   * una con su plural y su género. Guardado como JSON; vacío son las de siempre. Ver
   * shared/vocabulary.
   */
  @Property({ type: "text", nullable: true })
  vocabulary: string | null = null;

  /* ============================================================
     Asistente
     ============================================================ */

  /**
   * Cómo le habla el asistente a la gente: `voseo`, `tuteo` o `usted`.
   *
   * Por omisión de vos, como habla todo el sistema. Lo que no cambia es el registro de los
   * textos de la web, que es impersonal en los tres casos.
   */
  @Property({ length: 10, default: "voseo" })
  assistantTone: string = "voseo";

  /**
   * Lo que el asistente puede contar además de lo que sale de la base: obras sociales, si
   * hay estacionamiento, cómo se paga.
   *
   * Lo escribe el consultorio, y por eso entra en el prompt como dato y no como
   * instrucción. Las reglas que protegen algo —pedir confirmación antes de tocar un turno,
   * no mostrar datos de otros— no dependen del prompt sino del servidor, así que nada de lo
   * que se escriba acá las apaga.
   */
  @Property({ type: "text", nullable: true })
  assistantNotes: string | null = null;

  /* ============================================================
     Reglas de turnos
     ============================================================ */

  /**
   * Cuántas semanas después de la actual se pueden reservar. Uno es "esta y la que viene".
   *
   * Es en semanas y no en días porque es lo que la gente ve: la pantalla de reservas
   * muestra semanas enteras. Antes había cuatro números para la misma idea —doce días
   * hábiles en el motor, "esta semana y la que viene" en la pantalla y en la lista de
   * espera, veintiocho días en las repeticiones— y ninguno miraba a los otros. El motor
   * calculaba de más y la pantalla recortaba; la reserva no controlaba nada, así que por
   * la aplicación del celular o por el asistente se podía sacar un turno que la web no
   * mostraba.
   */
  @Property({ type: "integer", default: 1 })
  bookingWeeksAhead: number = 1;

  /**
   * Cada cuántos minutos arranca un turno en la grilla.
   *
   * `null` significa "lo que dure el módulo", que es lo único que el sistema sabía hacer:
   * la duración era a la vez la duración del turno y el paso de la grilla. Con un número
   * acá se separan, y aparecen los turnos de cuarenta y cinco minutos cada media hora.
   */
  @Property({ type: "integer", nullable: true })
  slotStepMinutes: number | null = null;

  /** Minutos libres entre un turno y el siguiente. En cero los turnos se tocan, como hoy. */
  @Property({ type: "integer", default: 0 })
  bufferMinutes: number = 0;

  /**
   * Si la grilla se reacomoda a la hora en que abre el consultorio.
   *
   * Apagado, el motor arranca en el inicio del módulo del profesional y descarta uno por
   * uno los horarios que caen antes de que abra, sin reacomodarse. Un módulo de 14 a 20 con
   * turnos de 45 minutos en un consultorio que abre a las 15 ofrece 15:30 como primer
   * horario, y eso es lo que vinieron a reclamar los profesionales.
   *
   * Queda apagado por omisión porque esta tabla no cambia comportamiento. Prenderlo es el
   * arreglo, y es una decisión aparte.
   */
  @Property({ default: false })
  realignToOpening: boolean = false;

  /** Cuánto antes, como mínimo, se puede reservar. En cero se puede reservar para ahora mismo. */
  @Property({ type: "integer", default: 0 })
  minNoticeMinutes: number = 0;

  /** Debajo de cuántas horas una baja cuenta como "sobre la hora". */
  @Property({ type: "integer", default: 24 })
  shortNoticeHours: number = 24;

  /** Si se atiende domingo. Hoy el domingo no se recorre nunca. */
  @Property({ default: false })
  opensSunday: boolean = false;

  /**
   * Cuántas horas antes del turno sale el recordatorio.
   *
   * `null` es "la víspera", que es lo que el sistema hacía: todos los turnos de mañana, sin
   * importar la hora. No es lo mismo que veinticuatro horas —a un turno de mañana a las
   * ocho de la noche la víspera le escribe desde la medianoche, cuarenta y cuatro horas
   * antes—, así que no se puede expresar con un número y queda como su propio valor.
   */
  @Property({ type: "integer", nullable: true })
  reminderHoursBefore: number | null = null;

  /** Si una ausencia se cobra igual. Hoy un turno marcado "no vino" no genera deuda. */
  @Property({ default: false })
  chargesMissed: boolean = false;

  /** Tope de turnos activos por paciente. Cero es sin tope, que es lo que hay hoy. */
  @Property({ type: "integer", default: 0 })
  maxActiveAppointments: number = 0;

  /** Si la lista de espera está disponible en este consultorio. */
  @Property({ default: true })
  waitlistEnabled: boolean = true;

  /**
   * Las reglas de funcionamiento (ver shared/policies), en JSON.
   *
   * Van juntas en una columna y no cada una en la suya porque son muchas y van a seguir
   * apareciendo, y ninguna se busca por su valor. Nula es "todas como siempre". Sin valor
   * inicial a propósito: una columna text no puede tener default en MySQL.
   */
  @Property({ type: "text", nullable: true })
  policies: string | null = null;

  /** Las reglas que el dueño del sistema bloqueó para que el consultorio no las cambie, en JSON. */
  @Property({ type: "text", nullable: true })
  lockedRules: string | null = null;

  /**
   * Cómo se ve cada especialidad en la portada: el ícono elegido y la foto subida, por
   * nombre, en JSON. Nula es "cada una con el ícono que sugiere su nombre".
   */
  @Property({ type: "text", nullable: true })
  specialityStyles: string | null = null;

  /** Las preguntas frecuentes de la web, en JSON. Nula es la lista de siempre. Ver shared/faq. */
  @Property({ type: "text", nullable: true })
  faq: string | null = null;

  /** Los motivos del formulario de contacto, en JSON. Nula es la lista de siempre. Ver shared/contactReasons. */
  @Property({ type: "text", nullable: true })
  contactReasons: string | null = null;

  /** Cuándo se cambió algo por última vez. Para saber si una pantalla está mirando algo viejo. */
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
