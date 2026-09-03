/**
 * Comprueba que la compilación haya escrito un .js por cada .ts.
 *
 * Existe porque tsc puede terminar con éxito sin emitir nada: con la compilación
 * incremental le alcanza con que su registro diga que los archivos no cambiaron, y no
 * mira si la salida está. Eso deja un dist a medias que solo se descubre al arrancar,
 * con un "cannot find module" de un archivo que nadie borró.
 *
 * Un build que falla con la lista de lo que falta se lee en diez segundos. El otro
 * camino es leer una traza de Node desde un servidor que ya se cayó.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function archivosDe(dir) {
  const salida = [];

  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else salida.push(ruta);
  }

  return salida;
}

const fuentes = archivosDe("src").filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
const faltan = fuentes
  .map((f) => join("dist", relative("src", f).replace(/\.ts$/, ".js")))
  .filter((esperado) => !existsSync(esperado));

if (faltan.length > 0) {
  console.error(`\nLa compilación no escribió ${faltan.length} de ${fuentes.length} archivos:\n`);
  for (const f of faltan.slice(0, 20)) console.error(`  ${f}`);
  if (faltan.length > 20) console.error(`  … y ${faltan.length - 20} más`);
  console.error("\nBorrá dist/ y tsconfig.tsbuildinfo y volvé a compilar.\n");
  process.exit(1);
}

console.log(`dist completo: ${fuentes.length} archivos.`);
