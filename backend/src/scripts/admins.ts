import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";

export interface AdminSeed {
  email: string;
  name: string;
  surname: string;
}

/**
 * Los administradores con los que arranca una instalación.
 *
 * Estaban escritos acá, tres direcciones fijas, y este script corre en cada deploy. Con
 * una sola instalación eso era cómodo; con el mismo código corriendo en varios
 * consultorios, cada base nueva nacía con tres cuentas de administrador que no eran del
 * cliente y que podían entrar pidiendo un cambio de contraseña.
 *
 * Ahora salen de `INITIAL_ADMINS`, con el formato `correo|Nombre|Apellido`, separados por
 * coma. La idea es que acá vaya una sola cuenta —la mía, para poder abrir la consola la
 * primera vez— y que los administradores del cliente se creen después desde la consola.
 *
 * Sin la variable cargada no se crea nada. En producción además no arranca: una lista
 * vacía por una variable que faltó no puede significar "dejalo sin administradores" y
 * descubrirlo cuando nadie puede entrar.
 */
export function adminSeeds(): AdminSeed[] {
  const raw = (process.env.INITIAL_ADMINS ?? "").trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Falta INITIAL_ADMINS. Formato: correo|Nombre|Apellido, separados por coma. " +
          "Es la cuenta con la que se abre la consola la primera vez."
      );
    }
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [email, name, surname] = entry.split("|").map((part) => (part ?? "").trim());
      if (!email) throw new Error("Hay una entrada de INITIAL_ADMINS sin correo");
      // El nombre y el apellido son NOT NULL en la tabla. Si no vinieron, se pone algo
      // legible y neutro en vez de inventar un nombre de persona.
      return { email: email.toLowerCase(), name: name || "Administración", surname: surname || "" };
    });
}

/**
 * La contraseña inicial es un azar que no ve nadie, ni siquiera los logs.
 *
 * Cada admin entra la primera vez por "¿Olvidaste tu contraseña?" y elige la suya. Es
 * mejor que inventarle una y mandarla por algún lado: una contraseña que viajó por un
 * chat o quedó escrita en la salida de un script ya no es secreta, y la que nadie
 * conoce no se puede filtrar.
 */
function unguessablePassword(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Deja creados los administradores que falten, sin tocar los que ya están.
 *
 * Es repetible por diseño: corre en el bootstrap y en cada deploy, y correrlo dos veces
 * no pisa una contraseña ni cambia un tipo de cuenta. Lo único que hace es completar lo
 * que falta.
 */
export async function ensureAdmins(): Promise<number> {
  const em = orm.em.fork();
  const semillas = adminSeeds();
  let creados = 0;

  if (!semillas.length) {
    console.log("INITIAL_ADMINS está vacía: no se crea ningún administrador.");
    return 0;
  }

  for (const admin of semillas) {
    const existing = await em.findOne(Person, { email: admin.email });

    if (existing) {
      console.log(`· ${admin.email} ya existía (${existing.type}), no lo toco.`);
      continue;
    }

    em.create(Person, {
      email: admin.email,
      name: admin.name,
      surname: admin.surname,
      // El admin no atiende ni saca turno, así que estos campos no describen nada suyo.
      // Son NOT NULL en la tabla, y van vacíos en vez de con datos inventados: un
      // documento falso en el padrón es peor que un campo en blanco.
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

    creados++;
    console.log(`· ${admin.email} creado.`);
  }

  await em.flush();

  console.log(
    creados === 0 ? "\nNo hubo que crear ningún admin: ya estaban todos." : `\n${creados} admin(s) creados.`
  );

  if (creados > 0) {
    console.log(
      "Para entrar la primera vez, cada uno tiene que ir a la pantalla de login,\n" +
        'tocar "¿Olvidaste tu contraseña?" y pedir el link con su email.'
    );
  }

  return creados;
}
