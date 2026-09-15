/**
 * Separa la marca en letras y hojas, para que las hojas se puedan teñir del color de la
 * estación en la pantalla de arranque, como el nombre de la portada de la página.
 *
 *   node scripts/marca.mjs
 *
 * Parte de wordmark.png y wordmark-dark.png, que quedan como originales y no los usa la
 * app. Las hojas están solas en la esquina de arriba a la derecha: todo lo que hay en esa
 * caja es hoja, y eso se confirma comparando las dos imágenes, que tienen las mismas hojas
 * y letras de distinto color. Si alguna vez un píxel de la caja difiere entre las dos, es
 * que una letra se metió adentro y el script se frena en vez de cortarla.
 *
 * Las hojas salen blancas: el color lo pone la app con tintColor. Los nervios son huecos
 * en el original y siguen siéndolo, así que se ve el fondo a través.
 */
import { readFileSync, writeFileSync } from "node:fs";
import pngjs from "pngjs";

const { PNG } = pngjs;
const DIR = "assets/images";

const claro = PNG.sync.read(readFileSync(`${DIR}/wordmark.png`));
const oscuro = PNG.sync.read(readFileSync(`${DIR}/wordmark-dark.png`));
const { width: W, height: H } = claro;

if (oscuro.width !== W || oscuro.height !== H) throw new Error("las dos marcas no miden lo mismo");

const verde = (d, i) => d[i + 3] > 40 && d[i + 1] > d[i] + 40 && d[i + 1] > d[i + 2] + 25;

/* La caja de las hojas, más un margen para el borde suavizado. */
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!verde(claro.data, (y * W + x) * 4)) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
}
const MARGEN = 3;
x0 = Math.max(0, x0 - MARGEN); y0 = Math.max(0, y0 - MARGEN);
x1 = Math.min(W - 1, x1 + MARGEN); y1 = Math.min(H - 1, y1 + MARGEN);

const hojas = new PNG({ width: W, height: H });
hojas.data.fill(0);

for (let y = y0; y <= y1; y++) {
  for (let x = x0; x <= x1; x++) {
    const i = (y * W + x) * 4;
    // Alrededor de las hojas hay una bruma casi transparente (opacidad 2 de 255) del color
    // de las letras de cada imagen, que no se ve. Una letra de verdad es un píxel bien
    // visible que no es verde.
    for (const imagen of [claro, oscuro]) {
      const d = imagen.data;
      if (d[i + 3] > 40 && !(d[i + 1] > d[i] + 10)) throw new Error(`una letra se mete en la caja de las hojas (${x}, ${y})`);
    }

    hojas.data[i] = hojas.data[i + 1] = hojas.data[i + 2] = 255;
    hojas.data[i + 3] = claro.data[i + 3];
    claro.data[i + 3] = 0;
    oscuro.data[i + 3] = 0;
  }
}

writeFileSync(`${DIR}/wordmark-letters.png`, PNG.sync.write(claro));
writeFileSync(`${DIR}/wordmark-letters-dark.png`, PNG.sync.write(oscuro));
writeFileSync(`${DIR}/wordmark-leaves.png`, PNG.sync.write(hojas));

console.log(`hojas en ${x0},${y0} a ${x1},${y1} de ${W}x${H}: escritas wordmark-letters(-dark).png y wordmark-leaves.png`);
