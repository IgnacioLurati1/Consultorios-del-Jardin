process.env.TZ = "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";

/**
 * Qué le haría el bootstrap a la base, sin tocarla.
 *
 * `updateSchema` compara el modelo con lo que hay y aplica la diferencia. Sobre una base
 * vacía eso es crear tablas; sobre una con datos de verdad puede ser cualquier cosa,
 * incluida una columna que se va con lo que tenía adentro. Antes de correrlo en el
 * servidor hay que leer qué va a hacer, y para eso está esto: pide exactamente el mismo
 * SQL que ejecutaría el bootstrap y lo imprime.
 *
 * No abre transacción, no escribe y no crea nada. Se puede correr en producción las veces
 * que haga falta.
 *
 * Qué mirar en la salida:
 *
 * - `alter table ... add column` es lo esperable de una función nueva: agrega y no toca
 *   lo que ya está.
 * - `create table` es una tabla nueva, también esperable.
 * - `drop column`, `drop table` o un `modify` sobre una columna con datos es lo que hay
 *   que frenar y mirar de cerca: ahí se pierde información.
 *
 * Sin diferencias no imprime nada de SQL, que quiere decir que la base ya está al día.
 */
async function plan(): Promise<void> {
  const generator = orm.getSchemaGenerator();
  const sql = (await generator.getUpdateSchemaSQL()).trim();

  if (!sql) {
    console.log("La base ya coincide con el modelo. No hay nada que aplicar.");
    return;
  }

  const sentencias = sql
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  const peligrosas = sentencias.filter((linea) => /drop\s+(column|table)|\bmodify\b|\bchange\b/i.test(linea));

  console.log(`El bootstrap va a ejecutar ${sentencias.length} sentencia(s):\n`);
  console.log(sql);

  if (peligrosas.length > 0) {
    console.log(`\n⚠  ${peligrosas.length} de esas borran o cambian algo que ya existe. Revisalas antes de seguir:\n`);
    for (const linea of peligrosas) console.log(`   ${linea}`);
  } else {
    console.log("\nTodo lo de arriba agrega. No hay nada que borre ni cambie columnas existentes.");
  }
}

await plan();
await orm.close(true);
process.exit(0);
