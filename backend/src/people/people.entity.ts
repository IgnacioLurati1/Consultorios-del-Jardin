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
  @Property({ nullable: true, unique: false })
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
}
