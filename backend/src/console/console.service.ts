import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { PeopleService } from "../people/people.service.js";
import { AUD_CONSOLE, signAccessToken, tokenIssuer } from "../config/tokens.js";
import { badRequest, conflict, forbidden } from "../shared/errors.js";
import { isOwner } from "./console.guard.js";

/**
 * Lo que la consola sabe hacer: entrar, listar los administradores de esta instalación y
 * crear uno.
 *
 * Es a propósito un módulo chico. Todo lo que no sea exactamente esto se hace desde el
 * panel del consultorio como siempre; acá entra solamente la operación que no puede vivir
 * ahí, porque desde ahí la haría el cliente.
 */

/** Cuánto vale la sesión de la consola. No hay renovación: se vuelve a entrar. */
const SESSION = "30m";

/** Tope de una lista de administradores. Si hay más, algo pasó. */
const MAX_ADMINS = 20;

/**
 * La contraseña inicial es un azar que no ve nadie, ni siquiera los logs.
 *
 * El administrador nuevo entra la primera vez por el mail de "elegí tu contraseña". Es
 * mejor que inventarle una y mandarla: una contraseña que viajó por un chat ya no es
 * secreta, y la que nadie conoce no se puede filtrar.
 */
function unguessablePassword(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export class ConsoleService {
  private people = new PeopleService();

  /**
   * Entrar a la consola.
   *
   * Las credenciales son las de la cuenta de siempre, pero el token que sale es otro: va
   * firmado con la clave de la consola y con su audiencia, así que no sirve para nada en
   * la aplicación, y el de la aplicación no sirve para nada acá.
   *
   * El mensaje de error es el mismo en los tres casos. Una cuenta que no es dueña no tiene
   * que poder distinguirse de una contraseña equivocada: si no, esto se convierte en una
   * forma cómoda de averiguar qué direcciones mando yo.
   */
  async login(email: string, password: string): Promise<{ token: string; email: string; issuer: string }> {
    const limpio = String(email ?? "").trim().toLowerCase();
    if (!limpio || !password) throw badRequest("Faltan los datos");

    const person = await orm.em.findOne(Person, { email: limpio });
    const hash = person?.password;

    // Se compara igual contra un hash de descarte cuando la cuenta no existe, para que el
    // tiempo de respuesta no diga si la dirección está cargada.
    const valid = hash
      ? await bcrypt.compare(password, hash)
      : await bcrypt.compare(password, "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva");

    if (!person || !valid || !isOwner(person.email) || person.active !== true || person.type !== "admin") {
      throw forbidden("No autorizado");
    }

    return {
      token: signAccessToken(person.email, person.type, AUD_CONSOLE, SESSION),
      email: person.email,
      issuer: tokenIssuer(),
    };
  }

  /** Los administradores que tiene hoy esta instalación. Sin contraseñas, obviamente. */
  async listAdmins() {
    const admins = await orm.em.find(Person, { type: "admin" }, { orderBy: { email: "ASC" }, limit: MAX_ADMINS });

    return admins.map((admin) => ({
      email: admin.email,
      name: admin.name,
      surname: admin.surname,
      active: admin.active,
      // Quién sigue con la contraseña provisoria, que es el dato que importa después de crear.
      passwordSetAt: admin.passwordSetAt ?? null,
      owner: isOwner(admin.email),
    }));
  }

  /**
   * Crea un administrador en esta instalación.
   *
   * `ownerPassword` es la contraseña de quien está usando la consola, y se vuelve a pedir
   * acá aunque el token ya sea válido. Un token robado de una pestaña abierta no alcanza
   * para quedarse con el consultorio; hace falta además saber la contraseña.
   *
   * No se recibe ninguna contraseña para el administrador nuevo: se le pone una al azar
   * que nadie ve y se le manda el mail para que elija la suya.
   */
  async createAdmin(
    ownerEmail: string,
    ownerPassword: string,
    data: { email?: string; name?: string; surname?: string }
  ): Promise<{ email: string; mailSent: boolean }> {
    const owner = await orm.em.findOne(Person, { email: ownerEmail });
    if (!owner?.password) throw forbidden("No autorizado");

    const confirmado = await bcrypt.compare(String(ownerPassword ?? ""), owner.password);
    if (!confirmado) throw forbidden("La contraseña no coincide");

    const email = String(data.email ?? "").trim().toLowerCase();
    const name = String(data.name ?? "").trim();
    const surname = String(data.surname ?? "").trim();

    if (!email) throw badRequest("Falta el correo");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest("El correo no parece válido");
    if (!name) throw badRequest("Falta el nombre");
    if (!surname) throw badRequest("Falta el apellido");

    const em = orm.em.fork();
    const existing = await em.findOne(Person, { email });

    if (existing) {
      // Una cuenta que ya existe no se convierte en administrador desde acá. Subir de rol a
      // un paciente o a un profesional es otra operación, con otras consecuencias —se
      // queda con su historia de turnos y con sus pacientes— y no es lo que esta pantalla
      // dice que hace.
      throw conflict("Ya hay una cuenta con ese correo");
    }

    const cuantos = await em.count(Person, { type: "admin" });
    if (cuantos >= MAX_ADMINS) throw conflict("Ya hay demasiados administradores");

    em.create(Person, {
      email,
      name,
      surname,
      // El administrador no atiende ni saca turno, así que estos campos no describen nada
      // suyo. Son NOT NULL en la tabla y van vacíos en vez de con datos inventados.
      docType: "DNI",
      docNumber: "",
      phoneNumber: "",
      password: await bcrypt.hash(unguessablePassword(), 10),
      speciality: null as any,
      type: "admin",
      active: true,
      bookable: false,
      waitlistEnabled: false,
      autoAccept: false,
      autoMarkWhen: "appointment" as const,
      autoPay: false,
      autoPayWhen: "appointment" as const,
      anonymous: false,
    });

    await em.flush();

    // Si el mail no sale, la cuenta igual quedó creada: se avisa y se puede reenviar desde
    // el panel del consultorio como con cualquier otra cuenta.
    const mailSent = await this.people.sendPasswordMail(email, { byAdmin: true });

    return { email, mailSent };
  }
}
