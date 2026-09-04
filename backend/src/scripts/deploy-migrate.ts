process.env.TZ = "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { ensureAdmins } from "./admins.js";

/**
 * Lo que corre en cada deploy, antes de que entre la versión nueva.
 *
 * Va en el Pre-Deploy Command de Railway y está pensado para correr solo, sin nadie
 * mirando. Por eso hace únicamente lo que es seguro hacer sin mirar:
 *
 * 1. Agrega al esquema lo que falte: columnas y tablas nuevas.
 * 2. Deja creados los administradores que falten, que es repetible y no pisa nada.
 *
 * Lo que no hace es tocar nada que ya exista. Son dos cosas distintas y hay que nombrarlas
 * por separado, porque el modo `safe` del ORM solo cubre la primera:
 *
 * - **Borrar.** Una columna que desaparece de una entidad, para el ORM no es un renombre
 *   sino una columna que se va con todo lo que tenía adentro. De eso ya se ocupa `safe`.
 * - **Cambiar el tipo.** Esto `safe` lo aplica igual, y es peor de lo que parece: el día
 *   que a una propiedad de plata se le escapa el tipo, el ORM decide que la columna va
 *   como texto y manda el ALTER sin preguntar. Guardada como texto, la plata se suma
 *   concatenando y las comparaciones ordenan alfabéticamente. Por eso los `modify` se
 *   filtran acá y no se aplican solos.
 *
 * Lo que queda sin aplicar se escribe en el log para que una persona lo mire y lo haga a
 * mano, con `npm run schema:plan` para verlo entero y `npm run bootstrap` para aplicarlo.
 *
 * Termina con código 0 salvo que algo falle de verdad. Un cambio pendiente de revisión no
 * es una falla: es una decisión que le toca a alguien, y frenar el deploy por eso dejaría
 * al consultorio sin servicio esperando a que alguien lea un log.
 */

/** Las sentencias de una tirada de SQL, sin las vacías ni los `set` de alrededor. */
function statementsOf(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^set\s/i.test(statement));
}

/**
 * Una sentencia que reescribe una columna que ya existe.
 *
 * `modify` y `change` son las dos formas que tiene MySQL de decirlo. Ninguna de las dos
 * agrega nada: las dos toman una columna con datos adentro y le cambian la forma.
 */
function rewritesAnExistingColumn(statement: string): boolean {
  return /\balter\s+table\b[\s\S]*\b(modify|change)\b/i.test(statement);
}

async function migrate(): Promise<void> {
  const generator = orm.getSchemaGenerator();
  const connection = orm.em.getConnection();

  const seguro = statementsOf(await generator.getUpdateSchemaSQL({ safe: true }));
  const completo = statementsOf(await generator.getUpdateSchemaSQL({ safe: false }));

  const reescrituras = seguro.filter(rewritesAnExistingColumn);
  const agregados = seguro.filter((statement) => !rewritesAnExistingColumn(statement));

  if (agregados.length === 0) {
    console.log("El esquema ya está al día: no hay nada que agregar.");
  } else {
    console.log("Agregando al esquema lo que falta:");
    for (const statement of agregados) console.log(`   ${statement};`);

    if (reescrituras.length === 0) {
      // El camino de siempre, y el único que se recorre casi todas las veces: la tirada
      // entera tal como la arma el ORM, con sus `set` alrededor.
      await generator.updateSchema({ safe: true });
    } else {
      // Hay algo que reescribe una columna, así que la tirada no se puede aplicar de una:
      // se ejecuta lo que agrega y se deja lo otro para que lo mire una persona.
      for (const statement of agregados) await connection.execute(statement);
    }

    console.log("Listo.");
  }

  // Lo que quedó sin aplicar: los cambios de tipo que apartamos, más lo que el modo seguro
  // ya descartaba por destructivo. Esto último se deduce comparando el SQL de las dos
  // formas, que es la única manera de nombrarlo: el generador no lo informa aparte.
  const pendiente = [
    ...reescrituras,
    ...completo.filter((statement) => !seguro.includes(statement) && /alter table|drop table/i.test(statement)),
  ];

  if (pendiente.length > 0) {
    console.warn(`\n⚠  Quedaron ${pendiente.length} cambio(s) sin aplicar porque tocan algo que ya existe:\n`);
    for (const statement of pendiente) console.warn(`   ${statement};`);
    console.warn(
      "\nEl deploy sigue: la aplicación anda igual con esas diferencias. Para resolverlo,\n" +
        "mirá el detalle con `npm run schema:plan` y aplicalo a mano cuando puedas ver qué se pierde.\n" +
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
