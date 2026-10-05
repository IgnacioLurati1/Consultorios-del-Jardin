import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// Que nada del código pueda borrar la base sin que una persona lo confirme.
//
// Los cambios de esquema pasan todos por shared/db/schema.ts: lo que agrega se aplica
// solo y lo que borra o reescribe lo aplica scripts/schema-apply.ts, con el nombre de la
// base escrito como confirmación. Esta prueba falla si aparece en cualquier otro lado una
// llamada que puede llevarse datos, aunque sea comentada: una línea comentada que borra
// todo es una línea a un "descomentar" de borrar todo.
// ============================================================

const backend = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const src = join(backend, "src");

function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : filesUnder(path, pattern);
    return pattern.test(name) ? [path] : [];
  });
}

const where = (path: string) => relative(backend, path).split(sep).join("/");

/** Los dos únicos archivos que pueden pedirle al ORM cambiar el esquema. */
const SCHEMA_FILES = new Set(["src/shared/db/schema.ts", "src/scripts/schema-apply.ts"]);

describe("el esquema no se borra por accidente", () => {
  const sources = filesUnder(src, /\.ts$/).map((path) => ({ path: where(path), text: readFileSync(path, "utf8") }));

  it("ningún archivo llama a dropSchema, createSchema, refreshDatabase ni dropDatabase, ni comentado", () => {
    const found = sources.filter(({ text }) => /\b(dropSchema|createSchema|refreshDatabase|dropDatabase|clearDatabase)\s*\(/.test(text));
    expect(found.map((file) => file.path)).toEqual([]);
  });

  it("updateSchema solo aparece en el módulo del esquema y en el script con confirmación", () => {
    const found = sources.filter(({ path, text }) => /\bupdateSchema\s*\(/.test(text) && !SCHEMA_FILES.has(path));
    expect(found.map((file) => file.path)).toEqual([]);
  });

  it("lo que se aplica solo pide el modo seguro y sin borrar tablas", () => {
    const schema = sources.find((file) => file.path === "src/shared/db/schema.ts")!.text;
    const calls = schema.match(/updateSchema\(\{[^}]*\}\)/g) ?? [];
    // Una en applyAdditions (segura) y otra en applyEverything (la que confirma una persona).
    expect(calls).toEqual(["updateSchema({ safe: true, dropTables: false })", "updateSchema({ safe: false, dropTables: true })"]);
    expect(schema).toMatch(/confirmed !== database/);
  });

  it("ningún SQL suelto del código borra una base, una tabla ni la vacía", () => {
    const sql = [...sources, ...filesUnder(join(backend, "docs"), /\.sql$/).map((path) => ({ path: where(path), text: readFileSync(path, "utf8") }))];
    const found = sql.filter(
      ({ path, text }) => !SCHEMA_FILES.has(path) && /["'`]\s*(drop\s+(database|schema|table)|truncate\s+table?)\b/i.test(text)
    );
    const docs = sql.filter(({ path, text }) => path.endsWith(".sql") && /\b(drop\s+(database|schema|table)|truncate)\b/i.test(text));
    expect([...found, ...docs].map((file) => file.path)).toEqual([]);
  });
});
