import { Entity, PrimaryKey, Property } from "@mikro-orm/core";

@Entity()
export class Person {
  @PrimaryKey()
  email!: string;

  @Property({ nullable: false, unique: false })
  docType!: string;

  @Property({ nullable: false, unique: false })
  docNumber!: string;

  @Property({ nullable: false, unique: false })
  name!: string;

  @Property({ nullable: false, unique: false })
  surname!: string;

  @Property({ nullable: false, unique: false })
  phoneNumber!: string;

  // Nullable por los pacientes anónimos: los carga el profesional y no tienen cuenta.
  //
  // hidden saca el campo de todo lo que se serializa a JSON. Hasta acá cada endpoint se
  // acordaba de borrarlo a mano, y los que devuelven una persona adentro de otra cosa
  // (un turno trae al profesional y al paciente) se lo estaban llevando puesto: cualquier
  // usuario logueado veía el hash de los demás. Un hash de bcrypt no es una contraseña,
  // pero es material para romper offline y no tiene por qué salir del servidor.
  //
  // No afecta a leerlo desde el código: el login sigue haciendo bcrypt.compare contra
  // person.password como siempre.
  @Property({ nullable: true, unique: false, hidden: true })
  password?: string | null;

  @Property({ nullable: true, unique: false })
  speciality!: string;

  // Cómo se presenta el profesional: en qué trabaja, con qué enfoque, con quiénes.
  // Lo lee el paciente antes de elegir con quién sacar turno, así que es lo único de la
  // ficha que escribe la persona con sus palabras. Es opcional: sin esto la pantalla
  // muestra la especialidad y nada más, que es como venía funcionando.
  @Property({ nullable: true, type: "text" })
  about?: string | null;

  @Property({ nullable: false })
  type!: string;

  @Property({ nullable: false })
  active!: boolean;

  // Quién apagó el `active` de arriba. Un usuario deshabilitado a mano y uno que se
  // deshabilitó solo por cómo venía usando el sistema se ven igual en la base, y no son
  // lo mismo para quien tiene que decidir si lo vuelve a habilitar: el primero lo bajó
  // una persona que sabe por qué, el segundo lo bajó una regla.
  //
  // En null la cuenta está sana, o quedó deshabilitada de antes de que existiera esto.
  @Property({ nullable: true })
  bannedBy?: "admin" | "system" | null;

  @Property({ nullable: true, type: "datetime" })
  bannedAt?: Date | null;

  // Qué regla saltó, en las palabras que se le muestran al admin. Se guarda armado
  // porque describe lo que pasaba en ese momento: recalcularlo después da otra cosa.
  @Property({ nullable: true, type: "text" })
  banReason?: string | null;

  // De qué clase fue la baja automática. Las dos las decide una regla, pero no significan
  // lo mismo ni se resuelven igual: "abuse" es alguien usando mal su propia cuenta, y se
  // revisa cuando se pueda; "compromise" es una cuenta que se comportó como si la
  // estuviera manejando otro, y hasta que un administrador la mire hay que dar por
  // sentado que la contraseña está en manos ajenas.
  @Property({ nullable: true })
  banKind?: "abuse" | "compromise" | null;

  // Quién la volvió a habilitar después de una baja por posible intrusión, y cuándo.
  // Queda escrito porque es una decisión de seguridad que tomó una persona concreta.
  @Property({ nullable: true })
  clearedBy?: string | null;

  @Property({ nullable: true, type: "datetime" })
  clearedAt?: Date | null;

  // Si aparece entre las opciones cuando un paciente saca turno.
  //
  // Es distinto de `active`, que lo saca del sistema entero. Un profesional con la agenda
  // llena, de licencia corta, o que solo quiere seguir atendiendo a los pacientes que ya
  // tiene, deja de figurar en la búsqueda y sigue trabajando igual: entra, ve su agenda,
  // carga turnos a mano y cobra como siempre.
  //
  // Solo tiene sentido en un profesional. En el resto queda en true y no molesta a nadie.
  @Property({ default: true })
  bookable: boolean = true;

  // Confirmar solos los turnos que pide un paciente, en vez de dejarlos esperando.
  //
  // Un turno pedido nace en "pending" y no ocupa el horario hasta que el profesional lo
  // acepta. Para quien atiende por orden de llegada eso es un trámite de más: el horario
  // ya estaba publicado, y si está publicado es porque lo puede atender. Con esto el
  // turno nace aceptado y el paciente recibe la confirmación en el mismo momento.
  @Property({ default: false })
  autoAccept: boolean = false;

  // Cómo cerrar los turnos a los que ya se les pasó la hora y el profesional no cerró a
  // mano. En null la función está apagada, que es como venía funcionando: el turno queda
  // en "accepted" para siempre y no cuenta ni como que vino ni como que faltó.
  //
  // El valor es el estado que se les pone, porque cada consultorio tiene una realidad
  // distinta: donde casi todos vienen conviene "assisted" y corregir la excepción, y
  // donde faltan seguido conviene "missed".
  @Property({ nullable: true })
  autoMark?: "assisted" | "missed" | null;

  // Cuándo se aplica lo de arriba: apenas termina el turno, o recién al cerrar el día.
  // Al final del día da tiempo a cargar la asistencia real de un turno que se estiró o de
  // un paciente que llegó tarde; apenas termina deja la agenda al día sola.
  @Property({ default: "appointment" })
  autoMarkWhen: "appointment" | "day" = "appointment";

  // Desde cuándo vale el cierre automático: el momento en que se prendió el switch.
  //
  // Sin esto, prender la opción cierra de una toda la agenda vieja que quedó sin marcar,
  // que en un consultorio con un año de uso son cientos de turnos que nadie revisó
  // pasando a "vino" o "no vino" de un plumazo, y los números del año cambiando solos.
  // Una preferencia nueva no puede reescribir lo que ya pasó: se aplica de acá en más.
  @Property({ nullable: true, type: "datetime" })
  autoMarkSince?: Date | null;

  // Paciente "dummy" cargado por un profesional. No puede iniciar sesión.
  // Si alguien se registra con este mismo email, la cuenta se convierte en real
  // y conserva todo lo que el profesional ya le había cargado (el PK es el email).
  @Property({ default: false })
  anonymous: boolean = false;

  // Email del profesional que dio de alta a este paciente anónimo. Queda como rastro de
  // quién lo cargó (el admin lo ve en el listado de usuarios) y define quién puede
  // corregirle los datos mientras la persona siga sin cuenta propia.
  @Property({ nullable: true })
  createdBy?: string | null;

  // Desde dónde entró por última vez, un campo por canal.
  //
  // Se escriben al iniciar sesión y al renovar el token, que son los dos momentos en que
  // el cliente se identifica. Tener las dos fechas por separado es lo que deja contar
  // quién usa solo la app, quién solo la página y quién las dos: con un solo campo
  // "último canal" el que alterna se contaría siempre en uno solo.
  //
  // hidden: son de uso interno, para el panel de números. No tienen por qué viajar
  // pegadas a la persona cada vez que un endpoint devuelve una.
  // `type` explícito: sobre una propiedad opcional el decorador no puede leer que es una
  // fecha (el tipo en runtime queda en Object) y la columna sale varchar. Guardar una
  // fecha como texto compara mal en cuanto haya que preguntar "¿entró este mes?".
  @Property({ nullable: true, type: "datetime", hidden: true })
  lastWebAccess?: Date | null;

  @Property({ nullable: true, type: "datetime", hidden: true })
  lastAppAccess?: Date | null;
}
