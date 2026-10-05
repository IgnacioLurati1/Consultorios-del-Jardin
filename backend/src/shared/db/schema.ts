import { orm } from "./orm.js";

/**
 * Los cambios de esquema, separados por lo que le hacen a los datos.
 *
 * El ORM compara las entidades con la base y arma el SQL de la diferencia, pero no
 * distingue entre agregar una columna y llevarse otra con lo que tenía adentro: para él
 * las dos son "la diferencia". Acá se separan:
 *
 * - **Lo que agrega** (tablas y columnas nuevas, índices nuevos) se aplica solo: en el
 *   deploy, al arrancar en local y en el bootstrap de una base nueva. No toca nada que ya
 *   tenga datos.
 * - **Lo que reescribe** una columna que existe (`modify`, `change`) y **lo que borra**
 *   (columnas, tablas) no se aplica nunca solo. Lo aplica una persona con
 *   `npm run schema:apply`, que pide escribir el nombre de la base para confirmar.
 *
 * Es el único lugar del código que le pide al ORM cambiar el esquema. No hay ni tiene que
 * haber un `dropSchema`, un `createSchema` ni un `updateSchema` sin `safe` en ningún otro
 * lado: lo controla `schemaSafety.test.ts`, que falla si aparece uno.
 */

export interface SchemaPlan {
  /** Agrega sin tocar lo que hay. Se aplica solo. */
  additions: string[];
  /** Le cambia el tipo o la forma a una columna que ya existe. Necesita una persona. */
  rewrites: string[];
  /** Borra una columna, una tabla o un índice que ya existe. Necesita una persona. */
  removals: string[];
}

/** Las sentencias de una tirada de SQL, sin las vacías ni los `set` de alrededor. */
export function statementsOf(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^set\s/i.test(statement));
}

/**
 * Una sentencia que reescribe una columna que ya existe.
 *
 * `modify` y `change` son las dos formas que tiene MySQL de decirlo. Ninguna de las dos
 * agrega nada: las dos toman una columna con datos adentro y le cambian la forma. El modo
 * `safe` del ORM las deja pasar, y es peor de lo que parece: el día que a una propiedad de
 * plata se le escapa el tipo, el ORM decide que la columna va como texto y manda el ALTER.
 */
export function rewritesAnExistingColumn(statement: string): boolean {
  return /\balter\s+table\b[\s\S]*\b(modify|change)\b/i.test(statement);
}

/** Qué haría falta para que la base coincida con las entidades, separado. No escribe nada. */
export async function planSchema(): Promise<SchemaPlan> {
  const generator = orm.getSchemaGenerator();
  const safe = statementsOf(await generator.getUpdateSchemaSQL({ safe: true, dropTables: false }));
  const full = statementsOf(await generator.getUpdateSchemaSQL({ safe: false, dropTables: true }));

  return {
    additions: safe.filter((statement) => !rewritesAnExistingColumn(statement)),
    rewrites: safe.filter(rewritesAnExistingColumn),
    // Lo que el modo seguro ya descartaba por destructivo. El generador no lo informa
    // aparte, así que se deduce comparando las dos tiradas.
    removals: full.filter((statement) => !safe.includes(statement) && /\b(alter|drop)\s+table\b/i.test(statement)),
  };
}

/**
 * Aplica lo que agrega y nada más. Devuelve el plan, para que quien llama avise lo que
 * quedó sin aplicar.
 */
export async function applyAdditions(): Promise<SchemaPlan> {
  const plan = await planSchema();
  if (plan.additions.length === 0) return plan;

  if (plan.rewrites.length === 0) {
    // El camino de casi siempre: la tirada entera tal como la arma el ORM, con sus `set`
    // alrededor, en modo seguro y sin borrar tablas.
    await orm.getSchemaGenerator().updateSchema({ safe: true, dropTables: false });
  } else {
    // Hay algo que reescribe una columna, así que la tirada no se puede aplicar de una: se
    // ejecuta lo que agrega, una sentencia por vez, y lo otro queda para una persona.
    const connection = orm.em.getConnection();
    for (const statement of plan.additions) await connection.execute(statement);
  }

  return plan;
}

/** Lo que quedó sin aplicar, para escribirlo en el log. Vacío si no quedó nada. */
export function pendingOf(plan: SchemaPlan): string[] {
  return [...plan.rewrites, ...plan.removals];
}

/**
 * Aplica todo, incluido lo que reescribe y lo que borra.
 *
 * Solo la llama `scripts/schema-apply.ts`, después de mostrar el plan y de que una persona
 * escriba el nombre de la base. `confirmed` tiene que ser ese nombre: si no coincide con la
 * base a la que está conectado, no hace nada. Así un llamado por error, o desde otra base,
 * no borra nada.
 */
export async function applyEverything(confirmed: string): Promise<void> {
  const [row] = await orm.em.getConnection().execute<{ name: string | null }[]>("select database() as name");
  const database = row?.name ?? "";
  if (!database || confirmed !== database) {
    throw new Error(`La confirmación no coincide con la base "${database}". No se aplicó nada.`);
  }
  await orm.getSchemaGenerator().updateSchema({ safe: false, dropTables: true });
}
