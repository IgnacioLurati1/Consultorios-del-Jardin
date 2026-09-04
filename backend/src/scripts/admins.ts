import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";

/** Los administradores del consultorio. */
export const ADMINS = [
  { email: "ignaciolurati2@gmail.com", name: "Ignacio", surname: "Lurati" },
  { email: "a-samp@hotmail.com", name: "Agustín", surname: "Sampietro" },
  { email: "ricardolurati@gmail.com", name: "Ricardo", surname: "Lurati" },
];

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
  let creados = 0;

  for (const admin of ADMINS) {
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
    creados === 0 ? "\nNo hubo que crear ningún admin: ya estaban los tres." : `\n${creados} admin(s) creados.`
  );

  if (creados > 0) {
    console.log(
      "Para entrar la primera vez, cada uno tiene que ir a la pantalla de login,\n" +
        'tocar "¿Olvidaste tu contraseña?" y pedir el link con su email.'
    );
  }

  return creados;
}
