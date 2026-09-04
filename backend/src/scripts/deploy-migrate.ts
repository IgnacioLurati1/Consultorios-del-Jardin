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
 * 1. Agrega al esquema lo que falte —columnas y tablas nuevas— en modo `safe`, que
 *    **nunca borra ni reescribe** nada que ya exista. Es la diferencia con el bootstrap:
 *    ese aplica toda la diferencia, y toda la diferencia incluye borrar. El día que
 *    alguien le cambie el nombre a una propiedad de una entidad, para el ORM eso no es
 *    un renombre sino una columna que se va con lo que tenía adentro; acá eso no puede
 *    pasar sola.
 * 2. Deja creados los administradores que falten, que es repetible y no pisa nada.
 *
 * Si queda algo pendiente que solo se puede aplicar borrando o reescribiendo, no lo
 * aplica: lo escribe en el log para que una persona lo mire y lo haga a mano, con
 * `npm run schema:plan` para verlo entero y `npm run bootstrap` para aplicarlo.
 *
 * Termina con código 0 salvo que algo falle de verdad. Un cambio destructivo pendiente
 * no es una falla: es una decisión que le toca a alguien, y frenar el deploy por eso
 * dejaría el consultorio sin servicio esperando a que alguien lea un log.
 */
async function migrate(): Promise<void> {
  const generator = orm.getSchemaGenerator();

  const seguro = (await generator.getUpdateSchemaSQL({ safe: true })).trim();
  const completo = (await generator.getUpdateSchemaSQL({ safe: false })).trim();

  if (!seguro) {
    console.log("El esquema ya está al día: no hay nada que agregar.");
  } else {
    console.log("Agregando al esquema lo que falta:");
    console.log(seguro);

    await generator.updateSchema({ safe: true });
    console.log("Listo.");
  }

  // Lo que la pasada segura no aplicó. Se compara el SQL de las dos formas porque es la
  // única manera de nombrar lo que quedó afuera: el generador no lo informa aparte.
  const pendiente = completo
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea && !seguro.includes(linea) && /alter table|drop table/i.test(linea));

  if (pendiente.length > 0) {
    console.warn(
      `\n⚠  Quedaron ${pendiente.length} cambio(s) que no se aplican solos porque borran o reescriben algo que ya existe:\n`
    );
    for (const linea of pendiente) console.warn(`   ${linea}`);
    console.warn(
      "\nEl deploy sigue: la aplicación anda igual con esas diferencias. Para resolverlo,\n" +
        "mirá el detalle con `npm run schema:plan` y aplicalo a mano cuando puedas mirar qué se pierde."
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
