// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { planSchema } from "../shared/db/schema.js";

/**
 * Qué le falta a la base para coincidir con las entidades, sin tocarla.
 *
 * No abre transacción, no escribe y no crea nada. Se puede correr en producción las veces
 * que haga falta. Separa lo que se aplica solo en el próximo deploy (lo que agrega) de lo
 * que necesita una persona y `npm run schema:apply` (lo que reescribe o borra algo que ya
 * existe). Ver shared/db/schema.
 */
async function plan(): Promise<void> {
  const { additions, rewrites, removals } = await planSchema();

  if (additions.length + rewrites.length + removals.length === 0) {
    console.log("La base ya coincide con el modelo. No hay nada que aplicar.");
    return;
  }

  if (additions.length) {
    console.log(`Se aplica solo en el próximo deploy, porque agrega (${additions.length}):\n`);
    for (const statement of additions) console.log(`   ${statement};`);
  }

  if (rewrites.length) {
    console.log(`\n⚠  Reescribe columnas que ya tienen datos (${rewrites.length}):\n`);
    for (const statement of rewrites) console.log(`   ${statement};`);
  }

  if (removals.length) {
    console.log(`\n⚠  Borra algo que ya existe (${removals.length}):\n`);
    for (const statement of removals) console.log(`   ${statement};`);
  }

  if (rewrites.length || removals.length) {
    console.log("\nEso no se aplica solo. Con un respaldo hecho, `npm run schema:apply` lo muestra y pide confirmar.");
  }
}

await plan();
await orm.close(true);
process.exit(0);
