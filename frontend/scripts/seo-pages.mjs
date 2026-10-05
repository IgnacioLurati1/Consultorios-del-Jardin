// Después de compilar: lo que leen los buscadores, armado con los datos del cliente.
//
// El sitio es una sola página que arma todo con JavaScript, y GitHub Pages no sabe de
// rutas: a /preguntas le contestaba con 404.html. La página se veía igual, pero con un
// "no existe" por delante, y así Google no la indexa. Con `preguntas.html` en la carpeta,
// Pages sirve /preguntas con un 200. Por eso hay una copia del HTML por cada página
// pública, con su título y su descripción ya escritos.
//
// Todo sale de src/seo.json. El mismo código se publica para más de un consultorio, y lo
// que ven los buscadores no puede esperar a que cargue JavaScript ni a que conteste el
// servidor: tiene que estar escrito en el HTML. Así que cada consultorio tiene su seo.json
// —el dominio, el nombre, la dirección, el horario, los colores del manifiesto— y este
// script lo vuelca en:
//
//   · el index.html de cada página pública (títulos, descripciones, dominio, imagen para
//     compartir, el bloque JSON-LD y el texto para quien no ejecuta JavaScript)
//   · site.webmanifest, sitemap.xml y robots.txt
//
// El index.html del código queda con los datos de Consultorios del Jardín, que es lo que
// sirve el servidor de desarrollo. Lo publicado sale siempre de acá.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const seo = JSON.parse(readFileSync(new URL("src/seo.json", root), "utf8"));
const client = seo.client;
const dist = (file) => new URL(`dist/${file}`, root);

if (!client?.name) throw new Error("Falta client.name en src/seo.json");
if (!/^https:\/\/[^/]+$/.test(seo.site)) throw new Error("site en src/seo.json tiene que ser https://dominio, sin barra final");

const attribute = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ============================================================
   El consultorio en el formato que entienden los buscadores.
   ============================================================ */

function jsonLd() {
  const site = `${seo.site}/`;
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${seo.site}/#sitio`,
      url: site,
      name: client.name,
      ...(client.alternateName ? { alternateName: client.alternateName } : {}),
      inLanguage: "es-AR",
    },
    {
      "@type": client.businessType || "LocalBusiness",
      "@id": `${seo.site}/#consultorio`,
      name: client.name,
      url: site,
      logo: `${seo.site}/icon-512.png`,
      image: `${seo.site}/og-image.jpg`,
      ...(client.description ? { description: client.description } : {}),
      ...(client.email ? { email: client.email } : {}),
      ...(client.address
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: client.address.street,
              addressLocality: client.address.locality,
              ...(client.address.region ? { addressRegion: client.address.region } : {}),
              ...(client.address.postalCode ? { postalCode: client.address.postalCode } : {}),
              addressCountry: client.address.country || "AR",
            },
          }
        : {}),
      ...(client.directions ? { hasMap: client.directions } : {}),
      ...(client.hours?.length
        ? {
            openingHoursSpecification: client.hours.map((slot) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: slot.days,
              opens: slot.opens,
              closes: slot.closes,
            })),
          }
        : {}),
      ...(client.services?.length ? { knowsAbout: client.services } : {}),
      ...(client.sameAs?.length ? { sameAs: client.sameAs } : {}),
    },
  ];

  // "</" dentro de un <script> lo cerraría antes de tiempo, así que se escapa.
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2).replace(/<\//g, "<\\/");
  return `<script type="application/ld+json">\n${json}\n    </script>`;
}

/* ============================================================
   Lo que es igual en todas las páginas: se escribe una vez.
   ============================================================ */

function clientTemplate(source) {
  // El dominio del index.html del código se reemplaza en todos lados por el del cliente.
  // Se toma del canonical para no tener que escribirlo dos veces.
  const original = source.match(/<link rel="canonical" href="(https:\/\/[^/"]+)/)?.[1];
  if (!original) throw new Error("No está el canonical en index.html");

  const rules = [
    [/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => jsonLd()],
    [/(<meta property="og:site_name" content=")[^"]*/, (_, tag) => tag + attribute(client.name)],
    [/(<meta property="og:image:alt" content=")[^"]*/, (_, tag) => tag + attribute(client.ogImageAlt || client.name)],
    [/(<meta name="theme-color" content=")[^"]*/, (_, tag) => tag + attribute(client.themeColor || "#2f5e46")],
    [
      /<noscript>[\s\S]*?<\/noscript>/,
      () => `<noscript>\n      <h1>${text(client.name)}</h1>\n      <p>${text(client.noscript || client.description || "")}</p>\n    </noscript>`,
    ],
  ];

  let html = source.split(original).join(seo.site);
  for (const [pattern, replace] of rules) {
    if (!pattern.test(html)) throw new Error(`No está ${pattern} en index.html`);
    html = html.replace(pattern, replace);
  }
  return html;
}

/* ============================================================
   Lo de cada página.
   ============================================================ */

function render(template, path, meta) {
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

const template = clientTemplate(readFileSync(dist("index.html"), "utf8"));

for (const [path, meta] of Object.entries(seo.pages)) {
  const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
  writeFileSync(dist(file), render(template, path, meta));
  console.log(`Página para buscadores: dist/${file}`);
}

/* ============================================================
   Manifiesto, sitemap y robots.
   ============================================================ */

// El manifiesto de public/ queda como base (íconos, idioma, modo) y se le pisan los datos
// del cliente.
const manifest = JSON.parse(readFileSync(dist("site.webmanifest"), "utf8"));
manifest.name = client.name;
manifest.short_name = client.shortName || client.name;
if (client.themeColor) manifest.theme_color = client.themeColor;
if (client.backgroundColor) manifest.background_color = client.backgroundColor;
writeFileSync(dist("site.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Manifiesto: dist/site.webmanifest");

// La fecha de la última publicación. Escrita a mano, quedaba congelada en la del día en
// que alguien se acordó de cambiarla.
const today = new Date().toISOString().slice(0, 10);
const urls = Object.keys(seo.pages)
  .map((path) => `  <url>\n    <loc>${path === "/" ? `${seo.site}/` : `${seo.site}${path}`}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
  .join("\n");
writeFileSync(
  dist("sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);
console.log("Sitemap: dist/sitemap.xml");

// Las rutas que no se indexan son las mismas para todos los consultorios; lo único que
// cambia es dónde está el sitemap.
const robots = readFileSync(dist("robots.txt"), "utf8").replace(/^Sitemap: .*$/m, `Sitemap: ${seo.site}/sitemap.xml`);
writeFileSync(dist("robots.txt"), robots);
console.log("Robots: dist/robots.txt");
