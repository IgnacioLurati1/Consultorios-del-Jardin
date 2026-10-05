// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { applyAdditions, applyEverything, planSchema } from "../shared/db/schema.js";

/**
 * Aplica a mano lo que el deploy deja pendiente: los cambios que reescriben o borran algo
 * que ya existe.
 *
 * Es el único camino del código que puede llevarse una columna con sus datos, y por eso
 * no corre solo en ningún lado y pide confirmación escrita:
 *
 *   npm run schema:apply                          muestra el plan y no toca nada
 *   npm run schema:apply -- --confirmar=<base>    lo aplica, si <base> es el nombre de la
 *                                                 base a la que está conectado
 *
 * Antes de confirmar, un respaldo de la base. Lo que se borra acá no vuelve.
 *
 * Sin nada que reescriba ni borre, aplica lo que agrega (lo mismo que el deploy) y termina:
 * para eso no hace falta confirmar nada.
 */

function confirmation(): string | null {
  const arg = process.argv.find((item) => item.startsWith("--confirmar="));
  return arg ? arg.slice("--confirmar=".length).trim() : null;
}

async function main(): Promise<void> {
  const plan = await planSchema();
  const risky = [...plan.rewrites, ...plan.removals];

  if (risky.length === 0) {
    const applied = await applyAdditions();
    console.log(
      applied.additions.length
        ? `Se agregaron ${applied.additions.length} cambio(s). No había nada que borre ni reescriba.`
        : "La base ya coincide con el modelo. No hay nada que aplicar."
    );
    return;
  }

  console.log("Esto agrega, y se aplica igual en cada deploy:\n");
  for (const statement of plan.additions) console.log(`   ${statement};`);
  if (plan.additions.length === 0) console.log("   (nada)");

  console.log(`\n⚠  Esto reescribe o borra algo que ya existe (${risky.length}):\n`);
  for (const statement of risky) console.log(`   ${statement};`);

  const confirmed = confirmation();
  if (!confirmed) {
    const [row] = await orm.em.getConnection().execute<{ name: string | null }[]>("select database() as name");
    console.log(
      "\nNo se aplicó nada. Para aplicarlo, con un respaldo hecho, correr de nuevo con\n" +
        `   npm run schema:apply -- --confirmar=${row?.name ?? "<nombre de la base>"}\n`
    );
    return;
  }

  await applyEverything(confirmed);
  console.log("\nListo. La base coincide con el modelo.");
}

main()
  .then(async () => {
    await orm.close(true);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("No se aplicó el esquema:", error instanceof Error ? error.message : error);
    await orm.close(true).catch(() => undefined);
    process.exit(1);
  });
