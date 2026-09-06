/**
 * Genera los iconos de la app a partir de la misma hoja que dibuja la pantalla de
 * arranque. Las formas se leen de src/theme/leaf.ts para que no haya dos verdades: si la
 * hoja cambia ahi, se vuelve a correr esto y listo.
 *
 *   node scripts/iconos.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";

const fuente = readFileSync("src/theme/leaf.ts", "utf8");

function unaRuta(nombre) {
  const m = fuente.match(new RegExp(`export const ${nombre} = "([^"]+)"`));
  if (!m) throw new Error(`no encontre ${nombre} en leaf.ts`);
  return m[1];
}

const BLADE = unaRuta("LEAF_BLADE");
const MIDRIB = unaRuta("LEAF_MIDRIB");
const STEM = unaRuta("LEAF_STEM");
const VEINS = [...fuente.matchAll(/"(M\d[^"]*)"/g)].map((m) => m[1]).filter((d) => d !== BLADE && d !== MIDRIB && d !== STEM);
if (VEINS.length !== 4) throw new Error(`esperaba 4 nervaduras, encontre ${VEINS.length}`);

const INK = "#12211a";
const BLADE_COLOR = "#3f8f5d";
const VEIN_COLOR = "#28603d";

/** El SVG de la hoja, con los colores que se le pidan. */
function hoja({ blade, veins, escala = 1 }) {
  const w = 100;
  const h = 124;
  const pad = (1 - escala) / 2;
  return `
    <svg viewBox="${-w * pad / escala} ${-h * pad / escala} ${w / escala} ${h / escala}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <path d="${STEM}" stroke="${blade}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="${BLADE}" fill="${blade}"/>
      <path d="${MIDRIB}" stroke="${veins}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      ${VEINS.map((d) => `<path d="${d}" stroke="${veins}" stroke-width="1.9" stroke-linecap="round" fill="none"/>`).join("")}
    </svg>`;
}

function pagina({ lado, fondo, svg }) {
  return `<!doctype html><meta charset="utf-8">
    <style>
      html,body{margin:0;padding:0;background:${fondo || "transparent"};}
      #caja{width:${lado}px;height:${lado}px;display:flex;align-items:center;justify-content:center;}
      svg{width:${lado}px;height:${lado}px;}
    </style>
    <div id="caja">${svg}</div>`;
}

const encargos = [
  {
    archivo: "assets/images/icon.png",
    lado: 1024,
    fondo: INK,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, escala: 0.72 }),
    transparente: false,
  },
  {
    // Android recorta el icono adaptativo: lo que se ve seguro es el circulo del medio.
    archivo: "assets/images/android-icon-foreground.png",
    lado: 1024,
    fondo: null,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, escala: 0.44 }),
    transparente: true,
  },
  {
    archivo: "assets/images/android-icon-monochrome.png",
    lado: 1024,
    fondo: null,
    svg: hoja({ blade: "#ffffff", veins: "#ffffff", escala: 0.44 }),
    transparente: true,
  },
  {
    archivo: "assets/images/favicon.png",
    lado: 96,
    fondo: null,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, escala: 0.9 }),
    transparente: true,
  },
  {
    // La imagen de la pantalla nativa: la misma hoja, suelta y sin fondo.
    archivo: "assets/images/leaf-mark.png",
    lado: 512,
    fondo: null,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, escala: 0.92 }),
    transparente: true,
  },
];

const browser = await chromium.launch();

for (const e of encargos) {
  const html = pagina({ lado: e.lado, fondo: e.fondo, svg: e.svg });
  const tmp = `_icono-tmp.html`;
  writeFileSync(tmp, html, "utf8");

  const page = await browser.newPage({
    viewport: { width: e.lado, height: e.lado },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(tmp).href);
  await page.waitForTimeout(250);
  await page.screenshot({ path: e.archivo, omitBackground: e.transparente });
  await page.close();
  unlinkSync(tmp);

  console.log("escrito", e.archivo, `${e.lado}x${e.lado}`, e.transparente ? "(transparente)" : `(fondo ${e.fondo})`);
}

await browser.close();
