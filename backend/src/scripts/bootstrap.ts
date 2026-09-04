process.env.TZ = "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { orm, syncSchema } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";

/**
 * Deja una base recién creada en condiciones de usarse.
 *
 * Corre una sola vez, a mano, después del primer deploy. No va en el arranque del
 * servidor a propósito: `updateSchema` compara el modelo con lo que hay y aplica la
 * diferencia, y eso sobre una base con datos de verdad, cada vez que se reinicia,
 * es una forma de perder una columna sin enterarse. Acá lo dispara una persona que
 * sabe lo que está haciendo.
 *
 * Es repetible: si las tablas ya están, no las toca; si un admin ya existe, lo deja
 * como está. Correrlo dos veces no rompe nada ni pisa contraseñas.
 */

/** Los administradores del consultorio. */
const ADMINS = [
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

async function bootstrap(): Promise<void> {
  console.log("Creando o actualizando las tablas…");
  await syncSchema();
  console.log("Tablas listas.");

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
    creados === 0
      ? "\nNo hubo que crear ningún admin: ya estaban los tres."
      : `\n${creados} admin(s) creados.`
  );
  console.log(
    "Para entrar la primera vez, cada uno tiene que ir a la pantalla de login,\n" +
      "tocar \"¿Olvidaste tu contraseña?\" y pedir el link con su email."
  );

  await orm.close(true);
}

bootstrap().catch(async (error) => {
  console.error("El bootstrap falló:", error);
  await orm.close(true).catch(() => undefined);
  process.exit(1);
});
