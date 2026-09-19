import * as THREE from "three";
import * as flesh from "./nightFlesh";

/**
 * Las cosas de la noche de terror. Cada una con su silueta, para reconocerla de un vistazo
 * por la cámara aunque se vea chica y verde:
 * - El Doctor (naranja): altísimo, doblado por la mitad, con el guardapolvo abierto sobre
 *   las costillas, el espejo de cabeza torcido, la boca cosida de oreja a oreja y el
 *   barbijo colgando de una oreja.
 * - La Muñeca (turquesa): chica, de porcelana rajada, cabezona, con vestido y moño.
 * - La Mujer (verde): vestido largo y pelo negro hasta la cintura que le tapa la cara; se le
 *   ve un solo ojo.
 * - El Hombre árbol (jardín): corteza, ramas por brazos, una bolsa cosida por cabeza y astas.
 * - El Retorcido: no es de ningún consultorio. Todo quebrado para el lado que no va, con la
 *   cabeza de costado sobre el hombro. Solo mira.
 *
 * No caminan: se paran en un lugar con una pose y, de un estado al otro, aparecen en otro.
 * Los brazos y la cabeza van en pivotes para que cada pose se lea distinta.
 */

/** `lurk` es solo del Doctor: asomado por la puerta entreabierta. Los demás se paran. */
export type Pose = "emerge" | "wait" | "stand" | "peek" | "sit" | "reach" | "lurk";

export interface Figure {
  group: THREE.Group;
  /** La cabeza, para saber dónde queda la cara estando torcida. */
  head: THREE.Object3D;
  /** A qué altura está el centro de la cara, sin la escala: para encuadrar el susto. */
  headY: number;
  /** Hasta dónde llegan las manos con los brazos al frente: a esa distancia se para de una puerta. */
  reach: number;
  place(x: number, y: number, z: number, yaw: number): void;
  /** Gira para mirar hacia ese punto del piso. */
  face(x: number, z: number): void;
  pose(pose: Pose): void;
  scream(on: boolean): void;
  /** Deja solo los ojos brillando, para cuando se lo ve en la oscuridad. */
  eyes(on: boolean): void;
  /** Lo que se mueve solo mientras está a la vista: respirar, temblar, mirar. */
  tick?(time: number): void;
  hide(): void;
}

const HIDDEN_Y = -60;

type Keep = <T extends { dispose(): void }>(thing: T) => T;

/** Las piezas: cajas, cilindros y esferas, con pivotes para lo que se mueve. */
function kit(keep: Keep) {
  const mats = new Map<string, THREE.Material>();
  function mat(color: string, glow = false): THREE.Material {
    const key = `${color}-${glow}`;
    if (!mats.has(key)) {
      mats.set(key, keep(glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
    }
    return mats.get(key)!;
  }
  const geo = {
    box: keep(new THREE.BoxGeometry(1, 1, 1)),
    cyl: keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
    cone: keep(new THREE.CylinderGeometry(0.5 * 0.45, 0.5, 1, 12)),
    ball: keep(new THREE.SphereGeometry(1, 16, 12)),
  };
  function mesh(geometry: THREE.BufferGeometry, color: string, parent: THREE.Object3D, at: number[], scale: number[], glow = false) {
    const m = new THREE.Mesh(geometry, mat(color, glow));
    m.position.set(at[0], at[1], at[2]);
    m.scale.set(scale[0], scale[1], scale[2]);
    parent.add(m);
    return m;
  }
  return {
    box: (parent: THREE.Object3D, color: string, size: number[], at: number[]) => mesh(geo.box, color, parent, at, size),
    /** Un cilindro vertical centrado en `at`. */
    cyl: (parent: THREE.Object3D, color: string, radius: number, length: number, at: number[]) =>
      mesh(geo.cyl, color, parent, at, [radius * 2, length, radius * 2]),
    cone: (parent: THREE.Object3D, color: string, radius: number, length: number, at: number[]) =>
      mesh(geo.cone, color, parent, at, [radius * 2, length, radius * 2]),
    ball: (parent: THREE.Object3D, color: string, radii: number[], at: number[], glow = false) => mesh(geo.ball, color, parent, at, radii, glow),
    pivot(parent: THREE.Object3D, at: number[]) {
      const group = new THREE.Group();
      group.position.set(at[0], at[1], at[2]);
      parent.add(group);
      return group;
    },
  };
}

/** Lo que tienen todas: dónde van, hacia dónde miran, cómo se esconden. */
interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs?: [THREE.Group, THREE.Group];
  torso?: THREE.Group;
}

function figure(
  rig: Rig,
  headY: number,
  reach: number,
  poses: Record<Exclude<Pose, "lurk">, (rig: Rig) => void> & Partial<Record<"lurk", (rig: Rig) => void>>,
  scream: (rig: Rig, on: boolean) => void,
  eyes: (on: boolean) => void = () => {},
  tick?: (time: number) => void
): Figure {
  const { root } = rig;
  root.position.y = HIDDEN_Y;
  // La mira pasa a través: parados delante de una puerta, no tapan lo que se quiere usar.
  root.userData.passThrough = true;
  // La joroba de cada uno es parte del cuerpo, no de la pose: se vuelve a ella.
  const hunch = rig.torso?.rotation.x ?? 0;
  const reset = () => {
    rig.body.position.set(0, 0, 0);
    rig.body.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);
    for (const arm of rig.arms) arm.rotation.set(0, 0, 0);
    for (const leg of rig.legs ?? []) leg.rotation.set(0, 0, 0);
    rig.torso?.rotation.set(hunch, 0, 0);
  };
  return {
    group: root,
    head: rig.head,
    headY,
    reach,
    place(x, y, z, yaw) {
      root.position.set(x, y, z);
      root.rotation.set(0, yaw, 0);
    },
    face(x, z) {
      root.rotation.y = Math.atan2(x - root.position.x, z - root.position.z);
    },
    pose(name) {
      reset();
      (poses[name] ?? poses.stand)(rig);
    },
    scream(on) {
      scream(rig, on);
    },
    eyes,
    tick,
    hide() {
      root.position.set(0, HIDDEN_Y, 0);
      root.rotation.set(0, 0, 0);
    },
  };
}

const armPoses = {
  hang(rig: Rig, splay = 0.08) {
    rig.arms[0].rotation.z = -splay;
    rig.arms[1].rotation.z = splay;
  },
  up(rig: Rig) {
    rig.arms[0].rotation.set(-2.7, 0, -0.35);
    rig.arms[1].rotation.set(-2.5, 0, 0.3);
  },
  onDoor(rig: Rig) {
    rig.arms[0].rotation.set(-1.45, 0, 0.12);
    rig.arms[1].rotation.set(-1.7, 0, -0.1);
  },
  reach(rig: Rig) {
    rig.arms[0].rotation.set(-1.35, 0, -0.35);
    rig.arms[1].rotation.set(-1.35, 0, 0.35);
  },
};

/* ---------------- el Doctor ---------------- */

export function makeDoctor(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);

  /* --- de qué está hecho --- */

  const skinArt = flesh.skinTexture("#9a9d90", 7, 0.55);
  const coatArt = flesh.clothTexture("#b3ab96", 21, 1);
  const chance = flesh.dice(17);

  /** Un material con su relieve, para que la luz agarre los poros y las fibras. */
  function surface(color: string, art: THREE.CanvasTexture | null, repeat: number, bump: number, roughness: number, side?: THREE.Side) {
    const map = (repeat === 1 ? art : art?.clone()) ?? null;
    if (map && map !== art) {
      map.repeat.set(repeat, repeat);
      map.needsUpdate = true;
    }
    if (map) keep(map);
    const bumpMap = flesh.relief(map);
    if (bumpMap) keep(bumpMap);
    return keep(new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: bump, roughness, side: side ?? THREE.FrontSide }));
  }
  const plain = (color: string, roughness: number, metalness = 0) => keep(new THREE.MeshStandardMaterial({ color, roughness, metalness }));

  const skinHead = surface("#ffffff", skinArt, 1, 0.5, 0.84);
  const skinBody = surface("#f0f0ea", skinArt, 2, 0.6, 0.88);
  const coat = surface("#ffffff", coatArt, 1, 0.7, 0.95, THREE.DoubleSide);
  const rag = surface("#4a4a54", coatArt, 2, 0.7, 1, THREE.DoubleSide);
  const dark = plain("#080505", 1);
  const bone = plain("#cfc4a4", 0.55);
  const metal = plain("#98a1a6", 0.3, 0.6);
  const leather = plain("#17151a", 0.8);
  const gore = plain("#46100c", 0.35);
  const wet = plain("#2a0b09", 0.25);
  const nailMat = plain("#241a18", 0.45);
  const sclera = plain("#b3ac93", 0.25);

  /** Una pieza ya armada, colgada de donde corresponda. */
  function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(keep(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  /* --- las piernas: palos con el pantalón hecho jirones --- */

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.1, 1.02, 0]), k.pivot(body, [0.1, 1.02, 0])];
  legs.forEach((leg, side) => {
    piece(leg, flesh.limb(0.52, 0.066, 0.052, { bend: 0.008, rough: 0.05, seed: side * 3 }), rag);
    // El ruedo del pantalón, comido y colgando en tiras alrededor de la rodilla.
    const strips: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + side;
      const length = 0.08 + ((i * 7) % 5) * 0.035;
      strips.push(
        flesh.at(
          flesh.cloth(
            0.05,
            length,
            (v) => {
              v.z += Math.sin(v.x * 44 + i) * 0.005;
              if (v.y < -length / 2 + 0.012) v.y += flesh.fbm(v.x * 30, i, 0, 2) * 0.03;
            },
            [3, 4]
          ),
          [Math.sin(angle) * 0.054, -0.47 - length / 2, Math.cos(angle) * 0.054],
          [0, angle, 0]
        )
      );
    }
    piece(leg, flesh.fuse(strips), rag);

    const knee = k.pivot(leg, [0, -0.52, 0]);
    knee.rotation.x = 0.16;
    piece(
      knee,
      flesh.blob([0.058, 0.052, 0.056], 10, (v) => {
        flesh.swell(v, [0, 0.005, 0.048], 0.05, 0.014);
        flesh.lumps(v, 28, 0.008, side);
      }),
      skinBody
    );
    // La pantorrilla, flaca y con las venas marcadas.
    piece(knee, flesh.limb(0.46, 0.042, 0.028, { rough: 0.1, seed: 5 + side }), skinBody);
    // El zapato: grande, gastado y con la puntera levantada.
    piece(
      knee,
      flesh.at(
        flesh.blob([0.052, 0.045, 0.12], 10, (v) => {
          v.y = Math.max(v.y, -0.022);
          flesh.dent(v, [0, 0.03, -0.06], 0.07, 0.022);
          flesh.swell(v, [0, 0.01, 0.1], 0.05, 0.008);
          flesh.lumps(v, 22, 0.006, 2 + side);
        }),
        [0, -0.48, 0.045]
      ),
      leather
    );
  });

  /* --- el torso: doblado, vacío y abierto --- */

  const torso = k.pivot(body, [0, 1.02, 0]);
  torso.rotation.x = 0.34;

  const chest = piece(
    torso,
    flesh.at(
      flesh.blob([0.175, 0.42, 0.112], 18, (v) => {
        // Pecho hundido y panza vacía: se le marcan las costillas, las clavículas y la cadera.
        flesh.dent(v, [0, 0.02, 0.11], 0.19, 0.05);
        flesh.dent(v, [0, -0.2, 0.09], 0.16, 0.06);
        for (let i = 0; i < 6; i++) {
          const y = 0.19 - i * 0.055;
          for (const s of [-1, 1]) flesh.ridge(v, [s * 0.02, y, 0.105], [s * 0.155, y - 0.07, -0.02], 0.017, 0.03);
        }
        for (const s of [-1, 1]) {
          flesh.ridge(v, [s * 0.02, 0.3, 0.09], [s * 0.145, 0.325, 0.005], 0.026, 0.024);
          flesh.swell(v, [s * 0.155, 0.35, 0], 0.09, 0.022);
          flesh.swell(v, [s * 0.115, -0.33, 0.05], 0.06, 0.028);
        }
        // El surco del esternón, de la garganta al estómago.
        flesh.ridge(v, [0, 0.28, 0.12], [0, 0.02, 0.12], 0.026, -0.016);
        flesh.lumps(v, 11, 0.009, 4);
        flesh.lumps(v, 34, 0.003, 12);
      }),
      [0, 0.48, 0]
    ),
    skinBody
  );

  // El corte en Y de la autopsia, cerrado a mano y con los puntos cruzados y grandes.
  const cut: flesh.Vec[][] = [
    [
      [0, 0.52, 0.108],
      [0, 0.34, 0.118],
      [0, 0.16, 0.115],
      [0, 0.02, 0.095],
    ],
    [
      [-0.12, 0.72, 0.05],
      [-0.06, 0.62, 0.1],
      [0, 0.52, 0.108],
    ],
    [
      [0.12, 0.72, 0.05],
      [0.06, 0.62, 0.1],
      [0, 0.52, 0.108],
    ],
  ];
  piece(
    torso,
    flesh.fuse(cut.map((line) => flesh.thread(line, 0.005, 16))),
    wet
  );
  const seam: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const y = 0.54 - t * 0.53;
    const z = 0.118 - Math.abs(t - 0.35) * 0.05;
    for (const s of [-1, 1]) {
      seam.push(
        flesh.thread(
          [
            [s * 0.036, y + 0.014, z - 0.012],
            [0, y, z + 0.005],
            [-s * 0.036, y - 0.014, z - 0.012],
          ],
          0.0032,
          6
        )
      );
    }
  }
  piece(torso, flesh.fuse(seam), leather);

  // Un tajo que se abrió solo en el costado: adentro está negro y asoman dos costillas.
  piece(torso, flesh.at(flesh.blob([0.018, 0.075, 0.02], 10), [-0.105, 0.6, 0.09], [0, 0, 0.25]), dark);
  piece(
    torso,
    flesh.fuse([0, 1, 2].map((i) => flesh.at(flesh.limb(0.05, 0.006, 0.005, { rings: 3, radial: 6 }), [-0.105, 0.665 - i * 0.05, 0.098], [0, 0, 1.5]))),
    bone
  );

  // El guardapolvo: dos paños que caen del hombro, con pliegues, y el faldón en tiras.
  const panels: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    panels.push(
      flesh.at(
        flesh.cloth(0.26, 0.62, (v) => {
          v.z -= (v.x / 0.13) ** 2 * 0.1;
          v.z += Math.sin(v.x * 26 + v.y * 9) * 0.01;
          v.x *= 1 - Math.max(0, -v.y - 0.1) * 0.25;
          if (v.y < -0.29) v.y += flesh.fbm(v.x * 40, side, 0, 2) * 0.06;
        }),
        [side * 0.125, 0.58, 0.055],
        [0, -side * 0.16, 0]
      )
    );
    for (let i = 0; i < 5; i++) {
      const length = 0.24 + ((i * 3) % 4) * 0.1;
      panels.push(
        flesh.at(
          flesh.cloth(
            0.055,
            length,
            (v) => {
              v.z += Math.sin(v.y * 22 + i) * 0.012;
              if (v.y < -length / 2 + 0.02) v.y += flesh.fbm(v.x * 40, i * 3, 0, 2) * 0.05;
            },
            [3, 6]
          ),
          [side * (0.055 + i * 0.048), 0.27 - length / 2, 0.095 - i * 0.032],
          [0, 0, side * (0.04 + i * 0.02)]
        )
      );
    }
  }
  // El cuello del guardapolvo, parado y sucio.
  panels.push(
    flesh.at(
      flesh.cloth(0.3, 0.13, (v) => {
        v.z -= (v.x / 0.15) ** 2 * 0.1;
        v.y += Math.abs(v.x) * 0.25;
      }),
      [0, 0.86, -0.015],
      [0.55, 0, 0]
    )
  );
  piece(torso, flesh.fuse(panels), coat);
  // Lo que le bajó del cuello y le empapó el guardapolvo, todavía sin secarse del todo.
  piece(
    torso,
    flesh.fuse([
      flesh.at(
        flesh.cloth(0.15, 0.3, (v) => {
          v.z -= (v.x / 0.075) ** 2 * 0.05;
          // El borde de abajo no es una línea: es hasta donde llegó a bajar.
          v.y -= Math.max(0, flesh.fbm(v.x * 26, 3, 0, 2) + 0.2) * (v.y < -0.1 ? 0.12 : 0);
          v.x *= 1 - Math.max(0, -v.y - 0.06) * 1.4;
        }),
        [0, 0.66, 0.125]
      ),
    ]),
    wet
  );
  // Lo que chorrea del faldón y de las costillas, a punto de gotear.
  piece(
    torso,
    flesh.drips(
      [
        [-0.04, 0.28, 0.13],
        [0.06, 0.26, 0.13],
        [-0.12, 0.2, 0.11],
        [0.13, 0.22, 0.1],
        [-0.105, 0.53, 0.1],
        [0.02, 0.04, 0.09],
      ],
      chance
    ),
    wet
  );

  /* --- los brazos: largos, con garras, un bisturí y una jeringa --- */

  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.27, 0.84, 0]), k.pivot(torso, [0.27, 0.84, 0])];
  const hands = arms.map((shoulder, side) => {
    const sign = side ? 1 : -1;
    piece(shoulder, flesh.at(flesh.limb(0.48, 0.07, 0.055, { rough: 0.12, seed: side }), [0, -0.01, 0]), coat);
    piece(shoulder, flesh.limb(0.66, 0.042, 0.03, { bend: sign * 0.012, rough: 0.07, seed: 2 + side }), skinBody);
    const elbow = k.pivot(shoulder, [0, -0.66, 0]);
    elbow.rotation.x = -0.15;
    piece(
      elbow,
      flesh.blob([0.042, 0.046, 0.042], 10, (v) => {
        flesh.swell(v, [0, 0, -0.038], 0.045, 0.012);
        flesh.lumps(v, 30, 0.008, side);
      }),
      skinBody
    );
    // El antebrazo, con los tendones tirantes.
    piece(
      elbow,
      flesh.limb(0.7, 0.032, 0.023, { rough: 0.07, seed: 6 + side }),
      skinBody
    );
    const hand = k.pivot(elbow, [0, -0.7, 0]);

    /** Un dedo: tres falanges que se van cerrando, con nudillos y una uña negra. */
    function claw(x: number, z: number, length: number, curl: number, seed: number) {
      const parts: THREE.BufferGeometry[] = [];
      let y = -0.062;
      let angle = curl * 0.5;
      for (let s = 0; s < 3; s++) {
        const long = length * [0.44, 0.33, 0.23][s];
        const phalanx = flesh.limb(long, 0.0098 - s * 0.0018, 0.0085 - s * 0.0018, { rough: 0.18, seed: seed + s, rings: 3, radial: 7 });
        phalanx.rotateX(angle);
        phalanx.translate(x, y, z);
        parts.push(phalanx);
        parts.push(flesh.at(flesh.blob([0.0115, 0.0095, 0.0115], 5), [x, y, z]));
        y -= Math.cos(angle) * long;
        z -= Math.sin(angle) * long;
        angle += curl;
      }
      const nail = flesh.limb(0.024, 0.0075, 0.0005, { rings: 2, radial: 6 });
      nail.rotateX(angle - curl);
      nail.translate(x, y, z);
      return { parts, nail };
    }

    const bits = [
      flesh.at(
        flesh.blob([0.036, 0.055, 0.022], 12, (v) => {
          flesh.dent(v, [0, -0.01, 0.022], 0.045, 0.014);
          flesh.lumps(v, 26, 0.006, side);
        }),
        [0, -0.03, 0]
      ),
    ];
    const nails: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 0.019;
      const { parts, nail } = claw(spread, 0.004 + Math.abs(spread) * 0.3, 0.26 - Math.abs(i - 2) * 0.022, -0.22 - i * 0.03, 30 + i * 7 + side);
      bits.push(...parts);
      nails.push(nail);
    }
    piece(hand, flesh.fuse(bits), skinBody);
    piece(hand, flesh.fuse(nails), nailMat);
    // Las manos metidas en algo hasta el codo: lo que queda cae de las puntas de los dedos.
    piece(
      elbow,
      flesh.at(flesh.limb(0.22, 0.029, 0.024, { rough: 0.07, seed: 6 + side }), [0, -0.7, 0]),
      wet
    );
    piece(hand, flesh.drips([-0.038, -0.019, 0, 0.019, 0.038].map((x) => [x, -0.3 + Math.abs(x) * 0.5, 0.05] as flesh.Vec), chance), wet);
    return hand;
  });

  // Un bisturí en una mano: la hoja con filo y el mango con la sangre seca.
  piece(
    hands[1],
    flesh.fuse([
      flesh.at(
        flesh.sculpt(new THREE.BoxGeometry(0.004, 0.2, 0.026, 1, 5, 1), (v) => {
          // La hoja se afina hacia la punta y tiene el filo de un solo lado.
          const t = v.y / 0.2 + 0.5;
          v.z += (1 - t) * 0.012;
          v.x *= 0.3 + t * 0.9;
        }),
        [0, -0.3, 0.03]
      ),
    ]),
    metal
  );
  piece(hands[1], flesh.at(new THREE.BoxGeometry(0.014, 0.1, 0.022), [0, -0.14, 0.03]), leather);
  piece(hands[1], flesh.drips([[0, -0.4, 0.035]], chance), wet);
  // Una jeringa en la otra, cargada hasta la mitad y con la aguja larga.
  piece(hands[0], flesh.at(flesh.limb(0.15, 0.019, 0.019, { rings: 3 }), [0, -0.12, 0.03]), metal);
  piece(hands[0], flesh.at(flesh.limb(0.07, 0.016, 0.016, { rings: 3 }), [0, -0.19, 0.03]), gore);
  piece(hands[0], flesh.at(flesh.limb(0.12, 0.0022, 0.0012, { rings: 3 }), [0, -0.27, 0.03]), metal);

  /* --- el cuello: quebrado, con los tendones y un agujero --- */

  const neck = k.pivot(torso, [0, 0.9, 0.02]);
  neck.rotation.set(0.35, 0, 0.42);
  piece(
    neck,
    flesh.at(
      flesh.limb(0.36, 0.046, 0.038, { bend: 0.012, rough: 0.06, seed: 9 }),
      [0, 0.36, 0]
    ),
    skinBody
  );
  piece(
    neck,
    flesh.fuse([
      ...[-1, 1].map((s) =>
        flesh.thread(
          [
            [s * 0.03, 0.02, 0.028],
            [s * 0.026, 0.16, 0.034],
            [s * 0.014, 0.31, 0.022],
          ],
          0.007,
          10
        )
      ),
      // Las vértebras, marcadas una por una en la nuca.
      ...[0, 1, 2, 3].map((i) => flesh.at(flesh.blob([0.017, 0.012, 0.014], 7), [0, 0.07 + i * 0.075, -0.032])),
    ]),
    skinBody
  );
  // Lo que bajó del mentón le dejó el cuello pintado.
  piece(
    neck,
    flesh.fuse([
      ...[-0.02, 0.012, 0.03].map((x, i) =>
        flesh.thread(
          [
            [x, 0.3, 0.038],
            [x + 0.008, 0.2 - i * 0.03, 0.045],
            [x + 0.004, 0.08 - i * 0.04, 0.04],
          ],
          0.005,
          10
        )
      ),
    ]),
    wet
  );
  // La traqueotomía: un agujero con la cánula todavía puesta.
  piece(neck, flesh.at(flesh.blob([0.022, 0.018, 0.012], 8), [0.01, 0.13, 0.038]), dark);
  piece(neck, flesh.at(new THREE.TorusGeometry(0.019, 0.005, 4, 10), [0.01, 0.13, 0.042], [0, 0, 0]), metal);
  piece(
    neck,
    flesh.fuse([
      flesh.thread(
        [
          [0.01, 0.12, 0.04],
          [0.02, 0.06, 0.05],
          [0.03, -0.02, 0.045],
        ],
        0.006,
        8
      ),
    ]),
    wet
  );

  /* --- la cabeza --- */

  const head = k.pivot(neck, [0, 0.36, 0]);
  // Todo lo de la cabeza cuelga de acá adentro, para poder estirarla entera de una.
  const skull = k.pivot(head, [0, 0, 0]);

  // El cráneo. Se esculpe centrado y después sube a su lugar: las cuencas son agujeros de
  // verdad, no dos bolas negras pegadas a la cara.
  piece(
    skull,
    flesh.at(
      flesh.blob([0.115, 0.175, 0.135], 22, (v) => {
        // La caja del cráneo tirada para atrás y para arriba, y la mandíbula angosta.
        if (v.y > 0) v.z -= 0.05 * (v.y / 0.175) ** 2;
        const low = Math.max(0, (-v.y - 0.02) / 0.15);
        v.x *= 1 - 0.3 * low;
        // Abajo del corte de la boca no hay nada: lo que sigue es la mandíbula, aparte.
        if (v.y < -0.11) v.y = -0.11 - (-0.11 - v.y) * 0.55;
        // Un lado más chico que el otro, y todo apenas volcado.
        if (v.x < 0) v.x *= 0.94;
        v.x += 0.018 * (v.y / 0.175);
        for (const s of [-1, 1]) {
          flesh.dent(v, [s * 0.05, 0.03, 0.105], 0.058, 0.05);
          flesh.swell(v, [s * 0.06, 0.075, 0.1], 0.048, 0.013);
          flesh.dent(v, [s * 0.105, 0.055, 0.015], 0.07, 0.022);
          flesh.dent(v, [s * 0.082, -0.055, 0.07], 0.062, 0.03);
          flesh.swell(v, [s * 0.085, -0.012, 0.08], 0.05, 0.012);
        }
        flesh.swell(v, [0, 0.075, 0.115], 0.085, 0.014);
        // La nariz, hundida hasta el hueso.
        flesh.dent(v, [0, -0.025, 0.135], 0.038, 0.032);
        // El agujero de la trepanación, arriba, con el borde levantado.
        flesh.swell(v, [0.04, 0.155, -0.02], 0.075, 0.012);
        flesh.dent(v, [0.04, 0.16, -0.02], 0.052, 0.05);
        // El bulto del otro lado, donde algo creció.
        flesh.swell(v, [-0.1, 0.085, -0.05], 0.068, 0.022);
        flesh.lumps(v, 13, 0.007, 3);
        flesh.lumps(v, 40, 0.0025, 9);
      }),
      [0, 0.1, 0]
    ),
    skinHead
  );
  // Las orejas, una entera y la otra comida.
  piece(
    skull,
    flesh.fuse(
      [-1, 1].map((s) =>
        flesh.at(
          flesh.blob([0.016, s > 0 ? 0.046 : 0.03, 0.03], 9, (v) => {
            flesh.dent(v, [0, 0, 0.02], 0.03, 0.012);
            flesh.lumps(v, 40, 0.006, s);
          }),
          [s * 0.112, 0.085, -0.008],
          [0, 0, s * 0.2]
        )
      )
    ),
    skinHead
  );
  // Adentro del agujero de la cabeza no hay nada.
  piece(skull, flesh.at(flesh.blob([0.04, 0.03, 0.04], 8), [0.04, 0.245, -0.02]), dark);

  /* la cara */

  const eyeZ = 0.074;
  const sparks: THREE.Mesh[] = [];
  const glows: THREE.Mesh[] = [];
  const eyeSpins: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const socket = k.pivot(skull, [side * 0.05, 0.13, eyeZ]);
    eyeSpins.push(socket);
    // El ojo, amarillento y venoso, hundido en la cuenca.
    piece(socket, flesh.blob([0.024, 0.024, 0.024], 10, (v) => flesh.lumps(v, 50, 0.004, side)), sclera);
    piece(socket, flesh.at(flesh.blob([0.0105, 0.0105, 0.008], 8), [0, 0, 0.019]), dark);
    sparks.push(k.ball(socket, "#ff8a2a", [0.005, 0.005, 0.005], [0, 0, 0.027], true));
    // Los ojos cuando se corta la luz: más grandes, con halo, y nada alrededor.
    const glow = k.ball(socket, "#fff0cc", [0.034, 0.024, 0.014], [0, 0, 0.02], true);
    glow.visible = false;
    glows.push(glow);
    const halo = new THREE.Mesh(
      glow.geometry,
      keep(new THREE.MeshBasicMaterial({ color: "#ff7a1a", transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }))
    );
    halo.scale.set(1.7, 1.7, 1);
    halo.position.z = 0.025;
    halo.visible = false;
    socket.add(halo);
    glows.push(halo);
  }
  // Lo que le chorrea de las cuencas y de la nariz, ya seco.
  piece(
    skull,
    flesh.fuse([
      ...[-1, 1].map((s) =>
        flesh.thread(
          [
            [s * 0.05, 0.1, 0.105],
            [s * 0.057, 0.055, 0.1],
            [s * 0.052, 0.005, 0.088],
          ],
          0.0024,
          10
        )
      ),
      flesh.thread(
        [
          [0.012, 0.045, 0.116],
          [0.016, 0.02, 0.112],
          [0.01, -0.005, 0.1],
        ],
        0.002,
        8
      ),
    ]),
    wet
  );
  // Los agujeros de la nariz, dos tajos.
  piece(
    skull,
    flesh.fuse([-1, 1].map((s) => flesh.at(flesh.blob([0.006, 0.012, 0.008], 6), [s * 0.013, 0.058, 0.118]))),
    dark
  );

  /* la boca: cosida de oreja a oreja, y la mandíbula que se descuelga */

  // El hueco, tapado por los labios y la mandíbula mientras está cerrada.
  piece(skull, flesh.at(flesh.blob([0.062, 0.03, 0.055], 10), [0, -0.012, 0.03]), dark);

  /** Una fila de dientes en arco, desparejos y con faltantes, armada en el origen. */
  const teeth = (rows: number, up: boolean, seed: number) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1) - 0.5;
      if ((i * 5 + seed) % 7 === 3) continue;
      const long = 0.02 + ((i * 3 + seed) % 4) * 0.007;
      const tooth = flesh.limb(long, 0.0075, 0.001, { rings: 2, radial: 6 });
      if (up) tooth.rotateZ(Math.PI);
      tooth.rotateZ(t * 0.5);
      tooth.rotateX((up ? -1 : 1) * 0.15);
      tooth.translate(t * 0.14, 0, -t * t * 0.17);
      parts.push(tooth);
    }
    return flesh.fuse(parts);
  };
  piece(skull, flesh.at(teeth(11, false, 1), [0, -0.004, 0.088]), bone);

  // La costura: cruces de hilo negro de punta a punta de la boca.
  const stitchParts: THREE.BufferGeometry[] = [];
  const tornParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9 - 0.5;
    const x = t * 0.15;
    const z = 0.101 - t * t * 0.17;
    for (const s of [-1, 1]) {
      stitchParts.push(
        flesh.thread(
          [
            [x + s * 0.012, -0.022, z - 0.004],
            [x, -0.008, z + 0.003],
            [x - s * 0.012, 0.008, z - 0.004],
          ],
          0.0026,
          5
        )
      );
    }
    // Cuando la boca se abre, de los mismos agujeros cuelgan los hilos cortados.
    if (i % 2 === 0) {
      tornParts.push(
        flesh.thread(
          [
            [x, -0.004, z],
            [x + 0.004, -0.02, z + 0.004],
            [x - 0.003, -0.036, z],
          ],
          0.0022,
          6
        )
      );
    }
  }
  // Los labios, gruesos y levantados alrededor de la costura.
  piece(
    skull,
    flesh.fuse([
      flesh.thread(
        [
          [-0.076, 0.004, 0.052],
          [-0.038, 0.014, 0.088],
          [0, 0.016, 0.098],
          [0.038, 0.014, 0.088],
          [0.076, 0.004, 0.052],
        ],
        0.0075,
        16
      ),
      flesh.thread(
        [
          [-0.076, -0.024, 0.052],
          [-0.038, -0.03, 0.088],
          [0, -0.032, 0.098],
          [0.038, -0.03, 0.088],
          [0.076, -0.024, 0.052],
        ],
        0.0075,
        16
      ),
    ]),
    skinHead
  );
  // Lo que se le escapa por la boca cosida y le baja por el mentón y el cuello.
  piece(
    skull,
    flesh.fuse([
      ...[-0.05, 0.015, 0.045].map((x, i) =>
        flesh.thread(
          [
            [x, -0.026, 0.085 - x * x * 2],
            [x + 0.006, -0.06 - i * 0.015, 0.075],
            [x + 0.004, -0.1 - i * 0.02, 0.055],
          ],
          0.0045,
          8
        )
      ),
      flesh.at(flesh.blob([0.05, 0.02, 0.03], 8), [0, -0.04, 0.07]),
    ]),
    wet
  );
  const stitches = piece(skull, flesh.fuse(stitchParts), leather);
  const torn = piece(skull, flesh.fuse(tornParts), leather);
  torn.visible = false;
  // Los hilos de baba, de arriba abajo, para cuando abre.
  const drool = piece(
    skull,
    flesh.fuse(
      [-0.045, 0.01, 0.052].map((x, i) =>
        flesh.thread(
          [
            [x, -0.012, 0.075 - x * x * 2],
            [x + 0.004, -0.05 - i * 0.012, 0.07],
            [x - 0.002, -0.085 - i * 0.02, 0.062],
          ],
          0.0016,
          8
        )
      )
    ),
    keep(new THREE.MeshStandardMaterial({ color: "#c8c4a8", roughness: 0.1, transparent: true, opacity: 0.55 }))
  );
  drool.visible = false;

  // La mandíbula: cuelga de las bisagras de atrás y se abre de verdad.
  const jaw = k.pivot(skull, [0, 0.03, -0.085]);
  piece(
    jaw,
    flesh.at(
      flesh.blob([0.084, 0.058, 0.085], 14, (v) => {
        // Chata arriba, con el mentón para adelante y para abajo.
        if (v.y > 0) v.y *= 0.3;
        flesh.swell(v, [0, -0.035, 0.065], 0.055, 0.018);
        flesh.dent(v, [0, -0.02, -0.055], 0.06, 0.02);
        flesh.lumps(v, 24, 0.007, 6);
      }),
      [0, -0.082, 0.095]
    ),
    skinHead
  );
  // Las ramas que suben hasta la bisagra, debajo de la oreja.
  piece(
    jaw,
    flesh.fuse([-1, 1].map((s) => flesh.at(flesh.blob([0.017, 0.05, 0.02], 8), [s * 0.07, -0.05, 0.05]))),
    skinHead
  );
  piece(jaw, flesh.at(teeth(9, true, 4), [0, -0.062, 0.155]), bone);
  // La lengua, hinchada y quieta al fondo.
  piece(jaw, flesh.at(flesh.blob([0.03, 0.013, 0.045], 8), [0, -0.072, 0.12]), gore);

  /* lo que lleva puesto */

  // El espejo de cabeza, en la vincha de cuero, torcido sobre una ceja.
  const bandGeometry = new THREE.TorusGeometry(0.108, 0.0065, 6, 24);
  bandGeometry.rotateX(Math.PI / 2);
  bandGeometry.scale(1, 1, 1.22);
  bandGeometry.rotateZ(-0.14);
  bandGeometry.translate(0, 0.215, 0);
  piece(skull, bandGeometry, leather);
  piece(
    skull,
    flesh.fuse([
      flesh.at(new THREE.TorusGeometry(0.03, 0.006, 5, 14), [0.052, 0.243, 0.118], [Math.PI / 2 - 1.05, 0, 0.3]),
      flesh.at(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 14), [0.052, 0.243, 0.116], [Math.PI / 2 - 1.05, 0, 0.3]),
      flesh.at(new THREE.BoxGeometry(0.009, 0.03, 0.006), [0.052, 0.228, 0.102], [0.3, 0, 0]),
    ]),
    metal
  );
  piece(skull, flesh.at(flesh.blob([0.006, 0.006, 0.004], 7), [0.052, 0.243, 0.121]), dark);

  // El barbijo, colgando de una oreja y pegado a la mejilla.
  const mask = piece(
    skull,
    flesh.fuse([
      flesh.at(
        flesh.cloth(
          0.105,
          0.07,
          (v) => {
            v.z -= (v.x / 0.052) ** 2 * 0.022;
            v.z += Math.sin(v.y * 40) * 0.005;
            if (v.y < -0.025) v.x *= 1.15;
          },
          [5, 4]
        ),
        [0.078, -0.075, 0.055],
        [0.1, -0.85, 1]
      ),
      flesh.thread(
        [
          [0.108, 0.08, -0.005],
          [0.115, 0.02, 0.03],
          [0.1, -0.04, 0.062],
        ],
        0.0026,
        8
      ),
    ]),
    coat
  );

  /* --- cómo se le pone la cara --- */

  let jawBase = 0;

  /** Abre la boca: los hilos se cortan, aparece la baba y la mandíbula se va de lado. */
  function openJaw(open: number, twist: number) {
    jawBase = open;
    jaw.rotation.set(open, twist * 0.5, twist);
    stitches.visible = open < 0.06;
    torn.visible = open >= 0.06;
    drool.visible = open >= 0.35;
  }

  /**
   * La cara de cuando se asoma por la puerta: la cabeza estirada, un ojo que se le sale de
   * la cuenca, el otro casi cerrado y la mandíbula descolgada de costado.
   */
  function twistFace(on: boolean) {
    skull.scale.set(on ? 0.94 : 1, on ? 1.13 : 1, on ? 1.04 : 1);
    skull.rotation.z = on ? 0.12 : 0;
    eyeSpins[0].scale.setScalar(on ? 1.45 : 1);
    eyeSpins[0].position.z = eyeZ + (on ? 0.016 : 0);
    eyeSpins[1].scale.set(on ? 0.85 : 1, on ? 0.5 : 1, 1);
    mask.visible = !on;
    openJaw(on ? 0.62 : 0, on ? 0.2 : 0);
  }
  const calm = (pose: (r: Rig) => void) => (r: Rig) => {
    twistFace(false);
    pose(r);
  };

  scene.add(root);
  const rig: Rig = { root, body, head, arms, legs, torso };
  return figure(
    rig,
    2.25,
    1.55,
    {
      emerge: calm((r) => {
        r.body.position.y = -1.3;
        armPoses.up(r);
        r.head.rotation.x = -0.5;
      }),
      wait: calm((r) => {
        armPoses.onDoor(r);
        r.head.rotation.set(0.25, 0, 0.35);
      }),
      stand: calm((r) => {
        armPoses.hang(r, 0.1);
        r.arms[1].rotation.x = -0.25;
        r.head.rotation.set(0.1, 0, -0.25);
      }),
      reach: calm((r) => {
        armPoses.reach(r);
        r.head.rotation.set(0, 0, -0.3);
      }),
      // Parado quieto en la oscuridad, con la cara levantada hacia la cámara del techo.
      peek: calm((r) => {
        armPoses.hang(r, 0.05);
        r.head.rotation.set(-0.7, 0, 0.2);
      }),
      sit: calm((r) => {
        armPoses.hang(r);
      }),
      // Parado en el vano de la puerta abierta, con la cabeza asomada al hall.
      lurk(r) {
        twistFace(true);
        r.body.rotation.x = 0.15;
        r.arms[0].rotation.set(0.6, 0, -0.05);
        r.arms[1].rotation.set(0.6, 0, 0.05);
        r.head.rotation.set(-0.15, 0.6, -1.05);
      },
    },
    (r, on) => {
      twistFace(false);
      mask.visible = !on;
      openJaw(on ? 0.95 : 0, on ? -0.12 : 0);
      for (const socket of eyeSpins) socket.scale.setScalar(on ? 1.25 : 1);
      if (on) {
        armPoses.reach(r);
        // Levanta la cara del piso: con el cuello quebrado y la joroba, si no mira los pies.
        r.head.rotation.set(-0.45, 0, -0.4);
      }
    },
    (on) => {
      for (const glow of glows) glow.visible = on;
      for (const spark of sparks) spark.visible = !on;
    },
    (time) => {
      // Respira, pero mal: toma aire de a poco y lo suelta de golpe.
      const breath = Math.sin(time * 1.15);
      chest.scale.set(1 + breath * 0.018, 1 - breath * 0.006, 1 + breath * 0.03);
      // La mandíbula le tiembla, y más cuanto más abierta la tiene.
      jaw.rotation.x = jawBase + Math.sin(time * 19) * 0.005 * (1 + jawBase * 5);
      // Los ojos no se quedan quietos nunca.
      const dart = Math.sin(time * 0.7) + Math.sin(time * 1.9) * 0.4;
      for (const socket of eyeSpins) socket.rotation.set(dart * 0.08, dart * 0.15, 0);
    }
  );
}

/* ---------------- la Muñeca ---------------- */

export function makeDoll(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);

  const chinaArt = flesh.porcelainTexture("#ded6c4", 31, 0.35);
  const dressArt = flesh.clothTexture("#2a6d73", 44, 0.45);
  const chance = flesh.dice(93);

  function surface(color: string, art: THREE.CanvasTexture | null, repeat: number, bump: number, roughness: number, side?: THREE.Side) {
    const map = (repeat === 1 ? art : art?.clone()) ?? null;
    if (map && map !== art) {
      map.repeat.set(repeat, repeat);
      map.needsUpdate = true;
    }
    if (map) keep(map);
    const bumpMap = flesh.relief(map);
    if (bumpMap) keep(bumpMap);
    return keep(new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: bump, roughness, side: side ?? THREE.FrontSide }));
  }
  const plain = (color: string, roughness: number, metalness = 0) => keep(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(keep(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  // La porcelana brilla, así que va lisa y con poco relieve: lo que se ve son las grietas.
  const china = surface("#ffffff", chinaArt, 1, 0.25, 0.35);
  const chinaBody = surface("#f4f0e6", chinaArt, 2, 0.3, 0.38);
  const dress = surface("#ffffff", dressArt, 1, 0.6, 0.95, THREE.DoubleSide);
  const hollow = plain("#050404", 1);
  const wet = plain("#33090a", 0.25);
  const thread = plain("#141414", 0.9);
  const rose = plain("#6e3234", 0.8);
  const shoe = plain("#0d0d10", 0.6);

  /* --- las piernas: porcelana con las articulaciones a la vista --- */

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.07, 0.5, 0]), k.pivot(body, [0.07, 0.5, 0])];
  legs.forEach((leg, side) => {
    piece(leg, flesh.limb(0.24, 0.042, 0.032, { rough: 0.02, seed: side }), chinaBody);
    // La rótula de bisagra, una bola que gira en el hueco.
    piece(leg, flesh.at(flesh.blob([0.045, 0.045, 0.045], 10), [0, -0.25, 0]), chinaBody);
    piece(leg, flesh.at(flesh.limb(0.2, 0.034, 0.028, { rough: 0.02, seed: 3 + side }), [0, -0.26, 0]), chinaBody);
    piece(
      leg,
      flesh.at(
        flesh.blob([0.046, 0.032, 0.075], 10, (v) => {
          v.y = Math.max(v.y, -0.016);
          flesh.swell(v, [0, 0, 0.06], 0.04, 0.006);
        }),
        [0, -0.455, 0.02]
      ),
      shoe
    );
    // Una media caída, con el elástico comido.
    piece(
      leg,
      flesh.at(
        flesh.limb(0.12, 0.038, 0.036, { rough: 0.05, seed: 7 + side }),
        [0, -0.3 - side * 0.05, 0]
      ),
      dress
    );
  });

  /* --- el cuerpo: vestido de fiesta arruinado --- */

  const torso = k.pivot(body, [0, 0.5, 0]);
  piece(torso, flesh.at(flesh.limb(0.08, 0.045, 0.06, { rough: 0.03 }), [0, 0.6, 0]), chinaBody);
  piece(torso, flesh.at(flesh.limb(0.24, 0.115, 0.105, { rough: 0.04 }), [0, 0.53, 0]), dress);
  // La pollera: acampanada, con pliegues que bajan y el ruedo hecho tiras.
  piece(
    torso,
    flesh.sculpt(new THREE.CylinderGeometry(0.11, 0.27, 0.44, 30, 8, true), (v) => {
      const t = v.y / 0.44 + 0.5;
      const angle = Math.atan2(v.z, v.x);
      const fold = 1 + Math.sin(angle * 11) * 0.09 * (1 - t);
      v.x *= fold;
      v.z *= fold;
      if (t < 0.12) v.y += flesh.fbm(v.x * 18, v.z * 18, 0, 2) * 0.07;
    }).translate(0, 0.12, 0),
    dress
  );
  // El cuello de encaje, ya gris.
  piece(torso, flesh.at(new THREE.TorusGeometry(0.095, 0.018, 5, 18), [0, 0.555, 0], [Math.PI / 2, 0, 0]), dress);
  // La faja de la cintura, corrida.
  piece(torso, flesh.at(new THREE.TorusGeometry(0.115, 0.016, 4, 20), [0, 0.32, 0], [Math.PI / 2 + 0.12, 0, 0]), dress);

  /* --- los brazos: uno entero y el otro sin dedos --- */

  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.13, 0.52, 0]), k.pivot(torso, [0.13, 0.52, 0])];
  arms.forEach((shoulder, side) => {
    piece(shoulder, flesh.at(flesh.blob([0.04, 0.04, 0.04], 10), [0, 0, 0]), chinaBody);
    piece(shoulder, flesh.limb(0.17, 0.03, 0.026, { rough: 0.02, seed: 9 + side }), chinaBody);
    const elbow = k.pivot(shoulder, [0, -0.17, 0]);
    piece(elbow, flesh.at(flesh.blob([0.032, 0.032, 0.032], 9), [0, 0, 0]), chinaBody);
    piece(elbow, flesh.limb(0.16, 0.026, 0.022, { rough: 0.02, seed: 12 + side }), chinaBody);
    const hand = k.pivot(elbow, [0, -0.16, 0]);
    const bits = [flesh.at(flesh.blob([0.026, 0.03, 0.016], 9), [0, -0.02, 0])];
    // A una mano le quedan tres dedos; la otra se rompió en la muñeca.
    if (side === 1) {
      for (let i = 0; i < 3; i++) {
        bits.push(flesh.at(flesh.limb(0.035, 0.008, 0.006, { rings: 2, radial: 6 }), [(i - 1) * 0.015, -0.04, 0.004]));
      }
    } else {
      bits.push(flesh.at(flesh.blob([0.022, 0.012, 0.018], 8), [0, -0.045, 0]));
    }
    piece(hand, flesh.fuse(bits), chinaBody);
    if (side === 0) piece(hand, flesh.at(flesh.blob([0.019, 0.016, 0.016], 8), [0, -0.05, 0]), hollow);
  });

  /* --- la cabeza: demasiado grande y rota --- */

  const head = k.pivot(torso, [0, 0.6, 0]);
  const skull = k.pivot(head, [0, 0, 0]);
  piece(
    skull,
    flesh.at(
      flesh.blob([0.168, 0.182, 0.158], 22, (v) => {
        // Frente de nena, mentón chiquito y en punta.
        flesh.swell(v, [0, 0.085, 0.1], 0.11, 0.012);
        const low = Math.max(0, (-v.y - 0.04) / 0.14);
        v.x *= 1 - 0.35 * low;
        v.z *= 1 - 0.25 * low;
        // La cuenca vacía, honda; del otro lado apenas el hueco del botón.
        flesh.dent(v, [-0.064, 0.015, 0.125], 0.055, 0.06);
        flesh.dent(v, [0.062, 0.012, 0.13], 0.05, 0.018);
        // El pedazo que le falta arriba, y la grieta que baja del ojo vacío.
        flesh.dent(v, [-0.1, 0.115, 0.02], 0.085, 0.05);
        flesh.dent(v, [-0.07, -0.05, 0.11], 0.05, 0.012);
        flesh.lumps(v, 34, 0.0018, 5);
      }),
      [0, 0.16, 0]
    ),
    china
  );
  // Adentro está hueca: por el agujero del ojo y por donde le falta el pedazo se ve negro.
  piece(skull, flesh.at(flesh.blob([0.15, 0.162, 0.14], 14), [0, 0.16, 0]), hollow);
  piece(skull, flesh.at(flesh.blob([0.045, 0.05, 0.035], 10), [-0.066, 0.175, 0.105]), hollow);
  piece(skull, flesh.at(flesh.blob([0.06, 0.05, 0.05], 10), [-0.105, 0.275, 0.01]), hollow);

  // El botón que le queda de ojo, con los hilos todavía puestos.
  const eyeSpin = k.pivot(skull, [0.062, 0.172, 0.138]);
  piece(eyeSpin, flesh.at(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 14), [0, 0, 0], [Math.PI / 2, 0, 0]), plain("#08090b", 0.25));
  const shine = k.ball(eyeSpin, "#6ff2ff", [0.007, 0.007, 0.007], [0, 0, 0.007], true);
  const shineBase = shine.scale.clone();
  piece(
    eyeSpin,
    flesh.fuse([
      flesh.thread(
        [
          [-0.012, 0.012, 0.008],
          [0.012, -0.012, 0.008],
        ],
        0.0025,
        3
      ),
      flesh.thread(
        [
          [0.012, 0.012, 0.008],
          [-0.012, -0.012, 0.008],
        ],
        0.0025,
        3
      ),
    ]),
    thread
  );
  // Del ojo que falta cuelga el hilo con el que estaba cosido, y lo que le chorreó.
  piece(
    skull,
    flesh.fuse([
      flesh.thread(
        [
          [-0.066, 0.15, 0.115],
          [-0.072, 0.1, 0.13],
          [-0.06, 0.05, 0.12],
        ],
        0.0022,
        8
      ),
    ]),
    thread
  );
  piece(
    skull,
    flesh.fuse([
      ...[-0.075, -0.055].map((x, i) =>
        flesh.thread(
          [
            [x, 0.14, 0.125],
            [x - 0.004, 0.08 - i * 0.02, 0.135],
            [x + 0.004, 0.02 - i * 0.03, 0.115],
          ],
          0.004,
          8
        )
      ),
    ]),
    wet
  );
  // Las mejillas pintadas, corridas.
  piece(
    skull,
    flesh.fuse([-1, 1].map((s) => flesh.at(flesh.blob([0.023, 0.014, 0.003], 8), [s * 0.09, 0.103, 0.14]))),
    rose
  );
  // La nariz, apenas un botoncito.
  piece(skull, flesh.at(flesh.blob([0.016, 0.014, 0.012], 8), [0, 0.13, 0.155]), china);

  // La sonrisa: la porcelana se abrió de oreja a oreja y adentro hay dientitos parejos.
  const mouth = piece(
    skull,
    flesh.at(
      flesh.blob([0.062, 0.013, 0.022], 12, (v) => {
        // Las puntas se levantan: sonríe más de lo que puede una cara.
        v.y += (v.x / 0.062) ** 2 * 0.016;
      }),
      [0, 0.072, 0.136]
    ),
    hollow
  );
  const smile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8 - 0.5;
    const x = t * 0.108;
    const y = 0.078 + t * t * 0.055;
    const z = 0.145 - t * t * 0.14;
    smile.push(flesh.at(flesh.limb(0.012, 0.006, 0.003, { rings: 2, radial: 5 }), [x, y + 0.007, z]));
    smile.push(flesh.at(flesh.limb(0.011, 0.0055, 0.003, { rings: 2, radial: 5 }), [x + 0.006, y - 0.018, z], [0, 0, Math.PI]));
  }
  const teeth = piece(skull, flesh.fuse(smile), china);
  // La grieta que cruza la cara entera, de la frente al mentón.
  piece(
    skull,
    flesh.fuse([
      flesh.thread(
        [
          [-0.02, 0.33, 0.06],
          [0.01, 0.26, 0.12],
          [-0.01, 0.19, 0.15],
          [0.02, 0.12, 0.15],
          [0.05, 0.04, 0.12],
          [0.04, -0.01, 0.08],
        ],
        0.0035,
        20
      ),
      flesh.thread(
        [
          [-0.105, 0.2, 0.1],
          [-0.14, 0.13, 0.06],
          [-0.15, 0.05, 0.02],
        ],
        0.003,
        10
      ),
    ]),
    hollow
  );

  // El pelo: mechones apelmazados que caen, y algunos parados.
  const hair: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) {
    // De la coronilla para atrás: adelante no cae ni un pelo, para que la cara se vea.
    const angle = 0.95 + (i / 39) * (Math.PI * 2 - 1.9);
    const wild = chance();
    const long = 0.16 + wild * 0.24;
    const x = Math.sin(angle) * 0.155;
    const z = Math.cos(angle) * 0.14 - 0.01;
    hair.push(
      flesh.thread(
        [
          [x, 0.31, z],
          [x * 1.25, 0.31 - long * 0.35, z * 1.2 + (wild - 0.5) * 0.03],
          [x * 1.35 + (wild - 0.5) * 0.04, 0.31 - long * 0.75, z * 1.15],
          [x * 1.15, 0.31 - long, z * 0.95 + (wild - 0.5) * 0.05],
        ],
        0.0045 + wild * 0.004,
        7
      )
    );
  }
  piece(skull, flesh.fuse(hair), plain("#1a120c", 0.85));
  // El moño de la cabeza, torcido.
  piece(
    skull,
    flesh.fuse([
      flesh.at(new THREE.TorusGeometry(0.036, 0.009, 4, 12), [0.09, 0.3, 0.01], [1.3, 0.5, 0.5]),
      flesh.at(new THREE.TorusGeometry(0.03, 0.008, 4, 12), [0.125, 0.285, -0.015], [1.3, 0.5, -0.5]),
    ]),
    dress
  );

  scene.add(root);
  const rig: Rig = { root, body, head, arms, legs, torso };
  return figure(
    rig,
    1.26,
    0.55,
    {
      // Sentada en el piso, con las piernas estiradas y la cabeza caída de costado.
      sit(r) {
        r.body.position.y = -0.46;
        for (const leg of r.legs!) leg.rotation.x = -1.5;
        armPoses.hang(r, 0.3);
        r.head.rotation.set(0.2, 0, 0.7);
      },
      stand(r) {
        armPoses.hang(r, 0.15);
        r.head.rotation.set(0, 0, 0.35);
      },
      // Debajo de la cámara, mirando para arriba con los brazos estirados.
      reach(r) {
        armPoses.up(r);
        r.head.rotation.set(-0.8, 0, 0.15);
      },
      emerge(r) {
        armPoses.hang(r);
      },
      wait(r) {
        armPoses.hang(r);
      },
      peek(r) {
        armPoses.hang(r);
      },
    },
    (r, on) => {
      mouth.scale.set(1, on ? 3.4 : 1, on ? 1.6 : 1);
      teeth.visible = !on;
      if (on) {
        armPoses.reach(r);
        r.head.rotation.set(0, 0, 0);
      }
    },
    (on) => {
      shine.scale.copy(shineBase).multiplyScalar(on ? 3.4 : 1);
    },
    (time) => {
      // No respira. Cada tanto la cabeza se le mueve un grado, y el botón titila.
      const twitch = Math.sin(time * 0.6) > 0.985 ? 1 : 0;
      skull.rotation.z = twitch * 0.06;
      skull.position.x = twitch * 0.004;
      shine.visible = Math.sin(time * 7.3) > -0.85;
    }
  );
}

/* ---------------- la Mujer ---------------- */

export function makeWoman(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);

  const skinArt = flesh.skinTexture("#a9b0ac", 63, 0.4);
  const gownArt = flesh.clothTexture("#8e8c80", 71, 0.5);
  const chance = flesh.dice(211);

  function surface(color: string, art: THREE.CanvasTexture | null, repeat: number, bump: number, roughness: number, side?: THREE.Side) {
    const map = (repeat === 1 ? art : art?.clone()) ?? null;
    if (map && map !== art) {
      map.repeat.set(repeat, repeat);
      map.needsUpdate = true;
    }
    if (map) keep(map);
    const bumpMap = flesh.relief(map);
    if (bumpMap) keep(bumpMap);
    return keep(new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: bump, roughness, side: side ?? THREE.FrontSide }));
  }
  const plain = (color: string, roughness: number, metalness = 0) => keep(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(keep(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  // Ahogada: la piel gris y pesada, el camisón empapado y pegado al cuerpo.
  const skin = surface("#ffffff", skinArt, 1, 0.45, 0.72);
  const skinBody = surface("#f2f4f2", skinArt, 2, 0.5, 0.75);
  const gown = surface("#ffffff", gownArt, 1, 0.65, 0.88, THREE.DoubleSide);
  const dark = plain("#050505", 1);
  const wet = plain("#2c0b09", 0.22);
  const nailMat = plain("#1d1a1c", 0.4);
  const mane = plain("#050506", 0.42);

  const torso = k.pivot(body, [0, 0, 0]);

  /* --- el camisón: mojado, pegado y arrastrando --- */

  piece(
    torso,
    flesh
      .sculpt(new THREE.CylinderGeometry(0.1, 0.37, 1.4, 30, 12, true), (v) => {
        const t = v.y / 1.4 + 0.5;
        const angle = Math.atan2(v.z, v.x);
        // Pegado arriba, suelto abajo: la tela mojada marca el cuerpo y después cae.
        const cling = 1 - Math.max(0, t - 0.55) * 0.5;
        const fold = 1 + Math.sin(angle * 13 + t * 4) * (0.02 + (1 - t) * 0.06);
        v.x *= fold * cling;
        v.z *= fold * cling;
        // Se arrastra: el ruedo se alarga hacia atrás y está comido.
        if (t < 0.1) {
          v.y += flesh.fbm(v.x * 14, v.z * 14, 0, 2) * 0.12;
          if (v.z < 0) v.z *= 1.35;
        }
      })
      .translate(0, 0.7, 0),
    gown
  );
  // Lo que le gotea del ruedo, ahí parada.
  piece(
    torso,
    flesh.drips(
      [
        [-0.2, 0.06, 0.24],
        [0.1, 0.04, 0.3],
        [0.26, 0.05, -0.1],
        [-0.28, 0.03, -0.14],
      ],
      chance
    ),
    wet
  );

  /* --- el cuerpo: los huesos marcados bajo la tela --- */

  piece(
    torso,
    flesh.at(
      flesh.blob([0.17, 0.26, 0.11], 16, (v) => {
        for (const s of [-1, 1]) {
          // Clavículas y hombros: lo único que se le nota de cuerpo.
          flesh.ridge(v, [s * 0.02, 0.16, 0.08], [s * 0.14, 0.18, 0.005], 0.03, 0.02);
          flesh.swell(v, [s * 0.15, 0.2, 0], 0.08, 0.018);
        }
        flesh.dent(v, [0, 0.02, 0.1], 0.14, 0.03);
        flesh.lumps(v, 14, 0.008, 2);
      }),
      [0, 1.32, 0]
    ),
    skinBody
  );
  // Los breteles del camisón, uno caído del hombro.
  piece(
    torso,
    flesh.fuse(
      [-1, 1].map((side) =>
        flesh.thread(
          [
            [side * 0.055, 1.38, 0.075],
            [side * (0.13 + (side < 0 ? 0.03 : 0)), 1.44 - (side < 0 ? 0.07 : 0), 0.03],
            [side * 0.1, 1.38, -0.06],
          ],
          0.012,
          8
        )
      )
    ),
    gown
  );

  /* --- los brazos: largos, flacos, con las uñas negras --- */

  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.195, 1.46, 0]), k.pivot(torso, [0.195, 1.46, 0])];
  arms.forEach((shoulder, side) => {
    piece(shoulder, flesh.limb(0.5, 0.034, 0.026, { bend: (side ? 1 : -1) * 0.01, rough: 0.07, seed: side }), skinBody);
    const elbow = k.pivot(shoulder, [0, -0.5, 0]);
    elbow.rotation.x = -0.12;
    piece(
      elbow,
      flesh.fuse([
        flesh.at(flesh.blob([0.032, 0.036, 0.032], 9, (v) => flesh.lumps(v, 28, 0.007, side)), [0, 0, 0]),
        flesh.at(flesh.limb(0.5, 0.026, 0.02, { rough: 0.07, seed: 4 + side }), [0, 0, 0]),
      ]),
      skinBody
    );
    const hand = k.pivot(elbow, [0, -0.5, 0]);
    const bits = [flesh.at(flesh.blob([0.028, 0.042, 0.017], 10, (v) => flesh.dent(v, [0, -0.01, 0.017], 0.035, 0.01)), [0, -0.025, 0])];
    const nails: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 0.014;
      const long = 0.17 - Math.abs(i - 2) * 0.018;
      let y = -0.05;
      let z = 0.004;
      let angle = -0.1;
      for (let s = 0; s < 2; s++) {
        const bone = flesh.limb(long * (s ? 0.45 : 0.55), 0.0075 - s * 0.0015, 0.0065 - s * 0.0015, { rough: 0.16, seed: 20 + i, rings: 3, radial: 7 });
        bone.rotateX(angle);
        bone.translate(spread, y, z);
        bits.push(bone);
        bits.push(flesh.at(flesh.blob([0.009, 0.008, 0.009], 5), [spread, y, z]));
        y -= Math.cos(angle) * long * (s ? 0.45 : 0.55);
        z -= Math.sin(angle) * long * (s ? 0.45 : 0.55);
        angle -= 0.22;
      }
      const nail = flesh.limb(0.026, 0.006, 0.0005, { rings: 2, radial: 6 });
      nail.rotateX(angle + 0.22);
      nail.translate(spread, y, z);
      nails.push(nail);
    }
    piece(hand, flesh.fuse(bits), skinBody);
    piece(hand, flesh.fuse(nails), nailMat);
  });

  /* --- el cuello quebrado --- */

  piece(
    torso,
    flesh.fuse([
      flesh.at(flesh.limb(0.14, 0.038, 0.034, { rough: 0.05, seed: 9 }), [0, 1.62, 0]),
      // Las vértebras salidas, del lado en que se le fue la cabeza.
      ...[0, 1, 2].map((i) => flesh.at(flesh.blob([0.015, 0.011, 0.012], 7), [0.004 * i, 1.52 + i * 0.035, -0.03])),
    ]),
    skinBody
  );
  // La marca que le dejó algo apretado alrededor del cuello.
  piece(torso, flesh.at(new THREE.TorusGeometry(0.037, 0.005, 4, 14), [0, 1.55, 0], [Math.PI / 2 + 0.2, 0, 0]), wet);

  /* --- la cabeza: la cara de abajo del pelo --- */

  const head = k.pivot(torso, [0, 1.62, 0]);
  // Todo lo de la cabeza cuelga acá adentro: así se puede mecer sin pisar la pose.
  const sway = k.pivot(head, [0, 0, 0]);
  piece(
    sway,
    flesh.at(
      flesh.blob([0.105, 0.138, 0.115], 20, (v) => {
        // Hinchada abajo y chupada arriba: la cara de la que estuvo mucho en el agua.
        for (const s of [-1, 1]) {
          flesh.dent(v, [s * 0.045, 0.03, 0.095], 0.05, 0.05);
          flesh.dent(v, [s * 0.078, -0.03, 0.07], 0.055, 0.022);
          flesh.swell(v, [s * 0.08, 0.055, 0.03], 0.05, 0.01);
        }
        flesh.swell(v, [0, -0.085, 0.07], 0.07, 0.018);
        flesh.dent(v, [0, -0.02, 0.115], 0.03, 0.022);
        flesh.lumps(v, 16, 0.006, 7);
        flesh.lumps(v, 44, 0.002, 3);
      }),
      [0, 0.05, 0]
    ),
    skin
  );
  // Las dos cuencas vacías; en una todavía hay algo que mira.
  piece(sway, flesh.fuse([-1, 1].map((s) => flesh.at(flesh.blob([0.03, 0.028, 0.02], 9), [s * 0.045, 0.08, 0.088]))), dark);
  const shine = k.ball(sway, "#c8ff6a", [0.008, 0.008, 0.008], [0.045, 0.08, 0.105], true);
  const shineBase = shine.scale.clone();
  // La boca abierta, quieta, con los dientes chicos adentro.
  const mouth = piece(sway, flesh.at(flesh.blob([0.032, 0.012, 0.022], 10), [0, -0.035, 0.1]), dark);
  piece(
    sway,
    flesh.fuse(
      [0, 1, 2, 3, 4, 5].map((i) => {
        const t = i / 5 - 0.5;
        return flesh.at(flesh.limb(0.012, 0.005, 0.003, { rings: 2, radial: 5 }), [t * 0.05, -0.026, 0.104 - t * t * 0.06]);
      })
    ),
    plain("#b8b09a", 0.5)
  );
  // Lo que le sigue saliendo por la boca y por las cuencas.
  piece(
    sway,
    flesh.fuse([
      ...[-0.045, 0.045].map((x) =>
        flesh.thread(
          [
            [x, 0.06, 0.1],
            [x + 0.004, 0.01, 0.1],
            [x, -0.05, 0.085],
          ],
          0.0035,
          8
        )
      ),
      flesh.thread(
        [
          [0.01, -0.042, 0.098],
          [0.014, -0.08, 0.085],
          [0.008, -0.13, 0.06],
        ],
        0.0045,
        8
      ),
    ]),
    wet
  );

  /* el pelo: la cortina de adelante se abre cuando grita */

  const strands = (count: number, from: number, to: number, long: number, radius: number, seed: number) => {
    const roll = flesh.dice(seed);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < count; i++) {
      const angle = from + (i / (count - 1)) * (to - from);
      // El hueco por donde mira: ahí no cae ningún mechón.
      if (angle > 0.2 && angle < 0.62) continue;
      const wild = roll();
      const drop = long * (0.6 + wild * 0.8);
      const x = Math.sin(angle) * 0.108;
      const z = Math.cos(angle) * 0.115;
      parts.push(
        flesh.thread(
          [
            [x * 0.5, 0.17, z * 0.5],
            [x * 1.05, 0.12, z * 1.05],
            [x * 1.1 + (wild - 0.5) * 0.02, 0.04 - drop * 0.3, z * 1.06],
            [x * 1.0 + (wild - 0.5) * 0.04, 0.04 - drop * 0.7, z * 0.98 + (wild - 0.5) * 0.03],
            [x * 0.92, 0.04 - drop, z * 0.9],
          ],
          radius * (0.7 + wild * 0.6),
          9
        )
      );
    }
    return flesh.fuse(parts);
  };
  // Atrás y a los costados cae hasta la cintura; adelante, una cortina que tapa la cara.
  piece(sway, strands(34, 0.9, Math.PI * 2 - 0.9, 0.95, 0.007, 5), mane);
  const veil = piece(sway, strands(22, -0.95, 0.95, 0.62, 0.0065, 11), mane);
  // La coronilla, para que no se vea el cuero cabelludo entre mechón y mechón.
  piece(sway, flesh.at(flesh.blob([0.113, 0.085, 0.118], 12), [0, 0.115, -0.008]), mane);

  scene.add(root);
  const rig: Rig = { root, body, head, arms, torso };
  return figure(
    rig,
    1.67,
    1.2,
    {
      emerge(r) {
        r.body.position.y = -1.05;
        armPoses.up(r);
        r.head.rotation.x = -0.3;
      },
      wait(r) {
        armPoses.onDoor(r);
        r.head.rotation.set(0.35, 0, 0);
      },
      stand(r) {
        armPoses.hang(r, 0.05);
        r.head.rotation.set(0.1, 0, 0.25);
      },
      reach(r) {
        armPoses.reach(r);
      },
      peek(r) {
        armPoses.hang(r);
      },
      sit(r) {
        armPoses.hang(r);
      },
    },
    (r, on) => {
      mouth.scale.set(on ? 1.4 : 1, on ? 3.8 : 1, on ? 1.4 : 1);
      mouth.position.y = on ? -0.05 : -0.035;
      // Al gritar se le abre el pelo y queda la cara a la vista.
      veil.visible = !on;
      if (on) {
        armPoses.reach(r);
        r.head.rotation.set(-0.25, 0, 0.1);
      }
    },
    (on) => {
      shine.scale.copy(shineBase).multiplyScalar(on ? 3 : 1);
    },
    (time) => {
      // No respira: se balancea, apenas, como si algo la sostuviera del cuello.
      sway.rotation.z = Math.sin(time * 0.45) * 0.05 + 0.02;
      sway.position.x = Math.sin(time * 0.45) * 0.008;
    }
  );
}

/* ---------------- el Hombre árbol ---------------- */

export function makeTreeMan(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);

  const barkArt = flesh.barkTexture("#4e3b29", 55, 0.35);
  const sackArt = flesh.clothTexture("#9b8560", 77, 0.9);
  const chance = flesh.dice(307);

  function surface(color: string, art: THREE.CanvasTexture | null, repeat: number, bump: number, roughness: number, side?: THREE.Side) {
    const map = (repeat === 1 ? art : art?.clone()) ?? null;
    if (map && map !== art) {
      map.repeat.set(repeat, repeat);
      map.needsUpdate = true;
    }
    if (map) keep(map);
    const bumpMap = flesh.relief(map);
    if (bumpMap) keep(bumpMap);
    return keep(new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: bump, roughness, side: side ?? THREE.FrontSide }));
  }
  const plain = (color: string, roughness: number) => keep(new THREE.MeshStandardMaterial({ color, roughness }));
  function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(keep(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  const bark = surface("#ffffff", barkArt, 1, 1.1, 0.95);
  const barkFine = surface("#e8e2d8", barkArt, 3, 1.1, 0.95);
  const sack = surface("#ffffff", sackArt, 1, 0.9, 1, THREE.DoubleSide);
  const moss = plain("#2b3a1d", 1);
  const dark = plain("#040403", 1);
  const splinter = plain("#c9b48a", 0.7);
  const cord = plain("#171008", 0.9);
  const wet = plain("#33090a", 0.3);

  /** Una rama que se abre en otras: sirve igual para las astas y para los dedos. */
  function twig(parts: THREE.BufferGeometry[], from: flesh.Vec, yaw: number, pitch: number, long: number, radius: number, depth: number) {
    const dx = Math.sin(yaw) * Math.cos(pitch);
    const dy = Math.sin(pitch);
    const dz = Math.cos(yaw) * Math.cos(pitch);
    const end: flesh.Vec = [from[0] + dx * long, from[1] + dy * long - long * 0.1, from[2] + dz * long];
    parts.push(
      flesh.thread(
        [
          from,
          [from[0] + dx * long * 0.5, from[1] + dy * long * 0.5 - long * 0.03, from[2] + dz * long * 0.5],
          end,
        ],
        radius,
        5
      )
    );
    if (depth <= 0) return end;
    for (const turn of [-1, 1]) {
      twig(
        parts,
        end,
        yaw + turn * (0.5 + chance() * 0.5),
        pitch + (chance() - 0.35) * 0.7,
        long * (0.52 + chance() * 0.22),
        radius * 0.62,
        depth - 1
      );
    }
    return end;
  }

  /* --- las piernas: dos troncos con raíces --- */

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.13, 1.0, 0]), k.pivot(body, [0.13, 1.0, 0])];
  legs.forEach((leg, i) => {
    piece(
      leg,
      flesh.sculpt(flesh.limb(1.0, 0.085, 0.075, { bend: i ? -0.03 : 0.03, rough: 0.14, seed: i * 5, rings: 14, radial: 14 }), (v) => {
        // Los surcos que corren a lo largo del tronco.
        const angle = Math.atan2(v.z, v.x);
        const groove = 1 + Math.sin(angle * 7 + v.y * 5) * 0.16;
        v.x *= groove;
        v.z *= groove;
      }),
      bark
    );
    // Las raíces, que se abren y se meten en la tierra.
    const roots: THREE.BufferGeometry[] = [];
    for (let r = 0; r < 6; r++) {
      const angle = (r / 6) * Math.PI * 2 + i;
      twig(roots, [0, -0.92, 0], angle, -0.55 - chance() * 0.5, 0.26 + chance() * 0.12, 0.022, 1);
    }
    piece(leg, flesh.fuse(roots), barkFine);
  });

  /* --- el tronco --- */

  const torso = k.pivot(body, [0, 1.0, 0]);
  torso.rotation.x = 0.28;
  piece(
    torso,
    flesh.at(
      flesh.sculpt(flesh.limb(0.98, 0.2, 0.145, { rough: 0.1, seed: 3, rings: 16, radial: 18 }), (v) => {
        const angle = Math.atan2(v.z, v.x);
        // Varios palos retorcidos que crecieron juntos, no un tronco liso.
        const twistAngle = angle + v.y * 1.4;
        const groove = 1 + Math.sin(twistAngle * 5) * 0.2 + Math.sin(twistAngle * 13) * 0.06;
        v.x *= groove;
        v.z *= groove;
      }),
      [0, 0.98, 0]
    ),
    bark
  );
  // Nudos: el árbol se cerró alrededor de algo y quedó la marca.
  piece(
    torso,
    flesh.fuse([
      flesh.at(
        flesh.blob([0.09, 0.08, 0.05], 12, (v) => {
          flesh.dent(v, [0, 0, 0.05], 0.05, 0.03);
          flesh.lumps(v, 30, 0.01, 4);
        }),
        [0.07, 0.62, 0.13]
      ),
      flesh.at(
        flesh.blob([0.06, 0.07, 0.04], 12, (v) => {
          flesh.dent(v, [0, 0, 0.04], 0.04, 0.025);
        }),
        [-0.1, 0.32, 0.11]
      ),
    ]),
    bark
  );
  piece(torso, flesh.at(flesh.blob([0.05, 0.045, 0.02], 10), [0.07, 0.62, 0.15]), dark);
  // El musgo que le creció en el lado que no ve el sol.
  piece(
    torso,
    flesh.fuse([
      ...[0, 1, 2, 3, 4].map((i) =>
        flesh.at(
          flesh.blob([0.07 + chance() * 0.05, 0.05, 0.03], 9, (v) => flesh.lumps(v, 40, 0.012, i)),
          [-0.1 + chance() * 0.16, 0.2 + i * 0.16, -0.12 - chance() * 0.04]
        )
      ),
    ]),
    moss
  );
  // El manto de jirones y musgo colgado de los hombros.
  const cape: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 18; i++) {
    const angle = -1.5 + (i / 17) * 3;
    const long = 0.35 + chance() * 0.45;
    cape.push(
      flesh.at(
        flesh.cloth(
          0.05 + chance() * 0.03,
          long,
          (v) => {
            v.z += Math.sin(v.y * 26) * 0.012;
            if (v.y < -long / 2 + 0.03) v.y += flesh.fbm(v.x * 40, i, 0, 2) * 0.09;
          },
          [3, 7]
        ),
        [Math.sin(angle) * 0.24, 0.87 - long / 2, Math.cos(angle) * 0.17 - 0.02],
        [0, angle, 0]
      )
    );
  }
  piece(torso, flesh.fuse(cape), moss);

  /* --- los brazos: ramas que se abren en dedos --- */

  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.24, 0.85, 0]), k.pivot(torso, [0.24, 0.85, 0])];
  arms.forEach((shoulder, side) => {
    const sign = side ? 1 : -1;
    piece(shoulder, flesh.limb(0.66, 0.06, 0.045, { bend: sign * 0.03, rough: 0.16, seed: 7 + side, rings: 10 }), bark);
    const elbow = k.pivot(shoulder, [0, -0.66, 0]);
    elbow.rotation.x = -0.15;
    piece(
      elbow,
      flesh.fuse([
        flesh.at(flesh.blob([0.055, 0.05, 0.055], 10, (v) => flesh.lumps(v, 24, 0.014, side)), [0, 0, 0]),
        flesh.at(flesh.limb(0.66, 0.045, 0.032, { rough: 0.18, seed: 11 + side, rings: 10 }), [0, 0, 0]),
      ]),
      bark
    );
    const hand = k.pivot(elbow, [0, -0.66, 0]);
    // La mano es el final de la rama: cinco gajos que se siguen abriendo.
    const fingers: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      twig(fingers, [(i - 2) * 0.022, -0.02, 0.01], (i - 2) * 0.45, -1.15 - chance() * 0.3, 0.17 + chance() * 0.06, 0.012, 2);
    }
    piece(hand, flesh.fuse(fingers), barkFine);
    // Lo que le quedó en las ramas de la última vez.
    piece(hand, flesh.drips([[-0.03, -0.3, 0.02], [0.02, -0.34, 0.03], [0.05, -0.28, 0]], chance), wet);
    // Musgo colgando del codo.
    piece(
      elbow,
      flesh.fuse([0, 1, 2].map((m) => flesh.thread([[(m - 1) * 0.035, -0.3, 0.04], [(m - 1) * 0.04, -0.45 - m * 0.06, 0.05], [(m - 1) * 0.03, -0.6 - m * 0.1, 0.03]], 0.008, 6))),
      moss
    );
  });

  /* --- la cabeza: una bolsa cosida al cuello --- */

  const neck = k.pivot(torso, [0, 0.95, 0.04]);
  piece(neck, flesh.at(flesh.limb(0.1, 0.07, 0.055, { rough: 0.12, seed: 15 }), [0, 0.09, 0]), bark);
  const head = k.pivot(neck, [0, 0.08, 0]);
  piece(
    head,
    flesh.at(
      flesh.blob([0.175, 0.2, 0.165], 18, (v) => {
        // La arpillera no cae lisa: adentro hay algo que no es una cabeza.
        flesh.swell(v, [0.07, 0.06, 0.1], 0.08, 0.022);
        flesh.swell(v, [-0.09, -0.02, 0.06], 0.07, 0.018);
        flesh.dent(v, [0.062, 0.05, 0.135], 0.055, 0.045);
        flesh.dent(v, [-0.06, 0.05, 0.135], 0.05, 0.03);
        // Se cierra abajo, donde está atada.
        const low = Math.max(0, (-v.y - 0.06) / 0.14);
        v.x *= 1 - 0.45 * low;
        v.z *= 1 - 0.45 * low;
        flesh.lumps(v, 12, 0.012, 2);
        flesh.lumps(v, 34, 0.004, 8);
      }),
      [0, 0.17, 0]
    ),
    sack
  );
  // La soga con que la ataron al cuello, y las puntas de la arpillera arriba.
  piece(head, flesh.at(new THREE.TorusGeometry(0.075, 0.012, 5, 16), [0, 0.03, 0], [Math.PI / 2 - 0.1, 0, 0.1]), cord);
  piece(
    head,
    flesh.fuse([
      flesh.at(flesh.cloth(0.1, 0.13, (v) => (v.z += Math.sin(v.y * 40) * 0.01)), [0.06, 0.4, 0.02], [0.3, 0.4, 0.5]),
      flesh.at(flesh.cloth(0.08, 0.1, (v) => (v.z += Math.sin(v.y * 40) * 0.01)), [-0.05, 0.39, -0.01], [-0.2, -0.5, -0.6]),
    ]),
    sack
  );

  // Un ojo hundido con luz roja; el otro, cosido en cruz.
  piece(head, flesh.at(flesh.blob([0.045, 0.04, 0.03], 10), [0.062, 0.215, 0.118]), dark);
  const spark = k.ball(head, "#ff2a1f", [0.013, 0.013, 0.013], [0.062, 0.215, 0.14], true);
  const sparkBase = spark.scale.clone();
  piece(
    head,
    flesh.fuse([
      ...[-1, 1].map((t) =>
        flesh.thread(
          [
            [-0.085, 0.215 + t * 0.035, 0.125],
            [-0.06, 0.215, 0.145],
            [-0.035, 0.215 - t * 0.035, 0.125],
          ],
          0.004,
          6
        )
      ),
    ]),
    cord
  );

  // La boca: la arpillera se rajó de lado a lado y adentro hay astillas.
  const mouth = piece(head, flesh.at(flesh.blob([0.085, 0.03, 0.035], 12), [0, 0.1, 0.13]), dark);
  const fangs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8 - 0.5;
    const z = 0.15 - t * t * 0.18;
    fangs.push(flesh.at(flesh.limb(0.045 + chance() * 0.02, 0.009, 0.001, { rings: 2, radial: 5 }), [t * 0.15, 0.13, z], [0, 0, t * 0.4]));
    fangs.push(flesh.at(flesh.limb(0.035 + chance() * 0.02, 0.008, 0.001, { rings: 2, radial: 5 }), [t * 0.15 + 0.01, 0.07, z], [0, 0, Math.PI + t * 0.4]));
  }
  piece(head, flesh.fuse(fangs), splinter);
  // Lo que le salió por la raja y se secó en la arpillera.
  piece(
    head,
    flesh.fuse(
      [-0.05, 0.02, 0.06].map((x, i) =>
        flesh.thread(
          [
            [x, 0.085, 0.14 - x * x * 2],
            [x + 0.008, 0.03 - i * 0.015, 0.125],
            [x, -0.02 - i * 0.02, 0.09],
          ],
          0.005,
          8
        )
      )
    ),
    wet
  );
  // Los puntos con que cosieron la arpillera de un lado al otro de la cara.
  piece(
    head,
    flesh.fuse(
      [0, 1, 2, 3, 4, 5].map((i) =>
        flesh.thread(
          [
            [-0.13 + i * 0.05, 0.31, 0.11],
            [-0.11 + i * 0.05, 0.345, 0.1],
          ],
          0.0035,
          4
        )
      )
    ),
    cord
  );

  // El ojo tira luz roja alrededor: en el jardín oscuro, o en el hall sin luz, se ve venir.
  const eyeLight = new THREE.PointLight("#ff2a1f", 0.5, 2.8, 2);
  eyeLight.position.set(0.062, 0.215, 0.6);
  head.add(eyeLight);

  // Las astas: ramas secas que se abren en más ramas.
  const antlers: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    twig(antlers, [side * 0.1, 0.34, 0], side * 0.5, 1.15, 0.3, 0.018, 2);
  }
  piece(head, flesh.fuse(antlers), barkFine);

  scene.add(root);
  const rig: Rig = { root, body, head, arms, legs, torso };
  return figure(
    rig,
    2.2,
    1.7,
    {
      // Saliendo de la tierra entre los arbustos: solo la cabeza, las astas y las ramas.
      emerge(r) {
        r.body.position.y = -1.55;
        armPoses.up(r);
        r.head.rotation.x = -0.25;
      },
      // Contra el vidrio, con las manos apoyadas.
      wait(r) {
        armPoses.onDoor(r);
        r.head.rotation.set(0.1, 0, 0.3);
      },
      stand(r) {
        armPoses.hang(r, 0.2);
      },
      peek(r) {
        armPoses.hang(r, 0.1);
        r.head.rotation.set(0, 0, 0.5);
      },
      reach(r) {
        armPoses.reach(r);
      },
      sit(r) {
        armPoses.hang(r);
      },
    },
    (r, on) => {
      mouth.scale.set(1, on ? 2.6 : 1, on ? 1.3 : 1);
      if (on) armPoses.reach(r);
    },
    (on) => {
      spark.scale.copy(sparkBase).multiplyScalar(on ? 2.6 : 1);
    },
    (time) => {
      // Cruje como un árbol con viento, aunque adentro no corra nada de aire.
      head.rotation.y = Math.sin(time * 0.31) * 0.06;
      eyeLight.intensity = 0.5 + Math.sin(time * 2.1) * 0.12;
    }
  );
}

/* ---------------- el Retorcido ---------------- */

export function makeTwisted(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);

  const skinArt = flesh.skinTexture("#c2bbaa", 131, 0.75);
  const chance = flesh.dice(401);

  function surface(color: string, repeat: number, bump: number, roughness: number) {
    const map = (repeat === 1 ? skinArt : skinArt?.clone()) ?? null;
    if (map && map !== skinArt) {
      map.repeat.set(repeat, repeat);
      map.needsUpdate = true;
    }
    if (map) keep(map);
    const bumpMap = flesh.relief(map);
    if (bumpMap) keep(bumpMap);
    return keep(new THREE.MeshStandardMaterial({ color, map, bumpMap, bumpScale: bump, roughness }));
  }
  const plain = (color: string, roughness: number) => keep(new THREE.MeshStandardMaterial({ color, roughness }));
  function piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(keep(geometry), material);
    parent.add(mesh);
    return mesh;
  }

  // Piel estirada hasta donde da: se transparenta lo que tiene abajo.
  const skin = surface("#ffffff", 1, 0.55, 0.62);
  const skinBody = surface("#f6f2e8", 2, 0.6, 0.66);
  const dark = plain("#030303", 1);
  const raw = plain("#4e0b09", 0.3);
  const wet = plain("#2d0908", 0.22);
  const bone = plain("#d8ceb2", 0.55);
  const nailMat = plain("#1c1812", 0.45);
  const mane = plain("#0a0806", 0.5);

  /** Una mano de dedos largos, que se van cerrando hasta la uña. */
  function claw(hand: THREE.Object3D, span: number, long: number, curl: number, seed: number) {
    const bits: THREE.BufferGeometry[] = [flesh.at(flesh.blob([span * 1.1, long * 0.22, span * 0.6], 10, (v) => flesh.lumps(v, 30, 0.008, seed)), [0, -long * 0.13, 0])];
    const nails: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * span * 0.45;
      let y = -long * 0.22;
      let z = 0.004;
      let angle = curl * 0.5;
      for (let s = 0; s < 3; s++) {
        const part = long * [0.42, 0.32, 0.24][s];
        const geometry = flesh.limb(part, span * 0.2 - s * 0.002, span * 0.17 - s * 0.002, { rough: 0.18, seed: seed + i + s, rings: 3, radial: 7 });
        geometry.rotateX(angle);
        geometry.translate(x, y, z);
        bits.push(geometry);
        bits.push(flesh.at(flesh.blob([span * 0.24, span * 0.2, span * 0.24], 5), [x, y, z]));
        y -= Math.cos(angle) * part;
        z -= Math.sin(angle) * part;
        angle += curl;
      }
      const nail = flesh.limb(long * 0.14, span * 0.17, 0.0008, { rings: 2, radial: 6 });
      nail.rotateX(angle - curl);
      nail.translate(x, y, z);
      nails.push(nail);
    }
    piece(hand, flesh.fuse(bits), skinBody);
    piece(hand, flesh.fuse(nails), nailMat);
  }

  /* --- las piernas al revés: la rodilla adelante y el resto para atrás --- */

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.13, 1.2, 0]), k.pivot(body, [0.13, 1.2, 0])];
  legs.forEach((leg, i) => {
    piece(leg, flesh.limb(0.7, 0.062, 0.045, { bend: i ? -0.02 : 0.02, rough: 0.1, seed: i }), skinBody);
    const knee = k.pivot(leg, [0, -0.7, 0]);
    knee.rotation.set(1.35 + i * 0.1, 0, i ? -0.75 : 0.8);
    piece(
      knee,
      flesh.fuse([
        // La rótula, salida, que estira la piel hasta ponerla blanca.
        flesh.at(flesh.blob([0.062, 0.075, 0.062], 10, (v) => flesh.swell(v, [0, 0, 0.05], 0.05, 0.016)), [0, 0, 0]),
        flesh.at(flesh.limb(0.76, 0.04, 0.026, { rough: 0.12, seed: 4 + i }), [0, 0, 0]),
      ]),
      skinBody
    );
    const foot = k.pivot(knee, [0, -0.76, 0]);
    foot.rotation.x = -0.75;
    const toes: THREE.BufferGeometry[] = [];
    const nails: THREE.BufferGeometry[] = [];
    for (let t = 0; t < 4; t++) {
      const x = (t - 1.5) * 0.03;
      const geometry = flesh.limb(0.2, 0.011, 0.008, { rough: 0.2, seed: 9 + t, rings: 3, radial: 7 });
      geometry.rotateX(-1.2);
      geometry.rotateZ((t - 1.5) * 0.18);
      geometry.translate(x, 0, 0);
      toes.push(geometry);
      const nail = flesh.limb(0.055, 0.008, 0.001, { rings: 2, radial: 6 });
      nail.rotateX(-1.2);
      nail.rotateZ((t - 1.5) * 0.18);
      nail.translate(x - (t - 1.5) * 0.034, -0.075, 0.19);
      nails.push(nail);
    }
    piece(foot, flesh.fuse(toes), skinBody);
    piece(foot, flesh.fuse(nails), nailMat);
  });

  /* --- el torso, retorcido sobre sí mismo --- */

  const torso = k.pivot(body, [0, 1.2, 0]);
  torso.rotation.set(-0.22, 0.55, 0.14);
  // La cintura, un palo; arriba el pecho se abre y abajo no hay nada.
  piece(
    torso,
    flesh.at(
      flesh.blob([0.16, 0.5, 0.12], 20, (v) => {
        // Se estrangula en la cintura y se abre en el pecho.
        const waist = Math.exp(-((v.y + 0.18) ** 2) / 0.012);
        v.x *= 1 - 0.62 * waist;
        v.z *= 1 - 0.62 * waist;
        // La columna, vértebra por vértebra, marcada contra la espalda.
        for (let i = 0; i < 10; i++) flesh.swell(v, [0, -0.3 + i * 0.075, -0.105 - Math.sin(i / 3) * 0.015], 0.03, 0.034);
        // Las costillas del otro lado, a punto de romper la piel.
        for (let i = 0; i < 6; i++) {
          const y = 0.08 + i * 0.062;
          for (const s of [-1, 1]) flesh.ridge(v, [s * 0.02, y, 0.105], [s * 0.145, y - 0.05, -0.02], 0.015, 0.034);
        }
        flesh.dent(v, [0, 0.12, 0.11], 0.12, 0.035);
        flesh.swell(v, [-0.14, 0.42, 0], 0.09, 0.025);
        flesh.swell(v, [0.12, 0.3, -0.02], 0.08, 0.02);
        flesh.lumps(v, 13, 0.01, 6);
        flesh.lumps(v, 38, 0.003, 14);
      }),
      [0, 0.52, 0]
    ),
    skinBody
  );
  // Los tajos: la piel se abrió sola y abajo está en carne viva.
  const gashes: [number, number, number, number][] = [
    [0.06, 0.4, 0.22, 0.3],
    [-0.09, 0.72, 0.16, -0.5],
    [0.1, 0.86, 0.12, 0.8],
    [-0.02, 0.26, 0.14, 0.15],
  ];
  piece(
    torso,
    flesh.fuse(gashes.map(([x, y, h, tilt]) => flesh.at(flesh.blob([0.016, h / 2, 0.02], 9), [x, y, 0.105], [0, 0, tilt]))),
    raw
  );
  piece(
    torso,
    flesh.drips(
      gashes.map(([x, y, h]) => [x, y - h / 2, 0.12] as flesh.Vec),
      chance
    ),
    wet
  );

  /* --- los brazos: uno al piso, el otro roto al revés --- */

  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.2, 0.92, 0]), k.pivot(torso, [0.18, 0.78, 0.02])];
  // El hombro desencajado, afuera de lugar.
  piece(arms[0], flesh.at(flesh.blob([0.075, 0.065, 0.075], 10, (v) => flesh.lumps(v, 26, 0.012, 1)), [0, 0.02, 0]), skinBody);
  piece(arms[1], flesh.at(flesh.blob([0.06, 0.055, 0.06], 10, (v) => flesh.lumps(v, 26, 0.012, 2)), [0, 0.01, 0]), skinBody);
  piece(arms[0], flesh.limb(0.82, 0.042, 0.03, { bend: -0.02, rough: 0.09, seed: 21 }), skinBody);
  piece(arms[1], flesh.limb(0.62, 0.038, 0.028, { bend: 0.02, rough: 0.09, seed: 22 }), skinBody);
  const elbows = [k.pivot(arms[0], [0, -0.82, 0]), k.pivot(arms[1], [0, -0.62, 0])];
  elbows.forEach((elbow, i) => {
    piece(
      elbow,
      flesh.fuse([
        flesh.at(flesh.blob([0.04, 0.045, 0.04], 9, (v) => flesh.lumps(v, 28, 0.01, i)), [0, 0, 0]),
        flesh.at(flesh.limb(i ? 0.6 : 0.86, 0.03, 0.022, { rough: 0.1, seed: 25 + i }), [0, 0, 0]),
      ]),
      skinBody
    );
  });
  const brokenElbow = elbows[1];
  // Donde el codo se dobló para el lado que no va, el hueso asoma.
  piece(elbows[1], flesh.at(flesh.limb(0.06, 0.016, 0.008, { rings: 3, radial: 7 }), [0.02, 0.02, -0.03], [0, 0, 0.6]), bone);
  piece(elbows[1], flesh.at(flesh.blob([0.03, 0.025, 0.025], 9), [0.015, -0.01, -0.02]), raw);
  claw(k.pivot(elbows[0], [0, -0.86, 0]), 0.045, 0.34, -0.2, 40);
  claw(k.pivot(elbows[1], [0, -0.6, 0]), 0.038, 0.24, -0.3, 60);

  /* --- el cuello largo, doblado casi en ángulo recto --- */

  const neck = k.pivot(torso, [-0.03, 0.95, 0.02]);
  neck.rotation.set(0.25, 0, 1.25);
  piece(
    neck,
    flesh.fuse([
      flesh.at(
        flesh.sculpt(flesh.limb(0.46, 0.05, 0.042, { rough: 0.07, seed: 31, rings: 12 }), (v) => {
          // Cada vértebra hace su bulto: el cuello se lee como una cadena.
          const knuckle = 1 + Math.sin((v.y + 0.46) * 62) * 0.09;
          v.x *= knuckle;
          v.z *= knuckle;
        }),
        [0, 0.46, 0]
      ),
    ]),
    skinBody
  );

  /* --- la cabeza: la cara estirada hacia abajo --- */

  const head = k.pivot(neck, [0, 0.46, 0]);
  head.rotation.z = 0.55;
  const face = k.pivot(head, [0, 0, 0]);
  piece(
    face,
    flesh.at(
      flesh.blob([0.125, 0.205, 0.125], 22, (v) => {
        // Como si se le hubiera derretido para abajo: el cráneo chico y la cara larga.
        const low = Math.max(0, (-v.y - 0.02) / 0.19);
        v.x *= 1 - 0.18 * low;
        v.z *= 1 - 0.14 * low;
        v.y -= low * 0.03;
        // Una cuenca enorme de un lado y una chiquita y más abajo del otro.
        flesh.dent(v, [-0.05, 0.06, 0.095], 0.075, 0.07);
        flesh.dent(v, [0.062, -0.02, 0.105], 0.04, 0.045);
        flesh.swell(v, [-0.05, 0.12, 0.085], 0.06, 0.016);
        // El tajo vertical que le parte la cara: los bordes se levantan.
        flesh.ridge(v, [-0.02, 0.06, 0.115], [0.01, -0.16, 0.1], 0.03, 0.018);
        flesh.dent(v, [0.005, -0.05, 0.12], 0.028, 0.03);
        // Los pómulos y las sienes hundidas.
        for (const s of [-1, 1]) {
          flesh.dent(v, [s * 0.105, 0.09, 0.02], 0.065, 0.02);
          flesh.dent(v, [s * 0.085, -0.075, 0.06], 0.055, 0.025);
        }
        flesh.lumps(v, 14, 0.008, 11);
        flesh.lumps(v, 40, 0.0025, 4);
      }),
      [0, 0.08, 0]
    ),
    skin
  );
  piece(
    face,
    flesh.fuse([
      flesh.at(flesh.blob([0.058, 0.066, 0.03], 10), [-0.048, 0.14, 0.088]),
      flesh.at(flesh.blob([0.028, 0.03, 0.022], 9), [0.06, 0.06, 0.098]),
    ]),
    dark
  );
  const glows = [
    k.ball(face, "#f3efe2", [0.012, 0.012, 0.01], [-0.042, 0.13, 0.115], true),
    k.ball(face, "#f3efe2", [0.008, 0.008, 0.008], [0.06, 0.06, 0.12], true),
  ];
  // La boca: un tajo vertical con dientes de los dos lados, de la nariz al mentón.
  const glowBase = glows.map((glow) => glow.scale.clone());
  const mouth = piece(face, flesh.at(flesh.blob([0.018, 0.1, 0.022], 12), [0.005, -0.02, 0.105], [0, 0, 0.12]), dark);
  const fangs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const y = -0.105 + i * 0.028;
    for (const side of [-1, 1]) {
      const tooth = flesh.limb(0.03 + chance() * 0.012, 0.007, 0.001, { rings: 2, radial: 5 });
      tooth.rotateZ((side * Math.PI) / 2);
      tooth.translate(0.005 + side * 0.016, y, 0.112 - Math.abs(y) * 0.12);
      fangs.push(tooth);
    }
  }
  piece(face, flesh.fuse(fangs), bone);
  piece(face, flesh.at(flesh.blob([0.03, 0.09, 0.012], 10), [0.012, -0.02, 0.1], [0, 0, 0.12]), raw);
  // Lo que le baja del tajo y de la cuenca grande.
  piece(
    face,
    flesh.fuse([
      flesh.thread(
        [
          [0.01, -0.1, 0.105],
          [0.016, -0.16, 0.09],
          [0.008, -0.22, 0.06],
        ],
        0.005,
        8
      ),
      flesh.thread(
        [
          [-0.048, 0.1, 0.1],
          [-0.055, 0.04, 0.095],
          [-0.045, -0.04, 0.08],
        ],
        0.004,
        8
      ),
    ]),
    wet
  );
  // La mandíbula, suelta, colgando de un costado.
  const jaw = k.pivot(face, [0.07, -0.14, 0.04]);
  jaw.rotation.z = -0.5;
  piece(
    jaw,
    flesh.at(
      flesh.blob([0.055, 0.03, 0.05], 10, (v) => {
        if (v.y > 0) v.y *= 0.4;
        flesh.lumps(v, 26, 0.008, 3);
      }),
      [0, -0.03, 0]
    ),
    skinBody
  );
  // Cuatro mechones largos, ralos, pegados al cráneo.
  const hair: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const angle = -1.8 + (i / 13) * 3.6;
    const long = 0.3 + chance() * 0.25;
    const x = Math.sin(angle) * 0.11;
    const z = Math.cos(angle) * 0.1 - 0.02;
    hair.push(
      flesh.thread(
        [
          [x * 0.5, 0.25, z * 0.5],
          [x, 0.2, z],
          [x * 1.05, 0.2 - long * 0.5, z * 1.02],
          [x * 0.9 + (chance() - 0.5) * 0.04, 0.2 - long, z * 0.9],
        ],
        0.003 + chance() * 0.0025,
        8
      )
    );
  }
  piece(face, flesh.fuse(hair), mane);

  // Más alto que cualquier persona: toca casi el dintel de la puerta de calle.
  root.scale.setScalar(1.2);
  scene.add(root);
  const rig: Rig = { root, body, head, arms, legs, torso };
  const still = (r: Rig) => {
    // Las piernas abiertas hacia afuera y vueltas a juntar en la rodilla: de frente, un rombo.
    r.legs![0].rotation.set(-0.6, 0, -0.36);
    r.legs![1].rotation.set(-0.72, 0, 0.32);
    r.arms[0].rotation.set(0.05, 0, -0.18);
    // El otro, abierto hacia afuera y doblado al revés en el codo, con la mano para arriba.
    r.arms[1].rotation.set(0.15, 0, 0.55);
    brokenElbow.rotation.set(0.3, 0, -2.35);
  };
  return figure(
    rig,
    2.1,
    0.9,
    { emerge: still, wait: still, stand: still, peek: still, sit: still, reach: still },
    (_r, on) => {
      mouth.scale.set(on ? 3 : 1, on ? 1.3 : 1, 1);
      jaw.rotation.z = on ? -1.1 : -0.5;
    },
    (on) => {
      glows.forEach((glow, i) => glow.scale.copy(glowBase[i]).multiplyScalar(on ? 1.8 : 1));
    },
    (time) => {
      // No se mueve. Solo, cada tanto, un temblor que no termina de ser un movimiento.
      const shiver = Math.max(0, Math.sin(time * 0.37) - 0.95) * 20;
      face.rotation.x = shiver * 0.04 * Math.sin(time * 41);
      face.position.z = shiver * 0.004 * Math.sin(time * 33);
    }
  );
}
