// La zona del consultorio (ver shared/timezone). Va primero para que todo lo que sigue la use.
process.env.TZ = (process.env.TIMEZONE ?? "").trim() || "America/Argentina/Buenos_Aires";

import "reflect-metadata";
import { orm } from "../shared/db/orm.js";
import { Person } from "../people/people.entity.js";
import { properName } from "../shared/names.js";

/**
 * Pone las mayúsculas a los nombres que ya estaban cargados.
 *
 * Desde ahora cada persona se guarda con el nombre acomodado (ver Person.normalizeNames),
 * pero las que entraron antes siguen como se escribieron. Esto las recorre una vez.
 *
 * Sin argumentos solo muestra qué cambiaría, sin tocar nada. Con `--aplicar` lo guarda.
 * No imprime correos: solo cuántas cuentas y el nombre de antes y el de después.
 *
 *   npm run names:plan
 *   npm run names:apply
 */
async function run(): Promise<void> {
  const apply = process.argv.includes("--aplicar");
  const em = orm.em.fork();

  const people = await em.find(Person, {}, { orderBy: { surname: "asc" } });
  const changes = people
    .map((person) => ({ person, name: properName(person.name), surname: properName(person.surname) }))
    .filter(({ person, name, surname }) => name !== person.name || surname !== person.surname);

  for (const { person, name, surname } of changes) {
    console.log(`  ${person.name} ${person.surname}  →  ${name} ${surname}`);
  }
  console.log(`\n${changes.length} de ${people.length} cuentas ${apply ? "corregidas" : "se corregirían"}.`);

  if (apply && changes.length) {
    // El hook de la entidad hace lo mismo al guardar; se asigna igual para que el cambio
    // quede registrado y el flush lo escriba.
    for (const { person, name, surname } of changes) {
      person.name = name;
      person.surname = surname;
    }
    await em.flush();
  } else if (!apply && changes.length) {
    console.log("Para guardarlo: npm run names:apply");
  }

  await orm.close();
}

run().catch(async (error) => {
  console.error("No se pudo revisar los nombres:", error);
  await orm.close().catch(() => {});
  process.exit(1);
});
