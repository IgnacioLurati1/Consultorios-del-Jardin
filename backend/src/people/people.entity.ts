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

  @Property({ nullable: false })
  type!: string;

  @Property({ nullable: false })
  active!: boolean;

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
