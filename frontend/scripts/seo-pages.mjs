// Después de compilar: una copia del HTML por cada página pública, con su título y su
// descripción ya escritos.
//
// El sitio es una sola página que arma todo con JavaScript, y GitHub Pages no sabe de
// rutas: a /preguntas le contestaba con 404.html. La página se veía igual, pero con un
// "no existe" por delante, y así Google no la indexa. Con `preguntas.html` en la carpeta,
// Pages sirve /preguntas con un 200.
//
// Los textos salen de src/seo.json, el mismo archivo que usa la aplicación al navegar
// (lib/pageMeta.ts). La portada también se reescribe desde ahí, así el index.html del
// código y lo publicado no pueden quedar diciendo cosas distintas.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const seo = JSON.parse(readFileSync(new URL("src/seo.json", root), "utf8"));
const template = readFileSync(new URL("dist/index.html", root), "utf8");

const attribute = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function render(path, meta) {
  const url = path === "/" ? `${seo.site}/` : `${seo.site}${path}`;

  // Cada regla tiene que encontrar su etiqueta: si alguien la saca del index.html, el
  // build se corta acá en vez de publicar una página sin título.
  const rules = [
    [/<title>[^<]*<\/title>/, () => `<title>${attribute(meta.title)}</title>`],
    [/(<meta name="description" content=")[^"]*/, (_, tag) => tag + attribute(meta.description)],
    [/(<link rel="canonical" href=")[^"]*/, (_, tag) => tag + url],
    [/(<meta property="og:title" content=")[^"]*/, (_, tag) => tag + attribute(meta.title)],
    [/(<meta property="og:description" content=")[^"]*/, (_, tag) => tag + attribute(meta.description)],
    [/(<meta property="og:url" content=")[^"]*/, (_, tag) => tag + url],
    [/(<meta name="twitter:title" content=")[^"]*/, (_, tag) => tag + attribute(meta.title)],
    [/(<meta name="twitter:description" content=")[^"]*/, (_, tag) => tag + attribute(meta.description)],
  ];

  let html = template;
  for (const [pattern, replace] of rules) {
    if (!pattern.test(html)) throw new Error(`No está ${pattern} en index.html`);
    html = html.replace(pattern, replace);
  }
  return html;
}

for (const [path, meta] of Object.entries(seo.pages)) {
  const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
  writeFileSync(new URL(`dist/${file}`, root), render(path, meta));
  console.log(`Página para buscadores: dist/${file}`);
}
