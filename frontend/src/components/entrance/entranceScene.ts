import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import type { Season } from "../../context/SeasonContext";
import { createNight, NIGHTS, type Night, type NightContext, type NightState } from "./nightGame";

/**
 * El fondo del ingreso y del registro: el hall del consultorio visto desde la entrada,
 * armado sobre la primera foto de "Nuestro espacio".
 *
 * Cómo es el lugar, de izquierda a derecha:
 * - El pasillo de los consultorios. Las sillas de espera van en fila sobre una línea, y
 *   donde termina la última empieza la pared que separa el pasillo del hall. Adentro están
 *   los consultorios naranja, turquesa y verde, y al final el cuarto, el que da al jardín.
 *   El pasillo tiene techo bajo; su borde es la viga oscura de arriba a la izquierda en la foto.
 * - El hall, de doble altura, con el techo de vidrio, la escalera flotante contra la pared
 *   derecha y la recepción abajo de la escalera.
 * - Al fondo, la pared de vidrio y el jardín, con su árbol.
 *
 * Se dibuja con el pase pixelado de three a píxel de 2: se nota apenas en los bordes, que
 * además quedan marcados, y eso le saca lo "3D de computadora" a las formas simples. Lo
 * que da el clima es la luz: el sol entra por el techo y pinta la perfilería en el piso,
 * y el pasillo tiene sus spots prendidos.
 *
 * Se mueve poco y lento: al abrir, un paso hacia adentro; después, el árbol y las plantas
 * del jardín con el viento, las nubes y, con mouse, un paralaje leve. Se probó con polvo
 * flotando en la luz y se sacó: pixelado, cada mota era un cuadradito blanco y parecía nieve.
 *
 * Algunas cosas se pueden tocar: las puertas de los consultorios se abren y se vuelven a
 * cerrar solas, la corrediza del jardín se abre y se cierra, la lámpara y el monitor de la
 * recepción se prenden y se apagan, y las plantas, los arbustos y el árbol se sacuden.
 * Afuera es la estación elegida; en modo oscuro es de noche.
 *
 * Y un modo escondido: con `setWalk(true)` la cámara deja de ser un fondo y el hall se
 * recorre en primera persona (ver "caminar", más abajo).
 *
 * Con `horror`, el mismo hall es el escenario de la noche de terror (ver nightGame): de
 * noche siempre, más oscuro, con luces frías que fallan, lluvia y rayos. La silla de la
 * recepción va detrás del escritorio y se puede usar, y en lugar del huevo con flores hay
 * un tablero de luz.
 */

interface Outside {
  skyTop: string;
  horizon: string;
  sun: string;
  grass: string;
  canopy: string;
  bush: string;
  bloom: string | null;
}

/* El árbol del jardín va con los colores de las hojas de la marca: en invierno es una perenne. */
const OUTSIDE: Record<Season, Outside> = {
  primavera: {
    skyTop: "#5fa9dc",
    horizon: "#d6ecf5",
    sun: "#fff1d8",
    grass: "#6fae4f",
    canopy: "#5ea148",
    bush: "#4d8f3d",
    bloom: "#f3a6c0",
  },
  verano: {
    skyTop: "#3f97d6",
    horizon: "#cbe7f4",
    sun: "#ffefcc",
    grass: "#4f9a42",
    canopy: "#3b8a3e",
    bush: "#2f7a36",
    bloom: "#f5d34f",
  },
  otono: {
    skyTop: "#7fa9c9",
    horizon: "#f0dcc0",
    sun: "#ffd6a0",
    grass: "#8e9a48",
    canopy: "#cf7a30",
    bush: "#9a7a34",
    bloom: null,
  },
  invierno: {
    skyTop: "#8eaac0",
    horizon: "#e2e9ed",
    sun: "#eef2ff",
    grass: "#6f8f73",
    canopy: "#2f7a68",
    bush: "#3f6f5c",
    bloom: null,
  },
};

/** Los colores de adentro, sacados de la foto. */
const INSIDE = {
  wall: "#efebe4",
  frame: "#2a2725",
  metal: "#1d1d20",
  oak: "#c19c74",
  desk: "#8a6a4c",
  chair: "#26262a",
  pot: "#dcd6cd",
  trunk: "#5f4636",
  stone: "#bdb8ae",
};

/** Los tres consultorios del pasillo, en orden desde la entrada. */
const DOORS = [
  { z: 0.35, color: "#b0602e" },
  { z: -1.55, color: "#1f6a6e", glossy: true },
  { z: -3.45, color: "#94a63c" },
];

/* ---------------- medidas, en metros ---------------- */

/** La pared de los consultorios. */
const LEFT = -3.4;
/** La línea del pasillo: las sillas adelante, la pared después de la última. */
const HALL_LEFT = -1.5;
const RIGHT = 3.0;
/** La pared con el vano por el que se entra. */
const OPENING_Z = 1.5;
/** La pared de atrás de la entrada, detrás de la cámara. */
const ROOM_Z = 6.8;
/** Donde termina la última silla y empieza la pared del pasillo. */
const PARTITION_Z = -2.6;
/** La pared de vidrio del fondo, la que da al jardín. */
const BACK_Z = -8;
const GARDEN_BACK_Z = -15.5;
const HALL_H = 6.2;
const ROOM_H = 3.6;
const OPENING_H = 3.3;
const CORRIDOR_H = 3.0;
const GLASS_LEFT = -1.2;
const GLASS_RIGHT = 1.7;
/** La altura de la puerta de vidrio del jardín, que es donde apoya el techo inclinado. */
const DOOR_TOP = 2.75;
/**
 * El boquete de la pared del pasillo, como una ventana sin vidrio: centrado en la pared,
 * con tres plantas en el alféizar.
 */
const NICHE = { z: (PARTITION_Z + BACK_Z) / 2, width: 1.5, sill: 0.95, lintel: 2.05 };

/**
 * El baño, en el cuarto de la entrada: contra la pared derecha, pegado a la del vano y bien
 * lejos del escritorio. `back` es la pared de la puerta, la que da a la recepción, y
 * `front` la del fondo, hacia la calle. Solo se arma en la noche de terror, que es la única
 * que necesita un lugar donde meterse; de día el hall es el de la foto.
 */
const BATH = { left: 1.2, back: OPENING_Z + 0.22, front: OPENING_Z + 3.7, height: 3.1, doorX: 2.14, doorWidth: 1.05, doorH: 2.85 };

/** Dónde termina el balconcito de arriba de la escalera, del lado del hall. */
const BALCONY_FRONT = 0.2;

/** Cuántos píxeles de pantalla mide cada píxel del dibujo: apenas pixelado. */
const PIXEL_SIZE = 2;

/* ---------------- la cámara ---------------- */

/** Donde queda parada: bajo el marco del vano, a la altura de los ojos, como en la foto. */
const REST = new THREE.Vector3(0.4, 1.45, 2.9);
/** Donde arranca el paso hacia adentro. */
const START_Z = 5.4;
/** A dónde mira: derecho a la puerta del jardín, apenas hacia arriba por el techo de vidrio. */
const LOOK = new THREE.Vector3(0.4, 2.1, BACK_Z);
const WALK_IN_S = 3.6;
/**
 * Dónde cae el punto de fuga en una pantalla ancha, como fracción del ancho. La tarjeta
 * tapa el centro, que es justo donde está la puerta del jardín: corrido a la derecha, el
 * fondo del hall queda a la vista al costado de la tarjeta y el pasillo ocupa la izquierda.
 */
const VANISHING_X = 0.75;

/* ---------------- caminando ---------------- */

/** La altura de los ojos de quien camina. */
const EYE = 1.55;
/** Lo que ocupa el cuerpo: más cerca de una pared o un mueble no se llega. */
const BODY = 0.28;
const WALK_SPEED = 2.2;
/** Con las flechas de los costados, para quien no usa el mouse. En radianes por segundo. */
const TURN_SPEED = 1.8;
/** Hasta dónde llega la mano con la E. */
const REACH = 2.6;
/** Lo que tarda la cámara en pasar de fondo a caminar, y de vuelta. */
const BLEND_S = 1.6;
const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);

/** Un azar con semilla: el consultorio sale igual cada vez que se abre. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * El viento del jardín: una brisa que no para y una ráfaga cada once segundos. Mueve el
 * árbol y las plantas, siempre poco: desde adentro, el jardín se ve por el vidrio.
 */
function wind(t: number, phase: number): number {
  const cycle = t % 11;
  const gust = cycle < 3 ? Math.sin((cycle / 3) * Math.PI) : 0;
  return Math.sin(t * 0.8 + phase) * 0.4 + Math.sin(t * 1.9 + phase * 1.7) * 0.2 + gust * 0.8;
}

/** Un manojo de hojas: una esfera lisa y un poco abollada. Varios juntos hacen una copa o un arbusto. */
function leafClump(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 20, 14);
  const position = geometry.attributes.position;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    const bump = 1 + 0.08 * Math.sin(point.x * 5.1 + point.y * 2.3) * Math.sin(point.z * 4.7 - point.y * 3.1);
    point.multiplyScalar(bump);
    point.y *= 0.88;
    position.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** El piso de la foto: tablas largas de madera gris oscura, a lo largo del hall. */
function plankTexture() {
  return canvasTexture(512, 512, (ctx) => {
    const rand = seeded(7);
    const columns = 8;
    const width = 512 / columns;
    for (let column = 0; column < columns; column++) {
      const x = column * width;
      let y = -rand() * 256;
      while (y < 512) {
        const length = 180 + rand() * 220;
        const lightness = 25 + rand() * 9;
        ctx.fillStyle = `hsl(28 7% ${lightness}%)`;
        ctx.fillRect(x, y, width, length);
        ctx.strokeStyle = `hsl(28 9% ${lightness - 5}% / 0.5)`;
        ctx.lineWidth = 1;
        for (let grain = 0; grain < 4; grain++) {
          const gx = x + 6 + rand() * (width - 12);
          ctx.beginPath();
          ctx.moveTo(gx, y);
          ctx.lineTo(gx + (rand() - 0.5) * 6, y + length);
          ctx.stroke();
        }
        ctx.fillStyle = "rgb(0 0 0 / 0.55)";
        ctx.fillRect(x, y, width, 2);
        y += length;
      }
      ctx.fillStyle = "rgb(0 0 0 / 0.5)";
      ctx.fillRect(x, 0, 2, 512);
    }
  });
}

/** Un revoque apenas irregular: con las paredes lisas, el hall parecía una maqueta. */
function plasterTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const rand = seeded(11);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 234 + Math.floor(rand() * 21);
      ctx.fillStyle = `rgb(${v} ${v} ${v})`;
      ctx.fillRect(Math.floor(rand() * 256), Math.floor(rand() * 256), 1 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 3));
    }
  });
}

/**
 * El huevo de la pared derecha, parado: una elipse más angosta arriba que abajo. Va en un
 * cuadrado de lado 1 centrado en el origen, y se estira al tamaño que lleva.
 */
function eggShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const x = 0.5 * Math.cos(angle) * (1 - 0.14 * Math.sin(angle));
    const y = 0.5 * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Lo que hay adentro del huevo: tres flores iguales, medio grandes, una al lado de la otra. */
function flowersTexture() {
  return canvasTexture(160, 216, (ctx) => {
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(0, 0, 160, 216);

    for (const x of [45, 80, 115]) {
      const headY = 88;

      ctx.strokeStyle = "#5f7f4e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, headY);
      ctx.lineTo(x, 180);
      ctx.stroke();

      ctx.fillStyle = "#6f8f5a";
      ctx.beginPath();
      ctx.ellipse(x + 7, 140, 8, 3.5, -0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#c8775a";
      for (let petal = 0; petal < 6; petal++) {
        const angle = (petal / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(angle) * 9, headY + Math.sin(angle) * 9, 8.5, 5, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#e9c46a";
      ctx.beginPath();
      ctx.arc(x, headY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export interface Entrance {
  /** El tamaño del lugar a cubrir, en píxeles de pantalla. */
  resize(width: number, height: number): void;
  /**
   * Un cuadro, con la hora en segundos. Devuelve true mientras hay un movimiento que pide
   * más cuadros por segundo (el paso hacia adentro, la cámara siguiendo al mouse).
   */
  render(seconds: number): boolean;
  /** Un cuadro quieto, ya adentro, para quien pidió menos movimiento. */
  renderStill(): void;
  /** Pasa a caminar o vuelve a ser fondo. Con `instant`, sin el viaje de la cámara. */
  setWalk(on: boolean, instant?: boolean): void;
  /** Las órdenes de la pantalla de la noche de terror: cambiar de cámara o bajarlas. */
  nightCommand(name: "cam" | "close" | "start", value?: number): void;
  dispose(): void;
}

/** Devuelve null si el navegador no puede con WebGL: la página queda lisa y listo. */
export function createEntrance(
  canvas: HTMLCanvasElement,
  {
    season,
    night: nightTheme,
    walkIn,
    centered = false,
    horror = false,
    nightLevel = 0,
    onAim,
    onNight,
  }: {
    season: Season;
    night: boolean;
    walkIn: boolean;
    centered?: boolean;
    horror?: boolean;
    /** Qué noche de terror se juega, desde 0. */
    nightLevel?: number;
    /**
     * Caminando, avisa qué se puede usar con la E de lo que queda en la mira: su nombre, o
     * "" si no tiene uno. Con null, nada.
     */
    onAim?: (label: string | null) => void;
    /** En la noche de terror, cada cambio de lo que muestra la pantalla. */
    onNight?: (state: NightState) => void;
  }
): Entrance | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch {
    return null;
  }
  // El pase pixelado ya agranda los píxeles: dibujar a la densidad de la pantalla sería
  // pagar de más por lo mismo. El CSS del lienzo agranda sin suavizar.
  renderer.setPixelRatio(1);
  // El mapeo "neutro" respeta los colores tal como se eligieron: con el de cine, la madera
  // y las puertas salían lavadas.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const night = nightTheme || horror;
  // La cuarta y la quinta noche de terror son rojas: la niebla, el cielo y todas las luces.
  const blood = horror && (NIGHTS[nightLevel]?.blood ?? false);
  // La sexta y la séptima, con el consultorio ya cerrado: polvo, una niebla sucia y verdosa.
  const abandoned = horror && (NIGHTS[nightLevel]?.abandoned ?? false);
  const outside = OUTSIDE[season];
  const rand = seeded(20240);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  const scene = new THREE.Scene();

  // Un ambiente de estudio para los reflejos: sin él, el piso y el vidrio quedan opacos.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  scene.environment = keep(pmrem.fromScene(studio, 0.04).texture);
  scene.environmentIntensity = horror ? 0.02 : night ? 0.12 : 0.45;
  if (horror) scene.fog = new THREE.FogExp2(blood ? "#1c0304" : abandoned ? "#0c0e09" : "#05070b", blood ? 0.07 : abandoned ? 0.065 : 0.05);
  studio.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 400);
  camera.position.set(REST.x, REST.y, walkIn ? START_Z : REST.z);
  camera.lookAt(LOOK);

  /* ---------------- materiales y piezas ---------------- */

  const standard = (color: string, params: THREE.MeshStandardMaterialParameters = {}) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...params }));

  const plaster = plasterTexture();
  if (plaster) keep(plaster);
  const wall = standard(INSIDE.wall, { roughness: 0.95, map: plaster });
  const frame = standard(INSIDE.frame, { roughness: 0.55, metalness: 0.25 });
  const metal = standard(INSIDE.metal, { roughness: 0.4, metalness: 0.6 });
  const oak = standard(INSIDE.oak, { roughness: 0.7 });
  const deskWood = standard(INSIDE.desk, { roughness: 0.6 });
  const upholstery = standard(INSIDE.chair, { roughness: 0.5 });
  const potMaterial = standard(INSIDE.pot, { roughness: 0.8 });
  const paper = standard("#f4f1ea", { roughness: 0.9 });
  const glass = keep(
    new THREE.MeshStandardMaterial({
      color: "#dcecf1",
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      // De los dos lados: caminando, el vidrio frena también a quien vuelve del jardín.
      side: THREE.DoubleSide,
    })
  );
  const lampGlow = keep(new THREE.MeshBasicMaterial({ color: "#fff1d6" }));
  // Algunas cosas tienen una caja invisible más grande que ellas para tocarlas: la lámpara o
  // la hoja de vidrio de la puerta son demasiado finas para acertarles con el mouse.
  const hitArea = keep(new THREE.MeshBasicMaterial());

  const unitBox = keep(new THREE.BoxGeometry(1, 1, 1));
  const unitCylinder = keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
  const clumpGeometry = keep(leafClump());

  function add<T extends THREE.Object3D>(object: T, parent: THREE.Object3D = scene): T {
    parent.add(object);
    return object;
  }

  /** Una caja, dada por su tamaño y su centro. Casi todo el hall está hecho de esto. */
  function block(material: THREE.Material, size: [number, number, number], at: [number, number, number], parent?: THREE.Object3D) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(...size);
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return add(mesh, parent);
  }

  function rod(material: THREE.Material, radius: number, length: number, at: [number, number, number], parent?: THREE.Object3D) {
    const mesh = new THREE.Mesh(unitCylinder, material);
    mesh.scale.set(radius * 2, length, radius * 2);
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return add(mesh, parent);
  }

  /** La caja invisible para tocar algo: no se dibuja ni hace sombra, pero el puntero la encuentra. */
  function hitBox(size: [number, number, number], at: [number, number, number], parent: THREE.Object3D) {
    const mesh = block(hitArea, size, at, parent);
    mesh.visible = false;
    return mesh;
  }

  /** Un vidrio: no hace sombra, que es justamente lo que deja entrar el sol. */
  function pane(width: number, height: number, at: [number, number, number], rotationX = 0) {
    const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(width, height)), glass);
    mesh.position.set(...at);
    mesh.rotation.x = rotationX;
    return add(mesh);
  }

  /** El zócalo oscuro al pie de una pared: el detalle chico que hace que una pared sea una pared. */
  function baseboard(size: [number, number, number], at: [number, number, number]) {
    const mesh = block(frame, size, at);
    mesh.castShadow = false;
    return mesh;
  }

  /** Un spot de techo: el disquito de luz. La luz de verdad la ponen unas pocas luces aparte. */
  const spotGeometry = keep(new THREE.CircleGeometry(0.08, 16));
  function spot(x: number, y: number, z: number) {
    const disc = add(new THREE.Mesh(spotGeometry, lampGlow));
    disc.position.set(x, y, z);
    disc.rotation.x = Math.PI / 2;
  }

  /**
   * Lo que el viento mueve: se inclina desde la base, cada uno con su fase. `kick` es la
   * sacudida de cuando se lo toca, que se va apagando sola.
   */
  interface Sway {
    object: THREE.Object3D;
    phase: number;
    amount: number;
    kick: number;
  }
  const swaying: Sway[] = [];
  function sway(object: THREE.Object3D, phase: number, amount: number): Sway {
    const entry = { object, phase, amount, kick: 0 };
    swaying.push(entry);
    return entry;
  }

  /* ---------------- piso ---------------- */

  const width = RIGHT - LEFT;
  const floorLength = ROOM_Z - BACK_Z;
  const planks = plankTexture();
  if (planks) {
    keep(planks);
    planks.wrapS = THREE.RepeatWrapping;
    planks.wrapT = THREE.RepeatWrapping;
    planks.anisotropy = renderer.capabilities.getMaxAnisotropy();
    planks.repeat.set(width / 1.6, floorLength / 1.6);
  }
  const floor = add(
    new THREE.Mesh(keep(new THREE.PlaneGeometry(width, floorLength)), standard(planks ? "#ffffff" : "#4a4643", { map: planks, roughness: 0.42 }))
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((LEFT + RIGHT) / 2, 0, (ROOM_Z + BACK_Z) / 2);
  floor.receiveShadow = true;

  /* ---------------- la entrada, donde está parada la cámara ---------------- */

  // En la noche, la pared del fondo de la entrada viene hasta donde termina el baño: si no,
  // detrás de él quedaba un hueco sin nada.
  const roomZ = horror ? BATH.front + 0.07 : ROOM_Z;
  const roomDepth = roomZ - OPENING_Z;
  const roomMid = (roomZ + OPENING_Z) / 2;
  const midX = (LEFT + RIGHT) / 2;
  block(wall, [0.2, ROOM_H, roomDepth], [LEFT - 0.1, ROOM_H / 2, roomMid]);
  block(wall, [0.2, ROOM_H, roomDepth], [RIGHT + 0.1, ROOM_H / 2, roomMid]);
  block(wall, [width + 0.4, 0.2, roomDepth], [midX, ROOM_H + 0.1, roomMid]);
  block(wall, [width + 0.4, ROOM_H, 0.2], [midX, ROOM_H / 2, roomZ + 0.1]);

  // El vano, con su marco oscuro.
  const pier = 0.3;
  block(wall, [width + 0.4, HALL_H - OPENING_H, 0.3], [midX, (HALL_H + OPENING_H) / 2, OPENING_Z]);
  block(wall, [pier, OPENING_H, 0.3], [LEFT + pier / 2, OPENING_H / 2, OPENING_Z]);
  block(frame, [0.09, OPENING_H, 0.36], [LEFT + pier + 0.045, OPENING_H / 2, OPENING_Z]);
  block(frame, [width - pier, 0.14, 0.36], [(LEFT + pier + RIGHT) / 2, OPENING_H - 0.07, OPENING_Z]);

  /* ---------------- el pasillo de los consultorios ---------------- */

  const hallDepth = OPENING_Z - BACK_Z;
  const hallMid = (OPENING_Z + BACK_Z) / 2;
  const corridorMidX = (LEFT + HALL_LEFT) / 2;
  const corridorWidth = HALL_LEFT - LEFT;

  block(wall, [corridorWidth, 0.3, hallDepth], [corridorMidX, CORRIDOR_H + 0.15, hallMid]);
  // La viga oscura del borde del techo del pasillo: la raya negra de la foto, arriba a la izquierda.
  // Más gruesa que la pared del pasillo a propósito: con el mismo espesor, las dos caras
  // quedaban en el mismo plano y la placa de video las alternaba, con manchas en el borde.
  block(frame, [0.22, 0.32, hallDepth], [HALL_LEFT, CORRIDOR_H + 0.1, hallMid]);
  // Encima, la pared del hall sube hasta el techo de vidrio.
  block(wall, [0.2, HALL_H - CORRIDOR_H - 0.26, hallDepth], [HALL_LEFT - 0.02, (HALL_H + CORRIDOR_H + 0.26) / 2, hallMid]);

  // La pared que forma el pasillo, desde la última silla hasta el fondo, armada alrededor
  // del boquete: un paño a cada lado, uno abajo y uno arriba.
  const partitionDepth = PARTITION_Z - BACK_Z;
  const nicheFront = NICHE.z + NICHE.width / 2;
  const nicheBack = NICHE.z - NICHE.width / 2;
  block(wall, [0.16, CORRIDOR_H, PARTITION_Z - nicheFront], [HALL_LEFT, CORRIDOR_H / 2, (PARTITION_Z + nicheFront) / 2]);
  block(wall, [0.16, CORRIDOR_H, nicheBack - BACK_Z], [HALL_LEFT, CORRIDOR_H / 2, (nicheBack + BACK_Z) / 2]);
  block(wall, [0.16, NICHE.sill, NICHE.width], [HALL_LEFT, NICHE.sill / 2, NICHE.z]);
  block(wall, [0.16, CORRIDOR_H - NICHE.lintel, NICHE.width], [HALL_LEFT, (CORRIDOR_H + NICHE.lintel) / 2, NICHE.z]);
  block(wall, [0.26, 0.04, NICHE.width + 0.06], [HALL_LEFT + 0.02, NICHE.sill + 0.02, NICHE.z]);
  block(frame, [0.22, CORRIDOR_H, 0.12], [HALL_LEFT, CORRIDOR_H / 2, PARTITION_Z]);
  baseboard([0.02, 0.08, partitionDepth], [HALL_LEFT + 0.09, 0.04, (PARTITION_Z + BACK_Z) / 2]);

  // El fondo del pasillo, con la puerta del cuarto consultorio, el que da al jardín.
  block(wall, [corridorWidth, CORRIDOR_H, 0.2], [corridorMidX, CORRIDOR_H / 2, BACK_Z - 0.1]);
  block(standard("#6e4e38", { roughness: 0.6 }), [0.95, 2.35, 0.05], [corridorMidX, 1.175, BACK_Z + 0.03]);
  block(frame, [1.05, 0.05, 0.07], [corridorMidX, 2.38, BACK_Z + 0.04]);

  // Las puertas de la pared izquierda, con su marco y su manija. Se abren al tocarlas y se
  // cierran solas al rato; detrás está el consultorio.
  const doorWidth = 0.95;
  const doorHeight = 2.35;
  let clock = 0;

  // La pared de los consultorios, con un hueco por puerta: los paños de entre medio y un
  // dintel arriba de cada hueco. DOORS va de la entrada hacia el fondo.
  let wallFrom = OPENING_Z;
  for (const door of DOORS) {
    const top = door.z + doorWidth / 2;
    block(wall, [0.2, CORRIDOR_H, wallFrom - top], [LEFT - 0.1, CORRIDOR_H / 2, (wallFrom + top) / 2]);
    block(wall, [0.2, CORRIDOR_H - doorHeight, doorWidth], [LEFT - 0.1, (CORRIDOR_H + doorHeight) / 2, door.z]);
    wallFrom = door.z - doorWidth / 2;
  }
  block(wall, [0.2, CORRIDOR_H, wallFrom - BACK_Z], [LEFT - 0.1, CORRIDOR_H / 2, (wallFrom + BACK_Z) / 2]);

  // Adentro de cada consultorio: paredes blancas con luz propia, piso de madera clara, un
  // escritorio contra la pared del fondo y una silla. Con la puerta abierta tiene que verse
  // un consultorio y no un agujero negro, que parecía de película de terror.
  const roomDepth2 = 2.4;
  const roomBackX = LEFT - 0.2 - roomDepth2;
  const roomMidX = LEFT - 0.2 - roomDepth2 / 2;
  const roomWall = standard(INSIDE.wall, { roughness: 0.95, map: plaster, emissive: "#fff4e6", emissiveIntensity: horror ? 0.03 : 0.35 });
  const roomFloor = standard("#b8a189", { roughness: 0.7 });
  for (const door of DOORS) {
    block(roomWall, [0.1, CORRIDOR_H, 1.8], [roomBackX - 0.05, CORRIDOR_H / 2, door.z]);
    for (const side of [-1, 1]) block(roomWall, [roomDepth2, CORRIDOR_H, 0.1], [roomMidX, CORRIDOR_H / 2, door.z + side * 0.9]);
    block(roomWall, [roomDepth2, 0.1, 1.8], [roomMidX, CORRIDOR_H + 0.05, door.z]);
    block(roomFloor, [roomDepth2, 0.02, 1.8], [roomMidX, 0.01, door.z]);
    // En la noche de terror, un tubo frío y débil: lo justo para que la cámara vea algo.
    if (horror) add(new THREE.PointLight(blood ? "#c25050" : "#8fa6c8", 0.6, 0, 2)).position.set(roomMidX, CORRIDOR_H - 0.3, door.z);

    block(deskWood, [0.62, 0.04, 1.1], [roomBackX + 0.36, 0.74, door.z]);
    for (const side of [-1, 1]) block(deskWood, [0.58, 0.72, 0.04], [roomBackX + 0.36, 0.36, door.z + side * 0.52]);
    block(paper, [0.22, 0.02, 0.3], [roomBackX + 0.4, 0.77, door.z - 0.2]);

    const chair = add(new THREE.Group());
    chair.position.set(roomBackX + 1.05, 0, door.z + 0.1);
    block(upholstery, [0.44, 0.06, 0.44], [0, 0.46, 0], chair);
    block(upholstery, [0.05, 0.54, 0.42], [0.2, 0.73, 0], chair);
    for (const [dx, dz] of [
      [-0.18, -0.18],
      [-0.18, 0.18],
      [0.18, -0.18],
      [0.18, 0.18],
    ]) {
      block(metal, [0.025, 0.45, 0.025], [dx, 0.225, dz], chair);
    }
  }
  const swingingDoors: { hinge: THREE.Group; open: number; target: number; closeAt: number }[] = [];
  for (const door of DOORS) {
    const material = standard(door.color, door.glossy ? { roughness: 0.2, metalness: 0.15 } : { roughness: 0.6 });
    const half = doorWidth / 2;
    block(frame, [0.07, 2.42, 0.05], [LEFT + 0.03, 1.21, door.z + half + 0.025]);
    block(frame, [0.07, 2.42, 0.05], [LEFT + 0.03, 1.21, door.z - half - 0.025]);
    block(frame, [0.07, 0.05, doorWidth + 0.1], [LEFT + 0.03, 2.4, door.z]);

    // La bisagra va del lado del fondo: abierta, la hoja gira hacia el pasillo y hacia quien mira.
    const hinge = add(new THREE.Group());
    hinge.position.set(LEFT + 0.035, 0, door.z - half);
    block(material, [0.05, 2.35, doorWidth], [0, 1.175, half], hinge);
    block(metal, [0.06, 0.03, 0.14], [0.05, 1.05, doorWidth - 0.12], hinge);

    const state = { hinge, open: 0, target: 0, closeAt: 0 };
    swingingDoors.push(state);
    hinge.userData.onTouch = () => {
      state.target = state.target ? 0 : 1;
      state.closeAt = clock + 5;
    };
  }
  baseboard([0.02, 0.08, hallDepth], [LEFT + 0.01, 0.04, hallMid]);

  // Los spots del techo del pasillo, prendidos también de día: es un pasillo sin ventanas.
  for (let z = OPENING_Z - 0.8; z > BACK_Z; z -= 1.6) spot(corridorMidX, CORRIDOR_H - 0.005, z);
  const flickering: THREE.PointLight[] = [];
  for (const z of [0.2, -2.6, -5.6]) {
    const light = add(new THREE.PointLight(blood ? "#ff5a48" : horror ? "#b9c6dd" : "#ffd7a8", horror ? 0.9 : night ? 6 : 2.4, 0, 2));
    light.position.set(corridorMidX, CORRIDOR_H - 0.3, z);
    flickering.push(light);
  }

  // Las tres sillas de espera, en fila sobre la línea del pasillo, mirando al hall. La
  // pared del pasillo empieza justo detrás de la última.
  for (let i = 0; i < 3; i++) {
    const z = PARTITION_Z + 0.32 + i * 0.62;
    const seat = add(new THREE.Group());
    seat.position.set(HALL_LEFT - 0.3, 0, z);
    // El respaldo nace del asiento y se inclina desde abajo: separados, pixelados, parecían
    // dos piezas sueltas.
    block(upholstery, [0.44, 0.06, 0.44], [0, 0.46, 0], seat);
    const backrest = add(new THREE.Group(), seat);
    backrest.position.set(-0.195, 0.46, 0);
    backrest.rotation.z = -0.08;
    block(upholstery, [0.05, 0.54, 0.42], [0, 0.27, 0], backrest);
    for (const [dx, dz] of [
      [-0.18, -0.18],
      [-0.18, 0.18],
      [0.18, -0.18],
      [0.18, 0.18],
    ]) {
      block(metal, [0.025, 0.45, 0.025], [dx, 0.225, dz], seat);
    }
  }

  /* ---------------- el hall ---------------- */

  block(wall, [0.2, HALL_H, hallDepth], [RIGHT + 0.1, HALL_H / 2, hallMid]);
  baseboard([0.02, 0.08, hallDepth + roomDepth], [RIGHT - 0.01, 0.04, (roomZ + BACK_Z) / 2]);

  // El fondo: la puerta de vidrio del jardín entre dos paños de pared, solo hasta la altura
  // de la puerta. Más arriba no hay pared: ahí apoya el techo de vidrio que baja en diagonal.
  const hallWidth = RIGHT - HALL_LEFT;
  const hallMidX = (HALL_LEFT + RIGHT) / 2;
  block(wall, [GLASS_LEFT - HALL_LEFT, DOOR_TOP, 0.2], [(HALL_LEFT + GLASS_LEFT) / 2, DOOR_TOP / 2, BACK_Z - 0.1]);
  block(wall, [RIGHT - GLASS_RIGHT, DOOR_TOP, 0.2], [(RIGHT + GLASS_RIGHT) / 2, DOOR_TOP / 2, BACK_Z - 0.1]);
  // La salida al jardín: una puerta corrediza a la izquierda y un paño fijo a la derecha,
  // con la franja del medio. Al tocarla, la hoja corre por delante del paño fijo.
  const glassMid = (GLASS_LEFT + GLASS_RIGHT) / 2;
  const leafWidth = glassMid - GLASS_LEFT;
  block(frame, [0.07, DOOR_TOP, 0.2], [GLASS_LEFT, DOOR_TOP / 2, BACK_Z - 0.1]);
  block(frame, [0.07, DOOR_TOP, 0.2], [GLASS_RIGHT, DOOR_TOP / 2, BACK_Z - 0.1]);
  block(frame, [GLASS_RIGHT - GLASS_LEFT, 0.06, 0.2], [glassMid, 0.03, BACK_Z - 0.1]);
  pane(GLASS_RIGHT - glassMid, DOOR_TOP, [glassMid + leafWidth / 2, DOOR_TOP / 2, BACK_Z - 0.15]);
  block(frame, [0.1, DOOR_TOP, 0.06], [glassMid, DOOR_TOP / 2, BACK_Z - 0.15]);

  const slider = add(new THREE.Group());
  const sliderClosedX = GLASS_LEFT + leafWidth / 2;
  slider.position.set(sliderClosedX, 0, BACK_Z - 0.05);
  const sliderGlass = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(leafWidth, DOOR_TOP)), glass), slider);
  sliderGlass.position.y = DOOR_TOP / 2;
  for (const dx of [-leafWidth / 2 + 0.03, leafWidth / 2 - 0.03]) block(frame, [0.06, DOOR_TOP - 0.06, 0.05], [dx, DOOR_TOP / 2, 0], slider);
  block(frame, [leafWidth, 0.06, 0.05], [0, DOOR_TOP - 0.05, 0], slider);
  block(frame, [leafWidth, 0.06, 0.05], [0, 0.08, 0], slider);
  block(metal, [0.03, 0.45, 0.05], [leafWidth / 2 - 0.12, 1.1, 0.03], slider);
  hitBox([leafWidth, DOOR_TOP, 0.04], [0, DOOR_TOP / 2, 0], slider);
  const gardenDoor = { open: 0, target: 0 };
  slider.userData.onTouch = () => {
    gardenDoor.target = gardenDoor.target ? 0 : 1;
  };
  // Caminando, la E sobre el paño fijo también abre la corrediza: yendo derecho al jardín
  // es lo que queda en la mira. Como fondo no cuenta, así el clic a través del vidrio sigue
  // llegando al árbol.
  const fixedPane = hitBox([leafWidth, DOOR_TOP, 0.04], [glassMid + leafWidth / 2, DOOR_TOP / 2, BACK_Z - 0.15], scene);
  fixedPane.userData.walkOnly = true;
  fixedPane.userData.onTouch = slider.userData.onTouch;
  // La viga donde se juntan la puerta y el techo: la línea oscura que cruza la foto a esa altura.
  block(frame, [hallWidth, 0.16, 0.18], [hallMidX, DOOR_TOP, BACK_Z - 0.1]);

  // El techo de vidrio, en diagonal: arranca arriba, sobre el vano de la entrada, y baja
  // hasta la puerta del jardín. Las vigas hacen sombra: son las rayas que el sol pinta en
  // el piso. Se arma acostado en un grupo y se inclina el grupo entero.
  const roofDrop = HALL_H - DOOR_TOP;
  const roofLength = Math.hypot(roofDrop, hallDepth);
  const roof = add(new THREE.Group());
  roof.position.set(hallMidX, (HALL_H + DOOR_TOP) / 2, hallMid);
  roof.rotation.x = -Math.atan2(roofDrop, hallDepth);
  const roofGlass = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(hallWidth, roofLength)), glass), roof);
  roofGlass.rotation.x = Math.PI / 2;
  for (let x = -hallWidth / 2 + 1.12; x < hallWidth / 2 - 0.4; x += 1.12) block(frame, [0.07, 0.16, roofLength], [x, 0, 0], roof);
  for (let i = 0; i <= 8; i++) block(frame, [hallWidth, 0.12, 0.07], [0, 0, -roofLength / 2 + (i * roofLength) / 8], roof);
  // Donde el techo toca las paredes, un perfil oscuro como el de la viga: sin él, el vidrio
  // parecía apoyado directo sobre el revoque.
  for (const side of [-1, 1]) block(frame, [0.16, 0.22, roofLength], [side * (hallWidth / 2 - 0.08), 0, 0], roof);

  /* la escalera flotante, contra la pared derecha */
  const steps = 13;
  const rise = 0.34;
  const run = 0.46;
  const firstZ = -6.7;
  const stairX = RIGHT - 0.55;
  for (let i = 0; i < steps; i++) block(oak, [1.02, 0.06, 0.3], [stairX, 0.2 + i * rise, firstZ + i * run]);
  const climb = (steps - 1) * rise;
  const reach = (steps - 1) * run;
  const slope = Math.atan2(climb, reach);
  const stringerLength = Math.hypot(climb, reach) + 0.6;
  const stairMidY = 0.2 + climb / 2 - 0.12;
  const stairMidZ = firstZ + reach / 2;
  for (const x of [stairX - 0.5, stairX + 0.48]) {
    block(metal, [0.05, 0.24, stringerLength], [x, stairMidY, stairMidZ]).rotation.x = -slope;
  }
  block(metal, [0.03, 0.03, stringerLength], [stairX - 0.53, stairMidY + 0.95, stairMidZ]).rotation.x = -slope;
  for (let i = 1; i < steps; i += 2) block(metal, [0.015, 0.9, 0.015], [stairX - 0.53, 0.2 + i * rise + 0.47, firstZ + i * run]);
  block(wall, [1.25, 0.25, 2.4], [RIGHT - 0.625, 0.2 + steps * rise + 0.1, 0.3]);
  const landingTop = 0.2 + steps * rise + 0.225;
  // En la noche, el descanso sigue como un balconcito angosto a lo largo de toda la pared
  // del vano, con su baranda. Desde ahí mira algo, una vez por noche (ver nightGame).
  if (horror) {
    const balconyRight = RIGHT - 1.25;
    const balconyFront = BALCONY_FRONT;
    const balconyDepth = OPENING_Z - 0.15 - balconyFront;
    const balconyMidZ = balconyFront + balconyDepth / 2;
    block(wall, [balconyRight - HALL_LEFT, 0.25, balconyDepth], [(HALL_LEFT + balconyRight) / 2, landingTop - 0.125, balconyMidZ]);
    block(frame, [balconyRight - HALL_LEFT + 0.02, 0.08, 0.04], [(HALL_LEFT + balconyRight) / 2, landingTop - 0.21, balconyFront - 0.01]);
    // La baranda: por el frente del balcón y por el costado del descanso, hasta la escalera.
    const railH = 0.95;
    const railLength = balconyRight - HALL_LEFT;
    block(metal, [railLength, 0.035, 0.035], [(HALL_LEFT + balconyRight) / 2, landingTop + railH, balconyFront + 0.03]);
    block(metal, [railLength, 0.02, 0.02], [(HALL_LEFT + balconyRight) / 2, landingTop + railH / 2, balconyFront + 0.03]);
    for (let x = HALL_LEFT + 0.1; x <= balconyRight + 0.01; x += 0.45) block(metal, [0.02, railH, 0.02], [x, landingTop + railH / 2, balconyFront + 0.03]);
    const sideLength = balconyFront + 0.9;
    block(metal, [0.035, 0.035, sideLength], [balconyRight + 0.02, landingTop + railH, (balconyFront - 0.9) / 2]);
    for (let z = -0.85; z < balconyFront; z += 0.45) block(metal, [0.02, railH, 0.02], [balconyRight + 0.02, landingTop + railH / 2, z]);
  }
  // Debajo de los primeros escalones no hay altura para pasar, pero entre escalón y escalón
  // los rayos de los choques pasaban: una caja escondida que igual frena. Escondida del todo:
  // una que solo no pintaba color dejaba los bordes marcados por el pixelado.
  const underStair = hitBox([0.8, 1.7, 2.45], [RIGHT - 0.4, 0.85, firstZ - 0.15 + 2.45 / 2], scene);
  underStair.userData.collides = true;

  /* la recepción, abajo de la escalera */
  const deskX = RIGHT - 1.15;
  const deskZ = -4.3;
  block(deskWood, [1.2, 0.76, 1.9], [deskX, 0.38, deskZ]);
  block(frame, [1.26, 0.04, 1.96], [deskX, 0.78, deskZ]);
  // El monitor, que se prende y se apaga al tocarlo.
  const monitor = add(new THREE.Group());
  const screenGlow = horror ? 0.35 : night ? 1.4 : 0.35;
  const screen = standard("#0d1520", { emissive: night ? "#bcd4ff" : "#8fb2d9", emissiveIntensity: screenGlow, roughness: 0.3 });
  block(metal, [0.04, 0.34, 0.56], [deskX - 0.3, 1.1, deskZ + 0.1], monitor);
  block(metal, [0.18, 0.02, 0.18], [deskX - 0.27, 0.81, deskZ + 0.1], monitor);
  block(metal, [0.03, 0.2, 0.04], [deskX - 0.29, 0.9, deskZ + 0.1], monitor);
  block(screen, [0.01, 0.3, 0.52], [deskX - 0.275, 1.1, deskZ + 0.1], monitor);
  hitBox([0.22, 0.5, 0.7], [deskX - 0.29, 1.05, deskZ + 0.1], monitor);
  if (!horror) monitor.userData.onTouch = () => {
    screen.emissiveIntensity = screen.emissiveIntensity > 0 ? 0 : screenGlow;
  };
  block(metal, [0.16, 0.02, 0.44], [deskX + 0.05, 0.81, deskZ + 0.1]);
  block(paper, [0.24, 0.02, 0.32], [deskX + 0.1, 0.81, deskZ - 0.55]).rotation.y = 0.2;
  rod(standard("#3f5f58", { roughness: 0.6 }), 0.04, 0.12, [deskX - 0.2, 0.86, deskZ - 0.7]);

  // La lámpara del escritorio: una luz cálida chica, que de noche es la que más se ve. Se
  // prende y se apaga al tocarla.
  const lamp = add(new THREE.Group());
  const shadeGlow = horror ? 0.4 : night ? 0.8 : 0.2;
  const lampPower = horror ? 1.6 : night ? 3 : 0.6;
  const shadeMaterial = standard("#e9e2d4", { roughness: 0.7, emissive: "#ffd9a8", emissiveIntensity: shadeGlow });
  block(metal, [0.12, 0.02, 0.12], [deskX - 0.35, 0.81, deskZ + 0.72], lamp);
  rod(metal, 0.012, 0.42, [deskX - 0.35, 1.02, deskZ + 0.72], lamp);
  rod(shadeMaterial, 0.09, 0.14, [deskX - 0.3, 1.24, deskZ + 0.72], lamp).castShadow = false;
  hitBox([0.4, 0.65, 0.4], [deskX - 0.32, 1.05, deskZ + 0.72], lamp);
  const lampLight = add(new THREE.PointLight(blood ? "#ff8a6a" : "#ffd3a0", lampPower, 0, 2));
  lampLight.position.set(deskX - 0.3, 1.1, deskZ + 0.72);
  lamp.userData.onTouch = () => {
    const on = lampLight.userData.off === true;
    // Queda anotado en la luz y en la pantalla: la noche de terror maneja la intensidad de
    // todas las luces en cada cuadro, y así sabe que esta la apagaron a mano.
    lampLight.userData.off = !on;
    shadeMaterial.userData.off = !on;
    lampLight.intensity = on ? lampPower : 0;
    shadeMaterial.emissiveIntensity = on ? shadeGlow : 0;
  };

  // La silla de la recepción, del otro lado del escritorio.
  const officeChair = add(new THREE.Group());
  // En la noche de terror va detrás del escritorio, derecha, mirando a la computadora.
  if (horror) officeChair.position.set(RIGHT - 0.3, 0, deskZ + 0.1);
  else {
    officeChair.position.set(RIGHT - 0.35, 0, -3.3);
    officeChair.rotation.y = -0.5;
  }
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5;
    block(metal, [0.3, 0.03, 0.04], [Math.cos(angle) * 0.15, 0.06, -Math.sin(angle) * 0.15], officeChair).rotation.y = angle;
  }
  rod(metal, 0.03, 0.4, [0, 0.28, 0], officeChair);
  block(upholstery, [0.5, 0.08, 0.5], [0, 0.5, 0], officeChair);
  block(upholstery, [0.06, 0.8, 0.46], [0.24, 0.98, 0], officeChair).rotation.z = 0.08;
  block(upholstery, [0.3, 0.04, 0.05], [0.05, 0.72, 0.25], officeChair);
  block(upholstery, [0.3, 0.04, 0.05], [0.05, 0.72, -0.25], officeChair);

  /* el huevo de la pared derecha, con sus tres flores */
  // El tablero de la luz, donde de día está el huevo: una caja de metal con una palanca.
  const breaker = add(new THREE.Group());
  const lever = add(new THREE.Group(), breaker);
  if (horror) {
    breaker.position.set(RIGHT - 0.04, 1.45, 0.55);
    const panel = standard("#5b5f63", { roughness: 0.5, metalness: 0.5 });
    block(panel, [0.06, 0.55, 0.4], [0, 0, 0], breaker);
    block(frame, [0.02, 0.42, 0.28], [-0.035, 0, 0], breaker);
    lever.position.set(-0.06, 0, 0);
    lever.rotation.z = 0.6;
    block(standard("#b0312a", { roughness: 0.5 }), [0.04, 0.2, 0.05], [0, 0.1, 0], lever);
    hitBox([0.3, 0.7, 0.55], [-0.1, 0, 0], breaker);
    // Una lucecita roja que no depende de la luz: en el apagón es lo único que se ve.
    block(keep(new THREE.MeshBasicMaterial({ color: "#ff3322" })), [0.02, 0.025, 0.025], [-0.035, 0.22, 0.14], breaker);
  }

  const eggArt = horror ? null : flowersTexture();
  if (eggArt) {
    keep(eggArt);
    // La forma va centrada en el origen y la textura se corre medio lado para que calce.
    eggArt.offset.set(0.5, 0.5);
    const eggGeometry = keep(new THREE.ShapeGeometry(eggShape(), 48));
    const eggWidth = 0.9;
    const eggHeight = 1.22;
    const eggAt = new THREE.Vector3(RIGHT - 0.015, 1.8, 0.55);

    const rim = add(new THREE.Mesh(eggGeometry, deskWood));
    rim.scale.set(eggWidth + 0.07, eggHeight + 0.07, 1);
    rim.position.set(eggAt.x + 0.005, eggAt.y, eggAt.z);
    rim.rotation.y = -Math.PI / 2;

    const egg = add(new THREE.Mesh(eggGeometry, standard("#ffffff", { map: eggArt, roughness: 0.8 })));
    egg.scale.set(eggWidth, eggHeight, 1);
    egg.position.copy(eggAt);
    egg.rotation.y = -Math.PI / 2;
    egg.receiveShadow = true;
  }

  /* ---------------- el baño del hall ---------------- */

  /**
   * Un baño en el cuarto de la entrada, contra la pared derecha y pegado a la del vano. La
   * puerta da a la recepción, de frente a quien está sentado: girar la silla es verla, al
   * fondo del hall. Adentro hay un inodoro, una bacha con espejo y, al final de todo, el
   * cargador de la luz que se lleva encima. Es el único lugar del edificio donde uno se
   * puede encerrar, pero la puerta se abre sola cada tanto (ver nightGame).
   */
  const bathDoor = { hinge: add(new THREE.Group()), open: 0, target: 0, closeAt: Infinity };
  const bathCharger = add(new THREE.Group());
  if (horror) {
    const tile = standard("#b9beba", { roughness: 0.28, metalness: 0.05 });
    const porcelain = standard("#e6e3dc", { roughness: 0.22 });
    const mirrorGlass = standard("#0d1317", { roughness: 0.06, metalness: 0.9 });
    const bathWidth = RIGHT - BATH.left;
    const bathDepth = BATH.front - BATH.back;
    const bathX = (BATH.left + RIGHT) / 2;
    const bathZ = (BATH.front + BATH.back) / 2;
    const half = BATH.doorWidth / 2;
    const doorLeft = BATH.doorX - half;
    const doorRight = BATH.doorX + half;

    // La pared larga, la del fondo y el techo; la de la recepción, partida alrededor de la puerta.
    block(wall, [0.14, BATH.height, bathDepth], [BATH.left, BATH.height / 2, bathZ]);
    block(wall, [bathWidth, BATH.height, 0.14], [bathX, BATH.height / 2, BATH.front]);
    block(wall, [doorLeft - BATH.left, BATH.height, 0.14], [(BATH.left + doorLeft) / 2, BATH.height / 2, BATH.back]);
    block(wall, [RIGHT - doorRight, BATH.height, 0.14], [(RIGHT + doorRight) / 2, BATH.height / 2, BATH.back]);
    block(wall, [BATH.doorWidth, BATH.height - BATH.doorH, 0.14], [BATH.doorX, (BATH.height + BATH.doorH) / 2, BATH.back]);
    block(wall, [bathWidth + 0.2, 0.14, bathDepth + 0.28], [bathX, BATH.height + 0.07, bathZ]);
    block(frame, [0.06, BATH.doorH + 0.06, 0.09], [doorLeft - 0.03, (BATH.doorH + 0.06) / 2, BATH.back - 0.09]);
    block(frame, [0.06, BATH.doorH + 0.06, 0.09], [doorRight + 0.03, (BATH.doorH + 0.06) / 2, BATH.back - 0.09]);
    block(frame, [BATH.doorWidth + 0.12, 0.06, 0.09], [BATH.doorX, BATH.doorH + 0.03, BATH.back - 0.09]);
    baseboard([0.02, 0.08, bathDepth + 0.14], [BATH.left - 0.08, 0.04, bathZ]);
    baseboard([bathWidth, 0.08, 0.02], [bathX, 0.04, BATH.back - 0.08]);

    // Azulejos hasta la mitad y piso claro: sin ellos es una caja de revoque y no un baño.
    const skirt = 1.6;
    block(tile, [0.02, skirt, bathDepth - 0.14], [BATH.left + 0.08, skirt / 2, bathZ]);
    block(tile, [0.02, skirt, bathDepth - 0.14], [RIGHT - 0.01, skirt / 2, bathZ]);
    block(tile, [bathWidth - 0.14, skirt, 0.02], [bathX, skirt / 2, BATH.front - 0.08]);
    block(tile, [bathWidth - 0.2, 0.02, bathDepth - 0.2], [bathX, 0.012, bathZ]).castShadow = false;

    // El inodoro contra la pared larga y la bacha con el espejo contra la derecha.
    const toiletZ = BATH.back + 2.1;
    const sinkZ = BATH.back + 1.2;
    block(porcelain, [0.16, 0.56, 0.42], [BATH.left + 0.18, 0.48, toiletZ]);
    block(porcelain, [0.52, 0.4, 0.36], [BATH.left + 0.42, 0.2, toiletZ]);
    block(porcelain, [0.48, 0.04, 0.38], [BATH.left + 0.44, 0.42, toiletZ]);
    block(porcelain, [0.44, 0.15, 0.5], [RIGHT - 0.24, 0.82, sinkZ]);
    rod(metal, 0.015, 0.16, [RIGHT - 0.38, 0.96, sinkZ]);
    block(frame, [0.02, 0.78, 0.56], [RIGHT - 0.055, 1.56, sinkZ]);
    block(mirrorGlass, [0.03, 0.72, 0.5], [RIGHT - 0.07, 1.56, sinkZ]);

    // El cargador, en la pared del fondo: cargar la luz es meterse hasta el final del baño.
    bathCharger.position.set(BATH.doorX, 1.25, BATH.front - 0.11);
    bathCharger.rotation.y = Math.PI;
    block(standard("#4a4e52", { roughness: 0.5, metalness: 0.5 }), [0.36, 0.48, 0.1], [0, 0, 0], bathCharger);
    block(frame, [0.26, 0.32, 0.02], [0, 0.02, 0.055], bathCharger);
    // La lucecita verde no depende de la luz del edificio: en el apagón es lo que se busca.
    block(keep(new THREE.MeshBasicMaterial({ color: "#5ef08a" })), [0.03, 0.03, 0.02], [0.13, 0.19, 0.055], bathCharger);
    hitBox([0.62, 0.8, 0.3], [0, 0, 0.14], bathCharger);

    // La hoja, con la bisagra del lado de la pared larga: abierta gira hacia la recepción y
    // queda del lado de allá, sin taparle la vista a quien está sentado.
    bathDoor.hinge.position.set(doorLeft, 0, BATH.back - 0.05);
    block(standard("#6e4e38", { roughness: 0.6 }), [BATH.doorWidth, BATH.doorH, 0.05], [half, BATH.doorH / 2, 0], bathDoor.hinge);
    block(metal, [0.14, 0.03, 0.07], [BATH.doorWidth - 0.14, 1.02, -0.05], bathDoor.hinge);

    // Sus dos tubos, que titilan como los del pasillo.
    for (const z of [bathZ + 0.9, bathZ - 0.9]) {
      spot(bathX, BATH.height - 0.005, z);
      const bathLight = add(new THREE.PointLight(blood ? "#ff5a48" : "#b9c6dd", 1.5, 0, 2));
      bathLight.position.set(bathX, BATH.height - 0.35, z);
      flickering.push(bathLight);
    }
  }

  /* plantas en maceta: hojas largas que salen de la base */
  const bladeGeometry = keep(new THREE.ConeGeometry(0.05, 1, 5));
  bladeGeometry.translate(0, 0.5, 0);

  function pottedPlant(x: number, z: number, height: number, leafColor: string, potRadius = 0.2, y = 0) {
    const group = add(new THREE.Group());
    group.position.set(x, y, z);
    rod(potMaterial, potRadius, potRadius * 2.1, [0, potRadius * 1.05, 0], group);
    const leaves = add(new THREE.Group(), group);
    leaves.position.y = potRadius * 2;
    const leafMaterial = standard(leafColor, { roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const leaf = add(new THREE.Mesh(bladeGeometry, leafMaterial), leaves);
      leaf.scale.set(1, height * (0.6 + rand() * 0.5), 1);
      leaf.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI * 2, (rand() - 0.5) * 0.6);
      leaf.castShadow = true;
    }
    const leafSway = sway(leaves, rand() * 6, 0.035);
    group.userData.onTouch = () => {
      leafSway.kick = 1;
    };
    return group;
  }

  pottedPlant(GLASS_LEFT + 0.35, BACK_Z + 0.45, 1.3, "#3f7d45", 0.24);
  pottedPlant(RIGHT - 0.4, -7.3, 1.1, "#4a8a4c");
  pottedPlant(LEFT + 0.35, BACK_Z + 0.4, 0.9, "#3f7d45");
  pottedPlant(LEFT + 0.3, roomZ - 0.6, 1.0, "#467f48");
  // Las tres del boquete de la pared del pasillo, iguales, sobre el alféizar.
  const nichePlants = [-0.5, 0, 0.5].map((dz) => pottedPlant(HALL_LEFT + 0.02, NICHE.z + dz, 0.42, "#4a8a4c", 0.09, NICHE.sill + 0.04));

  /* ---------------- el jardín, del otro lado del vidrio ---------------- */

  const gardenDepth = BACK_Z - GARDEN_BACK_Z;
  const gardenMid = (BACK_Z + GARDEN_BACK_Z) / 2;
  const grass = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(16, gardenDepth)), standard(outside.grass, { roughness: 1 })));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0, gardenMid);
  grass.receiveShadow = true;

  block(wall, [14, 3.2, 0.3], [0, 1.6, GARDEN_BACK_Z]);
  block(wall, [0.3, 3.2, gardenDepth], [-3.4, 1.6, gardenMid]);
  block(wall, [0.3, 3.2, gardenDepth], [3.8, 1.6, gardenMid]);

  const stone = standard(INSIDE.stone, { roughness: 0.9 });
  for (let i = 0; i < 5; i++) block(stone, [0.55, 0.03, 0.34], [0.3 + (i % 2 ? 0.15 : -0.12), 0.015, BACK_Z - 0.7 - i * 0.8]);

  const bushMaterial = standard(outside.bush, { roughness: 0.9 });
  const bloomMaterial = outside.bloom ? standard(outside.bloom, { roughness: 0.6 }) : null;
  const bloomGeometry = keep(new THREE.SphereGeometry(0.06, 8, 6));
  const bushSpots: [number, number][] = [
    [-2.9, -14.9],
    [-2.1, -15.0],
    [-1.1, -14.9],
    [0.2, -15.0],
    [1.4, -14.9],
    [2.9, -14.9],
    [-2.9, -12.5],
    [-2.9, -10.2],
    [3.3, -11.2],
    [3.3, -9.3],
  ];
  // Cada arbusto es un grupo desparejo de manojos chicos, con hojas largas que se escapan
  // por arriba. Un manojo solo, redondo, era un pompón. Se mece entero con el viento.
  const bushLight = standard(outside.canopy, { roughness: 0.9 });
  const bushLeaf = standard(outside.bush, { roughness: 0.75 });
  for (const [x, z] of bushSpots) {
    const bush = add(new THREE.Group());
    bush.position.set(x, 0, z);
    const size = 0.8 + rand() * 0.5;
    const clumps = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < clumps; i++) {
      const clump = add(new THREE.Mesh(clumpGeometry, rand() < 0.35 ? bushLight : bushMaterial), bush);
      const angle = rand() * Math.PI * 2;
      const reach = rand() * 0.38 * size;
      clump.scale.set((0.26 + rand() * 0.16) * size * 1.2, (0.24 + rand() * 0.14) * size, (0.26 + rand() * 0.14) * size);
      clump.position.set(Math.cos(angle) * reach, (0.2 + rand() * 0.3) * size, Math.sin(angle) * reach * 0.7);
      clump.castShadow = true;
      clump.receiveShadow = true;
    }
    for (let i = 0; i < 8; i++) {
      const leaf = add(new THREE.Mesh(bladeGeometry, bushLeaf), bush);
      leaf.scale.set(1, (0.45 + rand() * 0.45) * size, 1);
      leaf.position.set((rand() - 0.5) * 0.5 * size, 0, (rand() - 0.5) * 0.3 * size);
      leaf.rotation.set((rand() - 0.5) * 0.9, rand() * Math.PI * 2, (rand() - 0.5) * 0.9);
    }
    if (bloomMaterial) {
      for (let i = 0; i < 6; i++) {
        const bloom = add(new THREE.Mesh(bloomGeometry, bloomMaterial), bush);
        const angle = rand() * Math.PI * 2;
        bloom.position.set(Math.cos(angle) * 0.35 * size, (0.35 + rand() * 0.35) * size, Math.sin(angle) * 0.25 * size);
      }
    }
    const bushSway = sway(bush, rand() * 6, 0.05);
    bush.userData.onTouch = () => {
      bushSway.kick = 1;
    };
  }

  pottedPlant(2.9, -9.2, 0.9, outside.bush);

  // El árbol: atrás de la puerta de vidrio, con la copa asomando por el techo.
  const trunkMaterial = standard(INSIDE.trunk, { roughness: 0.9 });
  const tree = add(new THREE.Group());
  tree.position.set(0.9, 0, -12.2);
  rod(trunkMaterial, 0.17, 4.8, [0, 2.4, 0], tree).rotation.z = 0.04;
  const canopy = add(new THREE.Group(), tree);
  canopy.position.y = 4.6;
  const canopyMaterial = standard(outside.canopy, { roughness: 0.85 });
  for (let i = 0; i < 10; i++) {
    const clump = add(new THREE.Mesh(clumpGeometry, canopyMaterial), canopy);
    if (i === 0) {
      clump.position.set(0, 1.4, 0);
      clump.scale.setScalar(1.5);
    } else {
      const angle = (i / 9) * Math.PI * 2 + rand() * 0.5;
      clump.position.set(Math.cos(angle) * (1.2 + rand() * 0.6), 0.6 + rand() * 1.6, Math.sin(angle) * 1.1);
      clump.scale.setScalar(0.8 + rand() * 0.45);
    }
    clump.castShadow = true;
  }
  const treeSway = sway(canopy, 1.3, 0.03);
  tree.userData.onTouch = () => {
    treeSway.kick = 1;
  };

  /* ---------------- cielo, nubes y estrellas ---------------- */

  // En la noche de terror, un cielo cerrado de tormenta: casi negro, sin estrellas.
  const skyTop = new THREE.Color(blood ? "#0e0102" : horror ? "#030509" : night ? "#0a1628" : outside.skyTop);
  const skyHorizon = new THREE.Color(blood ? "#3d0507" : horror ? "#0c121c" : night ? "#1f3452" : outside.horizon);

  add(
    new THREE.Mesh(
      keep(new THREE.SphereGeometry(250, 32, 16)),
      keep(
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          toneMapped: false,
          uniforms: {
            top: { value: skyTop },
            horizon: { value: skyHorizon },
          },
          vertexShader: /* glsl */ `
            varying vec3 vDirection;
            void main() {
              vDirection = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform vec3 top;
            uniform vec3 horizon;
            varying vec3 vDirection;
            void main() {
              float t = pow(clamp(vDirection.y, 0.0, 1.0), 0.6);
              gl_FragColor = vec4(mix(horizon, top, t), 1.0);
              #include <colorspace_fragment>
            }
          `,
        })
      )
    )
  );

  const cloudGeometry = keep(new THREE.SphereGeometry(1, 16, 12));
  const cloudMaterial = standard(blood ? "#2a0506" : horror ? "#0e131b" : night ? "#2a3a55" : "#ffffff", {
    emissive: night ? "#000000" : "#ffffff",
    emissiveIntensity: night ? 0 : 0.55,
    roughness: 1,
  });
  const clouds: { group: THREE.Group; speed: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const group = add(new THREE.Group());
    for (let j = 0; j < 5; j++) {
      const puff = add(new THREE.Mesh(cloudGeometry, cloudMaterial), group);
      puff.position.set((j - 2) * 3.4 + rand() * 1.5, rand() * 1.2, rand() * 2);
      puff.scale.set(3.4 + rand() * 2.4, 1.5 + rand() * 0.9, 2.6);
    }
    group.position.set(-70 + i * 26 + rand() * 10, 30 + rand() * 12, -35 - rand() * 45);
    clouds.push({ group, speed: 0.6 + rand() * 0.6 });
  }

  if (night && !horror) {
    const positions: number[] = [];
    for (let i = 0; i < 500; i++) {
      const azimuth = rand() * Math.PI * 2;
      const elevation = 0.25 + rand() * 1.25;
      positions.push(Math.cos(azimuth) * Math.cos(elevation) * 200, Math.sin(elevation) * 200, Math.sin(azimuth) * Math.cos(elevation) * 200);
    }
    const starGeometry = keep(new THREE.BufferGeometry());
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    add(
      new THREE.Points(
        starGeometry,
        keep(new THREE.PointsMaterial({ color: "#e6edf5", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 }))
      )
    );
  }

  /* ---------------- luz ---------------- */

  // El sol entra desde atrás y arriba, por el techo: la perfilería queda dibujada en el
  // piso, hacia la cámara. De noche es la luna, que hace lo mismo más tenue y más fría.
  const sun = add(new THREE.DirectionalLight(blood ? "#c04040" : night ? "#9fb6e0" : outside.sun, horror ? 0.12 : night ? 0.6 : 3.4));
  sun.position.set(-2.5, 14, -11.5);
  sun.target.position.set(0.6, 0, -3);
  add(sun.target);
  sun.castShadow = true;
  const shadowSize = window.innerWidth < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 13, bottom: -13, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;

  const sky = add(
    new THREE.HemisphereLight(blood ? "#4a0a0c" : night ? "#1c2a44" : "#dfe9f3", blood ? "#1a0404" : night ? "#1a140f" : "#5b5046", horror ? 0.07 : night ? 0.35 : 1.05)
  );

  // Un relleno suave desde la entrada: sin él, lo que queda a contraluz es una mancha negra.
  const fill = add(new THREE.DirectionalLight("#fff7ee", horror ? 0.01 : night ? 0.08 : 0.35));
  fill.position.set(1, 3, 10);

  if (horror) {
    // Dos tubos fríos que andan mal, y un farol débil en el jardín.
    for (const z of [-1.5, -5.5]) {
      const light = add(new THREE.PointLight(blood ? "#ff4a3a" : "#a9b8d4", 1.1, 0, 2));
      light.position.set(0.8, 3.4, z);
      flickering.push(light);
    }
    // El farol del jardín, junto a la puerta: lo que se acerque se recorta contra la luz.
    add(new THREE.PointLight(blood ? "#d04a3a" : "#9fb2d0", 2.6, 0, 2)).position.set(0.4, 2.3, BACK_Z - 1.4);
  } else if (night) {
    for (const z of [-1.5, -5.5]) add(new THREE.PointLight("#ffcf9a", 8, 0, 2)).position.set(0.8, 3.4, z);
    add(new THREE.PointLight("#ffd9a0", 6, 0, 2)).position.set(-1.6, 1.2, -11);
  }

  /* ---------------- el pase pixelado ---------------- */

  const composer = new EffectComposer(renderer);
  const pixelPass = new RenderPixelatedPass(PIXEL_SIZE, scene, camera);
  // Sin bordes por profundidad: en cada escalón de una línea en diagonal marcaban un píxel
  // oscuro de más, y la viga del pasillo quedaba como un serrucho. Los de las caras quedan,
  // apenas. Van después de crear el pase porque el constructor toma un 0 como "el de siempre".
  pixelPass.depthEdgeStrength = 0;
  pixelPass.normalEdgeStrength = 0.15;
  composer.addPass(pixelPass);
  composer.addPass(new OutputPass());

  /* ---------------- el mouse ---------------- */

  const pointer = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };
  const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;
  const onPointer = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

  /* ---------------- lo que se puede tocar ---------------- */

  // Las puertas, la lámpara, el monitor y las plantas llevan en userData lo que hacen al
  // tocarlos. Se sube desde lo que quedó bajo el puntero hasta encontrarlo, y lo primero que
  // se toca tapa lo de atrás: una planta detrás de una pared no se sacude. Los vidrios y el
  // cielo no tapan nada.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const seeThrough = (object: THREE.Object3D) => {
    const material = (object as THREE.Mesh).material as THREE.Material | undefined;
    return object instanceof THREE.Points || !material || material.transparent || material instanceof THREE.ShaderMaterial;
  };

  /** Lo que se puede tocar en ese punto de la pantalla (de -1 a 1), hasta `far` metros. */
  function touchNodeAt(x: number, y: number, far = Infinity): THREE.Object3D | null {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    raycaster.far = far;
    for (const hit of raycaster.intersectObjects(scene.children, true)) {
      if (seeThrough(hit.object) || (!walking && hit.object.userData.walkOnly)) continue;
      let passThrough = false;
      for (let node: THREE.Object3D | null = hit.object; node; node = node.parent) {
        if (typeof node.userData.onTouch === "function") return node;
        if (node.userData.passThrough) passThrough = true;
      }
      if (passThrough) continue;
      return null;
    }
    return null;
  }

  function touchableAt(x: number, y: number, far = Infinity): (() => void) | null {
    return (touchNodeAt(x, y, far)?.userData.onTouch as (() => void) | undefined) ?? null;
  }

  function touchAt(event: MouseEvent): (() => void) | null {
    const rect = canvas.getBoundingClientRect();
    return touchableAt(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  // Buscar bajo el puntero en cada movimiento es caro; con veinte veces por segundo alcanza
  // para que la manito aparezca a tiempo.
  let lastHover = 0;
  const onHover = (event: PointerEvent) => {
    if (walking) return;
    if (event.timeStamp - lastHover < 50) return;
    lastHover = event.timeStamp;
    canvas.style.cursor = touchAt(event) ? "pointer" : "";
  };
  // Caminando, el clic no toca: atrapa el puntero para mirar con el mouse. Lo que se usa es
  // lo que queda en la mira, con la E. Esc lo suelta, como en cualquier juego.
  const onTap = (event: MouseEvent) => {
    if (!walking) {
      touchAt(event)?.();
      return;
    }
    if (blend || document.pointerLockElement === canvas) return;
    const lock = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    lock?.catch?.(() => {});
  };
  canvas.addEventListener("pointermove", onHover);
  canvas.addEventListener("click", onTap);

  /* ---------------- caminar ---------------- */

  // W A S D (o las flechas) para caminar, Shift para apurarse, el mouse para mirar y la E
  // para usar lo que quedó en la mira. Los choques se miran con rayos cortos hacia donde se
  // va, a tres alturas y a lo ancho del cuerpo: se frena contra las paredes, los muebles, las
  // puertas cerradas y el vidrio. Con la corrediza abierta se sale al jardín, y con una
  // puerta abierta se entra al consultorio.
  let walking = false;
  const walker = { position: new THREE.Vector3(), yaw: 0, pitch: 0 };
  const walkerLook = new THREE.Euler(0, 0, 0, "YXZ");
  const keys = new Set<string>();
  /** El viaje de la cámara entre fondo y caminar: sale de donde estaba y llega a donde le toca. */
  let blend: { from: THREE.Vector3; fromQuat: THREE.Quaternion; fromLens: number; startedAt: number | null } | null = null;
  const blendQuat = new THREE.Quaternion();
  let aiming: string | null = null;
  let lastAim = 0;
  /** Sentado en la silla de la recepción: al moverse, se para donde indica `standAt`. */
  const seat = { active: false, standAt: new THREE.Vector3() };
  let night_: Night | null = null;

  // Las cajas invisibles de las cosas que se tocan no frenan a nadie: son más grandes que
  // lo que envuelven a propósito, y el tablero, sobre la pared del baño, dejaba un muro
  // invisible en medio del hall. Lo que hay detrás de cada una ya frena.
  // La silla tampoco: al pararse se sale de ella, y con el respaldo detrás, el escritorio
  // delante y la escalera encima, quien se paraba quedaba encajado sin poder moverse.
  const colliders: THREE.Object3D[] = [];
  const seated = new Set<THREE.Object3D>();
  officeChair.traverse((object) => seated.add(object));
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && (object.visible || object.userData.collides) && !seated.has(object)) colliders.push(object);
  });
  const probe = new THREE.Raycaster();
  const probeFrom = new THREE.Vector3();
  const probeDir = new THREE.Vector3();

  function blocked(dx: number, dz: number): boolean {
    const length = Math.hypot(dx, dz);
    if (!length) return false;
    probeDir.set(dx / length, 0, dz / length);
    probe.far = length + BODY;
    for (const height of [0.4, 0.85, 1.5]) {
      for (const side of [-0.8, 0, 0.8]) {
        probeFrom.set(walker.position.x - probeDir.z * side * BODY, height, walker.position.z + probeDir.x * side * BODY);
        probe.set(probeFrom, probeDir);
        if (probe.intersectObjects(colliders, false).length) return true;
      }
    }
    return false;
  }

  function setAim(label: string | null) {
    if (label === aiming) return;
    aiming = label;
    onAim?.(label);
  }

  function walkStep(dt: number) {
    if (night_?.frozen()) return;
    const held = (...codes: string[]) => codes.some((code) => keys.has(code));
    walker.yaw += ((held("ArrowLeft") ? 1 : 0) - (held("ArrowRight") ? 1 : 0)) * TURN_SPEED * dt;
    // Sentado se puede girar; al caminar, primero se para.
    if (seat.active) {
      if (!held("KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown")) return;
      seat.active = false;
      walker.position.copy(seat.standAt);
    }

    const ahead = (held("KeyW", "ArrowUp") ? 1 : 0) - (held("KeyS", "ArrowDown") ? 1 : 0);
    const aside = (held("KeyD") ? 1 : 0) - (held("KeyA") ? 1 : 0);
    if (!ahead && !aside) return;
    const sin = Math.sin(walker.yaw);
    const cos = Math.cos(walker.yaw);
    let dx = -sin * ahead + cos * aside;
    let dz = -cos * ahead - sin * aside;
    const step = ((held("ShiftLeft", "ShiftRight") ? 1.8 : 1) * WALK_SPEED * dt) / Math.hypot(dx, dz);
    dx *= step;
    dz *= step;
    // Cada eje por separado: contra una pared se desliza en vez de quedar pegado.
    if (!blocked(dx, 0)) walker.position.x += dx;
    if (!blocked(0, dz)) walker.position.z += dz;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!walking || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (night_?.key(event.code, event.altKey)) {
      if (event.code !== "Escape") event.preventDefault();
      return;
    }
    if (MOVE_KEYS.has(event.code)) {
      keys.add(event.code);
      if (event.code.startsWith("Arrow")) event.preventDefault();
    } else if (event.code === "KeyE" && !event.repeat && !blend) {
      touchableAt(0, 0, REACH)?.();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onBlur = () => keys.clear();
  const onLook = (event: MouseEvent) => {
    if (!walking || blend || document.pointerLockElement !== canvas || night_?.frozen()) return;
    walker.yaw -= event.movementX * 0.0022;
    walker.pitch = THREE.MathUtils.clamp(walker.pitch - event.movementY * 0.0022, -1.2, 1.2);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("mousemove", onLook);

  /* ---------------- tamaño ---------------- */

  const size = { width: 0, height: 0 };
  /**
   * Dónde cae el punto de fuga, como fracción del ancho: 0.5 es al medio. Se guarda aparte
   * porque al pasar a caminar se desliza hasta el centro en vez de saltar.
   */
  let lens = 0.5;

  function lensTarget() {
    return !walking && !centered && size.width >= 900 ? VANISHING_X : 0.5;
  }

  function applyLens() {
    const { width: cssWidth, height: cssHeight } = size;
    if (!cssWidth || !cssHeight) return;
    if (lens > 0.501) {
      // Se corre la lente, como en las fotos de arquitectura: se dibuja la parte izquierda
      // de una imagen más ancha, así el punto de fuga cae a la derecha de la tarjeta y las
      // verticales siguen derechas. Girar la cámara las habría torcido.
      const fullWidth = cssWidth * lens * 2;
      camera.fov = THREE.MathUtils.lerp(60, 58, (lens - 0.5) / (VANISHING_X - 0.5));
      camera.aspect = fullWidth / cssHeight;
      camera.setViewOffset(fullWidth, cssHeight, 0, 0, cssWidth, cssHeight);
    } else {
      // Sin tarjeta adelante, la puerta del jardín va al medio. En el celular la tarjeta
      // ocupa todo el ancho y tampoco hay costado adonde correrla.
      camera.clearViewOffset();
      camera.aspect = cssWidth / cssHeight;
      // En vertical se abre el ángulo: con el de la compu no se verían ni las puertas ni la escalera.
      camera.fov = camera.aspect < 1 ? 72 : 60;
    }
    camera.updateProjectionMatrix();
  }

  function setLens(value: number) {
    if (Math.abs(value - lens) < 1e-4) return;
    lens = value;
    applyLens();
  }

  function resize(cssWidth: number, cssHeight: number) {
    if (!cssWidth || !cssHeight) return;
    renderer.setSize(cssWidth, cssHeight, false);
    composer.setSize(cssWidth, cssHeight);
    size.width = cssWidth;
    size.height = cssHeight;
    if (!blend) lens = lensTarget();
    applyLens();
  }

  /* ---------------- la noche de terror ---------------- */

  if (horror) {
    const context: NightContext = {
      scene,
      camera,
      layout: {
        left: LEFT,
        hallLeft: HALL_LEFT,
        right: RIGHT,
        openingZ: OPENING_Z,
        backZ: BACK_Z,
        gardenBackZ: GARDEN_BACK_Z,
        roomZ,
        hallH: HALL_H,
        corridorH: CORRIDOR_H,
        doorTop: DOOR_TOP,
        glassLeft: GLASS_LEFT,
        nicheZ: NICHE.z,
        roomBackX,
      },
      doors: swingingDoors,
      doorZ: DOORS.map((door) => door.z),
      bath: {
        door: bathDoor,
        charger: bathCharger,
        doorAt: { x: BATH.doorX, z: BATH.back },
        // Un paso afuera del vano, del lado de la recepción.
        outside: { x: BATH.doorX, z: BATH.back - 0.7 },
        box: { x0: BATH.left, x1: RIGHT, z0: BATH.back, z1: BATH.front },
      },
      balcony: { y: landingTop, x0: HALL_LEFT, x1: RIGHT - 1.25, z: BALCONY_FRONT },
      garden: gardenDoor,
      slider,
      fixedPane,
      nichePlants,
      chair: officeChair,
      monitor,
      lever,
      breaker,
      walker,
      seat,
      glow: lampGlow,
      flicker: flickering,
      ambient: [sun, sky, fill],
      sky: { top: skyTop, horizon: skyHorizon },
      setView(view) {
        pixelPass.camera = view ?? camera;
      },
      releasePointer() {
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      },
      relock() {
        const lock = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        lock?.catch?.(() => {});
      },
      onState(state) {
        onNight?.(state);
      },
    };
    night_ = createNight(context, nightLevel);
  }

  /* ---------------- cada cuadro ---------------- */

  let startedAt: number | null = null;
  let last: number | null = null;

  function update(t: number, dt: number, still: boolean): boolean {
    if (startedAt === null) startedAt = t;
    const walk = still || !walkIn ? 1 : Math.min(1, (t - startedAt) / WALK_IN_S);
    const eased = 1 - (1 - walk) ** 3;

    if (still) {
      parallax.x = 0;
      parallax.y = 0;
    } else {
      const follow = Math.min(1, dt * 2.5);
      parallax.x += (pointer.x - parallax.x) * follow;
      parallax.y += (pointer.y - parallax.y) * follow;
    }

    if (walking) {
      if (!blend) walkStep(dt);
      camera.position.copy(walker.position);
      camera.quaternion.setFromEuler(walkerLook.set(walker.pitch, walker.yaw, 0));
    } else {
      const drift = still ? 0 : 1;
      camera.position.set(
        REST.x + Math.sin(t * 0.13) * 0.06 * drift + parallax.x * 0.3,
        REST.y + Math.sin(t * 0.19) * 0.02 * drift - parallax.y * 0.12,
        THREE.MathUtils.lerp(START_Z, REST.z, walkIn ? eased : 1)
      );
      camera.lookAt(LOOK.x + parallax.x * 0.5, LOOK.y - parallax.y * 0.2, LOOK.z);
    }

    // En el viaje entre fondo y caminar, la cámara va de donde estaba a donde le toca y la
    // lente se corre al mismo tiempo: el hall se desliza al centro mientras se da el paso.
    if (blend) {
      if (blend.startedAt === null) blend.startedAt = t;
      const k = Math.min(1, (t - blend.startedAt) / BLEND_S);
      const smooth = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      blendQuat.copy(camera.quaternion);
      camera.position.lerpVectors(blend.from, camera.position, smooth);
      camera.quaternion.slerpQuaternions(blend.fromQuat, blendQuat, smooth);
      setLens(THREE.MathUtils.lerp(blend.fromLens, lensTarget(), smooth));
      if (k >= 1) blend = null;
    } else {
      setLens(lensTarget());
    }

    if (walking && !blend && t - lastAim > 0.1) {
      lastAim = t;
      const node = night_?.frozen() ? null : touchNodeAt(0, 0, REACH);
      setAim(node ? ((node.userData.label as string | undefined) ?? "") : null);
    }

    clock = t;
    let animating = false;

    for (const door of swingingDoors) {
      if (door.target && t > door.closeAt) door.target = 0;
      door.open += (door.target - door.open) * Math.min(1, dt * 3);
      door.hinge.rotation.y = door.open * 1.2;
      if (Math.abs(door.target - door.open) > 0.002) animating = true;
    }

    // La del baño abre hacia la recepción, y rápido: el que sale de ahí la abre de una patada.
    bathDoor.open += (bathDoor.target - bathDoor.open) * Math.min(1, dt * 6);
    bathDoor.hinge.rotation.y = bathDoor.open * 1.35;
    if (Math.abs(bathDoor.target - bathDoor.open) > 0.002) animating = true;

    gardenDoor.open += (gardenDoor.target - gardenDoor.open) * Math.min(1, dt * 2.5);
    slider.position.x = sliderClosedX + gardenDoor.open * (leafWidth - 0.1);
    if (Math.abs(gardenDoor.target - gardenDoor.open) > 0.002) animating = true;

    for (const entry of swaying) {
      entry.kick *= Math.exp(-dt * 2.2);
      if (entry.kick > 0.02) animating = true;
      const shake = entry.kick * Math.sin(t * 16 + entry.phase) * 4;
      entry.object.rotation.z = (wind(t, entry.phase) + shake) * entry.amount;
      entry.object.rotation.x = wind(t * 0.8, entry.phase + 2) * entry.amount * 0.5;
    }

    for (const cloud of clouds) {
      cloud.group.position.x += cloud.speed * dt;
      if (cloud.group.position.x > 90) cloud.group.position.x = -90;
    }

    night_?.update(dt);
    composer.render(dt);
    return walking || blend !== null || animating || walk < 1 || Math.abs(pointer.x - parallax.x) + Math.abs(pointer.y - parallax.y) > 0.004;
  }

  return {
    resize,
    render(seconds) {
      const dt = last === null ? 0 : Math.min(0.1, Math.max(0, seconds - last));
      last = seconds;
      return update(seconds, dt, false);
    },
    renderStill() {
      last = null;
      update(4, 0, true);
    },
    nightCommand(name, value) {
      night_?.command(name, value);
    },
    setWalk(on, instant = false) {
      if (on === walking) return;
      walking = on;
      keys.clear();
      if (on) {
        // Un paso más adentro que el fondo, ya pasando el vano, derecho al jardín. En la
        // noche de terror se arranca sentado en la recepción, donde lo dejó el juego.
        if (!seat.active) {
          walker.position.set(REST.x, EYE, 2.2);
          walker.yaw = 0;
          walker.pitch = 0.03;
        }
        canvas.style.cursor = "";
      } else {
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        setAim(null);
      }
      blend = instant ? null : { from: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromLens: lens, startedAt: null };
    },
    dispose() {
      night_?.dispose();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mousemove", onLook);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      if (finePointer) window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointermove", onHover);
      canvas.removeEventListener("click", onTap);
      canvas.style.cursor = "";
      composer.dispose();
      pixelPass.dispose();
      for (const thing of disposables) thing.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
