process.env.TZ = "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm, syncSchema } from "../shared/db/orm.js";
import { ensureAdmins } from "./admins.js";

/**
 * Deja una base recién creada en condiciones de usarse.
 *
 * Corre a mano, y solo cuando alguien está mirando. Aplica **toda** la diferencia entre
 * el modelo y la base, y toda la diferencia incluye borrar: `updateSchema` no distingue
 * entre agregar una columna y llevarse otra con lo que tenía adentro. Por eso no va en
 * el arranque del servidor ni en el deploy automático.
 *
 * Para el deploy está `deploy-migrate.ts`, que hace lo mismo en modo seguro —agrega y
 * nunca borra— y avisa por log lo que dejó pendiente. Este script es para aplicar
 * justamente eso pendiente, después de mirar con `npm run schema:plan` qué se pierde.
 *
 * Es repetible: si las tablas ya están, no las toca; si un admin ya existe, lo deja
 * como está. Correrlo dos veces no rompe nada ni pisa contraseñas.
 */

async function bootstrap(): Promise<void> {
  console.log("Creando o actualizando las tablas…");
  await syncSchema();
  console.log("Tablas listas.");

  await ensureAdmins();

  await orm.close(true);
}

bootstrap().catch(async (error) => {
  console.error("El bootstrap falló:", error);
  await orm.close(true).catch(() => undefined);
  process.exit(1);
});
