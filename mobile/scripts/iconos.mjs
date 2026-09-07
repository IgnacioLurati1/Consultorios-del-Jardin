/**
 * Genera los iconos de la app a partir de la misma hoja que dibuja la pantalla de
 * arranque. Las formas, el angulo y los colores se leen de src/theme/leaf.ts para que no
 * haya dos verdades: si la hoja cambia ahi, se vuelve a correr esto y listo.
 *
 *   node scripts/iconos.mjs
 *
 * La hoja sale inclinada, con el mismo angulo con el que espera quieta en la pantalla de
 * arranque. Es lo que hace que tocar el icono y ver aparecer la app se lea como una sola
 * cosa y no como dos dibujos parecidos: la hoja del escritorio es la que se llena de
 * color un segundo despues.
 *
 * Al final imprime el imageWidth que le corresponde a la pantalla nativa en app.json. Es
 * una cuenta y no un numero elegido a ojo: la hoja nativa tiene que salir del tamano
 * exacto que despues dibuja el JS, o al cambiar una por la otra pega un salto.
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

function unNumero(nombre, texto = fuente) {
  const m = texto.match(new RegExp(`${nombre} = (-?[\\d.]+)`));
  if (!m) throw new Error(`no encontre ${nombre}`);
  return Number(m[1]);
}

const BLADE = unaRuta("LEAF_BLADE");
const MIDRIB = unaRuta("LEAF_MIDRIB");
const STEM = unaRuta("LEAF_STEM");
const VEINS = [...fuente.matchAll(/"(M\d[^"]*)"/g)].map((m) => m[1]).filter((d) => d !== BLADE && d !== MIDRIB && d !== STEM);
if (VEINS.length !== 4) throw new Error(`esperaba 4 nervaduras, encontre ${VEINS.length}`);

const TILT = unNumero("LEAF_TILT");

/** El lienzo de la hoja, tal como lo declara leaf.ts. */
const BOX = { width: 100, height: 124 };

const INK = "#12211a";
const BLADE_COLOR = "#3f8f5d";
const VEIN_COLOR = "#28603d";

/** La hoja apagada de leaf.ts, que es con la que arranca la animacion. */
function apagada() {
  const m = fuente.match(/LEAF_EMPTY: LeafColors = \{ blade: "([^"]+)", veins: "([^"]+)" \}/);
  if (!m) throw new Error("no encontre LEAF_EMPTY en leaf.ts");
  return { blade: m[1], veins: m[2] };
}

/**
 * Cuanto mide la caja de la hoja una vez inclinada.
 *
 * Girar no cambia el dibujo pero si el lugar que ocupa, y bastante: una hoja alta puesta
 * en diagonal se vuelve casi cuadrada. Sin esta cuenta habria que elegir el margen a ojo
 * y volver a elegirlo cada vez que el angulo cambie.
 */
function cajaInclinada(grados) {
  const rad = (Math.abs(grados) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: BOX.width * cos + BOX.height * sin,
    height: BOX.width * sin + BOX.height * cos,
  };
}

const INCLINADA = cajaInclinada(TILT);
/** El lado del cuadrado mas chico que la contiene, que es lo que se encuadra. */
const LADO_HOJA = Math.max(INCLINADA.width, INCLINADA.height);

/**
 * El SVG de la hoja inclinada, con los colores que se le pidan.
 *
 * `ocupa` es la fraccion del cuadrado que se lleva la hoja ya girada. Se mide sobre la
 * hoja girada y no sobre la parada a proposito: medida sobre la parada, inclinarla la
 * haria crecer un 28% y todos los iconos saldrian mas apretados de lo que decia el numero.
 */
function hoja({ blade, veins, ocupa = 1 }) {
  const lado = LADO_HOJA / ocupa;
  const x = BOX.width / 2 - lado / 2;
  const y = BOX.height / 2 - lado / 2;

  return `
    <svg viewBox="${x} ${y} ${lado} ${lado}" width="100%" height="100%">
      <g transform="rotate(${TILT} ${BOX.width / 2} ${BOX.height / 2})">
        <path d="${STEM}" stroke="${blade}" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="${BLADE}" fill="${blade}"/>
        <path d="${MIDRIB}" stroke="${veins}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        ${VEINS.map((d) => `<path d="${d}" stroke="${veins}" stroke-width="1.9" stroke-linecap="round" fill="none"/>`).join("")}
      </g>
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

/** Lo que ocupa la hoja de la pantalla de arranque, para que la nativa salga igual. */
const MARCA_OCUPA = 0.92;

const encargos = [
  {
    archivo: "assets/images/icon.png",
    lado: 1024,
    fondo: INK,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, ocupa: 0.80 }),
    transparente: false,
  },
  {
    // Android recorta el icono adaptativo: lo que se ve seguro es el circulo del medio.
    // Es tambien el que Android 12 en adelante muestra girando al abrir la app, asi que
    // conviene que sea la misma hoja inclinada y no otra.
    archivo: "assets/images/android-icon-foreground.png",
    lado: 1024,
    fondo: null,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, ocupa: 0.56 }),
    transparente: true,
  },
  {
    archivo: "assets/images/android-icon-monochrome.png",
    lado: 1024,
    fondo: null,
    svg: hoja({ blade: "#ffffff", veins: "#ffffff", ocupa: 0.56 }),
    transparente: true,
  },
  {
    archivo: "assets/images/favicon.png",
    lado: 96,
    fondo: null,
    svg: hoja({ blade: BLADE_COLOR, veins: VEIN_COLOR, ocupa: 0.9 }),
    transparente: true,
  },
  {
    // La imagen de la pantalla nativa. Va apagada y no en color porque es exactamente el
    // primer cuadro de la animacion: la que dibuja el JS un instante despues arranca asi,
    // y cualquier otra cosa se veria como un parpadeo justo en el cambio de una a otra.
    //
    // Grande porque se muestra casi del ancho de la pantalla, no en miniatura.
    archivo: "assets/images/leaf-mark.png",
    lado: 1024,
    fondo: null,
    svg: hoja({ ...apagada(), ocupa: MARCA_OCUPA }),
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

/*
 * El tamano de la hoja nativa.
 *
 * En leaf-mark.png la hoja parada ocupa `ancho / lado` del cuadrado. La pantalla nativa
 * dibuja ese cuadrado con el ancho que diga imageWidth, asi que para que la hoja salga
 * del mismo tamano que LEAF_SIZE hay que pedir el cuadrado proporcionalmente mas grande.
 */
const splash = readFileSync("src/components/Splash.tsx", "utf8");
const LEAF_SIZE = unNumero("LEAF_SIZE", splash);
const imageWidth = Math.round((LEAF_SIZE * LADO_HOJA) / MARCA_OCUPA / BOX.width);

console.log("");
console.log(`app.json -> expo-splash-screen imageWidth: ${imageWidth}`);
