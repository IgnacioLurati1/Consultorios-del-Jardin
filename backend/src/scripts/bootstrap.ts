// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { applyAdditions, pendingOf } from "../shared/db/schema.js";
import { ensureAdmins } from "./admins.js";

/**
 * Deja una base recién creada en condiciones de usarse.
 *
 * Crea las tablas que falten y los administradores de `INITIAL_ADMINS`. Sobre una base
 * vacía todo es agregar, así que alcanza con lo mismo que hace el deploy: nunca borra ni
 * reescribe nada (ver shared/db/schema). Antes aplicaba la diferencia entera, borrado
 * incluido; eso ahora es `npm run schema:apply`, con confirmación escrita.
 *
 * Es repetible: si las tablas ya están, no las toca; si un admin ya existe, lo deja
 * como está. Correrlo dos veces no rompe nada ni pisa contraseñas.
 */
async function bootstrap(): Promise<void> {
  console.log("Creando las tablas que falten…");
  const plan = await applyAdditions();
  console.log(plan.additions.length ? `Tablas listas (${plan.additions.length} cambio(s)).` : "Las tablas ya estaban.");

  const pending = pendingOf(plan);
  if (pending.length > 0) {
    console.warn(`⚠  ${pending.length} cambio(s) tocan algo que ya existe y no se aplicaron. Ver \`npm run schema:apply\`.`);
  }

  await ensureAdmins();

  await orm.close(true);
}

bootstrap().catch(async (error) => {
  console.error("El bootstrap falló:", error);
  await orm.close(true).catch(() => undefined);
  process.exit(1);
});
