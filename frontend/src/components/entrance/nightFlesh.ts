import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * La carne de las figuras de la noche: lo que hace que no parezcan cajas.
 *
 * Nada de esto viene de un archivo. Son esferas y cilindros a los que se les mueven los
 * vértices uno por uno (bultos, hundidos, ruido) y telas dibujadas en un canvas acá mismo.
 * Todo corre una sola vez, al armar la noche, y después queda quieto: lo que cuesta es el
 * arranque, no cada cuadro.
 *
 * La regla para que rinda en el celular: muchas piezas, pocos dibujos. Se arma cada parte
 * por separado y se funden todas las que comparten material en una sola malla con `fuse`.
 */

export type Vec = [number, number, number];

/* ---------------- ruido ---------------- */

/** Un número entre 0 y 1 que siempre es el mismo para el mismo punto de la grilla. */
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Ruido suave, sin sorpresas entre partidas: la cara sale igual todas las veces. */
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = ease(x - ix);
  const fy = ease(y - iy);
  const fz = ease(z - iz);
  let sum = 0;
  for (let dz = 0; dz < 2; dz++) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
        sum += weight * hash(ix + dx, iy + dy, iz + dz);
      }
    }
  }
  return sum * 2 - 1;
}

/** Varias capas de ruido, de lo grande a lo fino: bultos con granito encima. */
export function fbm(x: number, y: number, z: number, octaves = 3) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency, z * frequency);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

/* ---------------- deformar ---------------- */

export type Sculpt = (v: THREE.Vector3) => void;

/** Le pasa la mano a cada vértice y vuelve a calcular las normales. */
export function sculpt(geometry: THREE.BufferGeometry, fn: Sculpt) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    fn(v);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Una esfera deformable, centrada en el origen. Se le sueldan los vértices repetidos
 * primero, si no la costura de atrás queda marcada como una cicatriz de luz.
 */
export function blob(radii: Vec, detail: number, fn?: Sculpt) {
  const sphere = new THREE.SphereGeometry(1, detail * 2, detail);
  const geometry = mergeVertices(sphere);
  sphere.dispose();
  geometry.scale(radii[0], radii[1], radii[2]);
  return fn ? sculpt(geometry, fn) : geometry;
}

const away = new THREE.Vector3();

/** Hunde la superficie alrededor de un punto, como apretar con el pulgar. */
export function dent(v: THREE.Vector3, at: Vec, radius: number, depth: number) {
  const distance = Math.hypot(v.x - at[0], v.y - at[1], v.z - at[2]);
  if (distance >= radius) return;
  const strength = ease(1 - distance / radius) * depth;
  const length = v.length() || 1;
  v.multiplyScalar(1 - strength / length);
}

/** Lo mismo al revés: un bulto que empuja desde adentro. */
export function swell(v: THREE.Vector3, at: Vec, radius: number, amount: number) {
  dent(v, at, radius, -amount);
}

/** Un bulto alargado entre dos puntos: sirve para costillas, tendones y venas. */
export function ridge(v: THREE.Vector3, from: Vec, to: Vec, radius: number, amount: number) {
  away.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const lengthSquared = away.lengthSq() || 1;
  const t = Math.max(0, Math.min(1, ((v.x - from[0]) * away.x + (v.y - from[1]) * away.y + (v.z - from[2]) * away.z) / lengthSquared));
  swell(v, [from[0] + away.x * t, from[1] + away.y * t, from[2] + away.z * t], radius, amount);
}

/** Piel que no es lisa: ruido grande para los bultos y ruido fino para el granito. */
export function lumps(v: THREE.Vector3, scale: number, amount: number, seed = 0) {
  const length = v.length() || 1;
  v.multiplyScalar(1 + (fbm(v.x * scale + seed, v.y * scale + seed, v.z * scale + seed, 3) * amount) / length);
}

/* ---------------- piezas ---------------- */

/**
 * Un miembro: cilindro que se afina, se dobla y tiene sus bultos. Cuelga del origen hacia
 * abajo, como los brazos y las piernas de las figuras.
 */
export function limb(
  length: number,
  top: number,
  bottom: number,
  options: { bend?: number; lean?: number; rough?: number; seed?: number; rings?: number; radial?: number } = {}
) {
  const { bend = 0, lean = 0, rough = 0.06, seed = 0, rings = 10, radial = 11 } = options;
  const geometry = mergeVertices(new THREE.CylinderGeometry(1, 1, length, radial, rings));
  sculpt(geometry, (v) => {
    // 0 abajo, 1 arriba.
    const t = v.y / length + 0.5;
    const radius = bottom + (top - bottom) * t;
    const wobble = 1 + fbm(v.x * 22 + seed, v.y * 22 + seed, v.z * 22 + seed, 2) * rough;
    v.x *= radius * wobble;
    v.z *= radius * wobble;
    // El codo o la rodilla: se dobla al medio, y todo el miembro se va para un costado.
    v.x += bend * Math.sin(t * Math.PI) + lean * (1 - t);
  });
  geometry.translate(0, -length / 2, 0);
  return geometry;
}

/** Tela: un paño con caída, pliegues y el borde de abajo comido. */
export function cloth(width: number, height: number, fn?: Sculpt, segments: [number, number] = [9, 12]) {
  const geometry = new THREE.PlaneGeometry(width, height, segments[0], segments[1]);
  return fn ? sculpt(geometry, fn) : geometry;
}

/** Un hilo, un tendón, un chorro: un tubo que sigue una curva. */
export function thread(points: Vec[], radius: number, segments = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, segments, radius, 5, false);
}

/** Junta varias piezas en una sola malla, para no pagar un dibujo por cada hueso. */
export function fuse(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/** Pone una pieza en su lugar antes de fundirla con las demás. */
export function at(geometry: THREE.BufferGeometry, position: Vec, rotation: Vec = [0, 0, 0]) {
  if (rotation[0]) geometry.rotateX(rotation[0]);
  if (rotation[1]) geometry.rotateY(rotation[1]);
  if (rotation[2]) geometry.rotateZ(rotation[2]);
  geometry.translate(position[0], position[1], position[2]);
  return geometry;
}

/* ---------------- texturas dibujadas ---------------- */

/** Azar con semilla: las manchas caen siempre en el mismo lugar. */
export function dice(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

type Paint = (c: CanvasRenderingContext2D, size: number, random: () => number) => void;

/**
 * Una textura dibujada a mano acá adentro. Devuelve `null` donde no hay canvas (las
 * pruebas), y ahí las figuras quedan del color plano de siempre.
 */
export function painted(size: number, seed: number, paint: Paint): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  paint(context, size, dice(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** La misma imagen, pero para el relieve: lo oscuro se hunde. */
export function relief(texture: THREE.CanvasTexture | null) {
  if (!texture) return null;
  const copy = texture.clone();
  copy.colorSpace = THREE.NoColorSpace;
  copy.needsUpdate = true;
  return copy;
}

/** Manchas blandas, del tamaño que se le pida. */
export function blotch(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "transparent");
  c.globalAlpha = alpha;
  c.fillStyle = gradient;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** Una línea que serpentea: venas, fibras de la tela, vetas de la madera. */
export function vein(c: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number, width: number, color: string, alpha: number, random: () => number) {
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineCap = "round";
  let px = x;
  let py = y;
  let heading = angle;
  const steps = 6 + Math.floor(random() * 5);
  for (let i = 0; i < steps; i++) {
    const step = length / steps;
    heading += (random() - 0.5) * 1.1;
    const nx = px + Math.cos(heading) * step;
    const ny = py + Math.sin(heading) * step;
    c.lineWidth = width * (1 - i / steps) + 0.3;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(nx, ny);
    c.stroke();
    px = nx;
    py = ny;
  }
  c.globalAlpha = 1;
}

/**
 * Sangre encima de lo que sea: manchones de borde roto, lo que chorrea de ellos para abajo
 * y el salpicado fino de alrededor. `amount` va de 0 a 1 y es cuánta hay.
 */
export function bleed(c: CanvasRenderingContext2D, size: number, random: () => number, amount: number) {
  if (amount <= 0) return;
  for (let i = 0; i < Math.round(7 * amount); i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.03 + random() * 0.1) * (0.5 + amount);
    c.globalAlpha = 0.45 + random() * 0.45;
    c.fillStyle = random() < 0.5 ? "#3a0604" : "#570c08";
    c.beginPath();
    for (let a = 0; a <= 20; a++) {
      const angle = (a / 20) * Math.PI * 2;
      const wobble = radius * (0.55 + random() * 0.55);
      c.lineTo(x + Math.cos(angle) * wobble, y + Math.sin(angle) * wobble);
    }
    c.fill();
    // Lo que se escurrió antes de secarse, con la gota gorda al final.
    for (let j = 0; j < 2 + Math.floor(random() * 4); j++) {
      const rx = x + (random() - 0.5) * radius * 1.5;
      const long = radius * (0.7 + random() * 2.6);
      const wide = 2 + random() * 5;
      c.globalAlpha = 0.4 + random() * 0.45;
      c.fillRect(rx, y, wide, long);
      c.beginPath();
      c.arc(rx + wide / 2, y + long, wide * 0.8, 0, Math.PI * 2);
      c.fill();
    }
  }
  for (let i = 0; i < Math.round(420 * amount); i++) {
    c.globalAlpha = 0.25 + random() * 0.6;
    c.fillStyle = random() < 0.6 ? "#430705" : "#25100c";
    c.beginPath();
    c.arc(random() * size, random() * size, 0.8 + random() * 3.4, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

/** Gotas que cuelgan, a punto de caer. */
export function drips(anchors: Vec[], random: () => number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, z] of anchors) {
    const long = 0.025 + random() * 0.075;
    parts.push(
      thread(
        [
          [x, y, z],
          [x + (random() - 0.5) * 0.012, y - long * 0.6, z + (random() - 0.5) * 0.008],
          [x, y - long, z],
        ],
        0.0035,
        5
      )
    );
    parts.push(at(blob([0.006, 0.01, 0.006], 6), [x, y - long - 0.005, z]));
  }
  return fuse(parts);
}

/** Una rajadura: va derecho con pequeños quiebres y se abre en ramas. */
export function crack(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  angle: number,
  width: number,
  color: string,
  alpha: number,
  random: () => number,
  branches = 2
) {
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineCap = "round";
  let px = x;
  let py = y;
  let heading = angle;
  const steps = 5 + Math.floor(random() * 6);
  for (let i = 0; i < steps; i++) {
    const step = length / steps;
    heading += (random() - 0.5) * 0.7;
    const nx = px + Math.cos(heading) * step;
    const ny = py + Math.sin(heading) * step;
    c.lineWidth = Math.max(0.4, width * (1 - i / steps));
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(nx, ny);
    c.stroke();
    if (branches > 0 && random() < 0.35) {
      crack(c, nx, ny, length * 0.45, heading + (random() < 0.5 ? -1 : 1) * (0.5 + random()), width * 0.6, color, alpha * 0.85, random, branches - 1);
      c.globalAlpha = alpha;
      c.strokeStyle = color;
    }
    px = nx;
    py = ny;
  }
  c.globalAlpha = 1;
}

/** Porcelana vieja: esmalte amarillo, craquelé, saltaduras y mugre en las grietas. */
export function porcelainTexture(base: string, seed = 31, blood = 0) {
  return painted(512, seed, (c, size, random) => {
    c.fillStyle = base;
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 20; i++) {
      blotch(c, random() * size, random() * size, 40 + random() * 130, ["#b9a878", "#9a8f74", "#c7b9a0"][Math.floor(random() * 3)], 0.12 + random() * 0.2);
    }
    // La red fina del esmalte, y encima las rajaduras grandes con su sombra.
    for (let i = 0; i < 80; i++) crack(c, random() * size, random() * size, 25 + random() * 65, random() * Math.PI * 2, 1, "#8d8271", 0.45, random, 1);
    for (let i = 0; i < 8; i++) crack(c, random() * size, random() * size, 120 + random() * 190, random() * Math.PI * 2, 2.6, "#3b352c", 0.8, random, 3);
    // Saltaduras: donde se voló el esmalte y quedó el bizcocho crudo.
    for (let i = 0; i < 16; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = 4 + random() * 16;
      c.globalAlpha = 0.5 + random() * 0.4;
      c.fillStyle = "#9c907c";
      c.beginPath();
      for (let a = 0; a <= 9; a++) {
        const angle = (a / 9) * Math.PI * 2;
        const edge = radius * (0.5 + random() * 0.7);
        c.lineTo(x + Math.cos(angle) * edge, y + Math.sin(angle) * edge);
      }
      c.fill();
    }
    for (let i = 0; i < 2600; i++) {
      c.globalAlpha = 0.05 + random() * 0.2;
      c.fillStyle = random() < 0.5 ? "#4a4438" : "#ffffff";
      c.fillRect(random() * size, random() * size, 1, 1);
    }
    c.globalAlpha = 1;
    bleed(c, size, random, blood);
  });
}

/** Corteza: vetas que suben, nudos y musgo en las grietas. */
export function barkTexture(base: string, seed = 55, blood = 0) {
  return painted(512, seed, (c, size, random) => {
    c.fillStyle = base;
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 150; i++) {
      const x = random() * size;
      c.globalAlpha = 0.15 + random() * 0.4;
      c.strokeStyle = random() < 0.5 ? "#231a12" : "#6b5a42";
      c.lineWidth = 1 + random() * 5;
      c.beginPath();
      c.moveTo(x, 0);
      for (let y = 0; y <= size; y += 32) c.lineTo(x + Math.sin((y / size) * 6 + i) * 7, y);
      c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const x = random() * size;
      const y = random() * size;
      for (let r = 26; r > 2; r -= 4) {
        c.globalAlpha = 0.25;
        c.strokeStyle = "#1d150e";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(x, y, r, r * 0.6, 0.4, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 26; i++) blotch(c, random() * size, random() * size, 20 + random() * 60, ["#2f3a1e", "#44502a", "#1d2413"][Math.floor(random() * 3)], 0.25 + random() * 0.35);
    bleed(c, size, random, blood);
  });
}

/** Piel: fondo cerúleo, moretones, venas, el granito de los poros y lo que le chorreó. */
export function skinTexture(base: string, seed = 7, blood = 0) {
  return painted(512, seed, (c, size, random) => {
    c.fillStyle = base;
    c.fillRect(0, 0, size, size);
    // Moretones y zonas muertas.
    for (let i = 0; i < 26; i++) {
      const tone = ["#3f2a3a", "#4a4327", "#2f3a35", "#52332c"][Math.floor(random() * 4)];
      blotch(c, random() * size, random() * size, 30 + random() * 90, tone, 0.18 + random() * 0.22);
    }
    // Venas, más oscuras y azuladas.
    for (let i = 0; i < 40; i++) {
      vein(c, random() * size, random() * size, 40 + random() * 90, random() * Math.PI * 2, 2.2, "#2b3a44", 0.16 + random() * 0.14, random);
    }
    // Poros y manchitas, para que la piel no sea un plástico.
    for (let i = 0; i < 5200; i++) {
      c.fillStyle = random() < 0.5 ? "#2b2b28" : "#a9a99a";
      c.globalAlpha = 0.05 + random() * 0.22;
      const r = random() < 0.9 ? 1 : 2;
      c.fillRect(random() * size, random() * size, r, r);
    }
    c.globalAlpha = 1;
    // Rasguños viejos.
    for (let i = 0; i < 14; i++) {
      vein(c, random() * size, random() * size, 30 + random() * 60, random() * Math.PI * 2, 1.4, "#42211d", 0.4, random);
    }
    bleed(c, size, random, blood);
  });
}

/** Tela de hospital: fibra, amarillo viejo, óxido y sangre seca. */
export function clothTexture(base: string, seed = 21, blood = 0.4) {
  return painted(512, seed, (c, size, random) => {
    c.fillStyle = base;
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      c.globalAlpha = 0.05 + random() * 0.08;
      c.fillStyle = random() < 0.5 ? "#ffffff" : "#5d5849";
      c.fillRect(0, random() * size, size, 1);
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 22; i++) {
      blotch(c, random() * size, random() * size, 40 + random() * 110, ["#6b5a33", "#4a3b22", "#7a6a4a"][Math.floor(random() * 3)], 0.2 + random() * 0.25);
    }
    for (let i = 0; i < 6; i++) {
      blotch(c, random() * size, random() * size, 26 + random() * 70, "#3a0806", 0.3 + random() * 0.3);
    }
    c.globalAlpha = 1;
    bleed(c, size, random, blood);
  });
}
