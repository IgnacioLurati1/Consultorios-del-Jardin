// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { applyAdditions, pendingOf } from "../shared/db/schema.js";
import { ensureAdmins } from "./admins.js";

/**
 * Lo que corre en cada deploy, antes de que entre la versión nueva.
 *
 * Va en el Pre-Deploy Command de Railway y está pensado para correr solo, sin nadie
 * mirando. Por eso hace únicamente lo que es seguro hacer sin mirar:
 *
 * 1. Agrega al esquema lo que falte: columnas y tablas nuevas (ver shared/db/schema).
 * 2. Deja creados los administradores que falten, que es repetible y no pisa nada.
 *
 * Lo que no hace es tocar nada que ya exista: ni borrar una columna ni cambiarle el tipo.
 * Eso se escribe en el log para que una persona lo mire y lo aplique a mano con
 * `npm run schema:apply`, que pide confirmación escrita.
 *
 * Termina con código 0 salvo que algo falle de verdad. Un cambio pendiente de revisión no
 * es una falla: es una decisión que le toca a alguien, y frenar el deploy por eso dejaría
 * al consultorio sin servicio esperando a que alguien lea un log.
 */
async function migrate(): Promise<void> {
  const plan = await applyAdditions();

  if (plan.additions.length === 0) {
    console.log("El esquema ya está al día: no hay nada que agregar.");
  } else {
    console.log("Se agregó al esquema lo que faltaba:");
    for (const statement of plan.additions) console.log(`   ${statement};`);
    console.log("Listo.");
  }

  const pending = pendingOf(plan);
  if (pending.length > 0) {
    console.warn(`\n⚠  Quedaron ${pending.length} cambio(s) sin aplicar porque tocan algo que ya existe:\n`);
    for (const statement of pending) console.warn(`   ${statement};`);
    console.warn(
      "\nEl deploy sigue: la aplicación anda igual con esas diferencias. Para resolverlo,\n" +
        "mirá el detalle con `npm run schema:plan` y, con un respaldo hecho, aplicalo con `npm run schema:apply`.\n" +
        'Si alguno cambia el tipo de una columna con plata adentro, revisá primero que la entidad\n' +
        'diga `type: "integer"`: casi siempre el ALTER sobra y lo que falta es eso.'
    );
  }

  console.log("");
  await ensureAdmins();
}

migrate()
  .then(async () => {
    await orm.close(true);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("La migración del deploy falló:", error);
    await orm.close(true).catch(() => undefined);
    process.exit(1);
  });
