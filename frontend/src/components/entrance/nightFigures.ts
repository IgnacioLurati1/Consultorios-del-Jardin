import * as THREE from "three";

/**
 * Las cuatro cosas de la noche de terror. Cada una con su silueta, para reconocerla de un
 * vistazo por la cámara aunque se vea chica y verde:
 * - El Doctor (naranja): altísimo y flaco, guardapolvo manchado, barbijo, cuello torcido y
 *   brazos que le llegan a las rodillas.
 * - La Muñeca (turquesa): chica, de porcelana rajada, cabezona, con vestido y moño.
 * - La Mujer (verde): vestido largo y pelo negro hasta la cintura que le tapa la cara; se le
 *   ve un solo ojo.
 * - El Hombre árbol (jardín): corteza, ramas por brazos, una bolsa cosida por cabeza y astas.
 *
 * No caminan: se paran en un lugar con una pose y, de un estado al otro, aparecen en otro.
 * Los brazos y la cabeza van en pivotes para que cada pose se lea distinta.
 */

export type Pose = "emerge" | "wait" | "stand" | "peek" | "sit" | "reach";

export interface Figure {
  group: THREE.Group;
  /** A qué altura está el centro de la cara, sin la escala: para encuadrar el susto. */
  headY: number;
  /** Hasta dónde llegan las manos con los brazos al frente: a esa distancia se para de una puerta. */
  reach: number;
  place(x: number, y: number, z: number, yaw: number): void;
  /** Gira para mirar hacia ese punto del piso. */
  face(x: number, z: number): void;
  pose(pose: Pose): void;
  scream(on: boolean): void;
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

type Kit = ReturnType<typeof kit>;

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
  poses: Record<Pose, (rig: Rig) => void>,
  scream: (rig: Rig, on: boolean) => void
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
      poses[name](rig);
    },
    scream(on) {
      scream(rig, on);
    },
    hide() {
      root.position.set(0, HIDDEN_Y, 0);
      root.rotation.set(0, 0, 0);
    },
  };
}

/** Un brazo largo con codo y dedos: cuelga del hombro, a lo largo de -y. */
function arm(
  k: Kit,
  shoulder: THREE.Group,
  color: string,
  skin: string,
  upper: number,
  lower: number,
  radius: number,
  fingers: number,
  fingerLength: number,
  handColor = skin
) {
  k.cyl(shoulder, color, radius, upper, [0, -upper / 2, 0]);
  const elbow = k.pivot(shoulder, [0, -upper, 0]);
  elbow.rotation.x = -0.15;
  k.ball(elbow, color, [radius * 1.15, radius * 1.15, radius * 1.15], [0, 0, 0]);
  k.cyl(elbow, skin, radius * 0.75, lower, [0, -lower / 2, 0]);
  const hand = k.pivot(elbow, [0, -lower, 0]);
  k.box(hand, handColor, [radius * 1.6, 0.08, radius * 1.2], [0, -0.03, 0]);
  // Dedos largos, con un nudillo y la punta curvada como garra.
  for (let i = 0; i < fingers; i++) {
    const spread = (i - (fingers - 1) / 2) * 0.022;
    const finger = k.pivot(hand, [spread, -0.07, 0.005]);
    finger.rotation.z = spread * 3;
    k.cyl(finger, handColor, 0.008, fingerLength * 0.6, [0, -fingerLength * 0.3, 0]);
    const tip = k.pivot(finger, [0, -fingerLength * 0.6, 0]);
    tip.rotation.x = 0.5;
    k.cyl(tip, handColor, 0.006, fingerLength * 0.45, [0, -fingerLength * 0.22, 0]);
  }
  return hand;
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
  const coat = "#aaa393";
  const skin = "#8d897f";
  const blood = "#4a0b08";
  const pants = "#16161a";

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.1, 0.95, 0]), k.pivot(body, [0.1, 0.95, 0])];
  for (const leg of legs) {
    k.cyl(leg, pants, 0.055, 0.95, [0, -0.475, 0]);
    k.box(leg, "#0a0a0a", [0.1, 0.06, 0.24], [0, -0.93, 0.05]);
  }
  const torso = k.pivot(body, [0, 0.95, 0]);
  // Encorvado, con los hombros para adelante.
  torso.rotation.x = 0.22;
  // El guardapolvo: el faldón abierto y el torso, con manchas oscuras.
  k.cone(torso, coat, 0.27, 0.75, [0, -0.2, 0]);
  k.box(torso, coat, [0.42, 0.72, 0.22], [0, 0.5, 0]);
  k.box(torso, "#8f897b", [0.03, 1.2, 0.01], [0, 0.2, 0.115]);
  for (const [x, y, w, h] of [
    [0.1, 0.55, 0.09, 0.14],
    [-0.12, 0.25, 0.07, 0.2],
    [0.05, -0.1, 0.12, 0.08],
    [-0.05, 0.75, 0.05, 0.05],
  ]) {
    k.box(torso, "#3b0c09", [w, h, 0.01], [x, y, 0.118]);
  }
  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.25, 0.82, 0]), k.pivot(torso, [0.25, 0.82, 0])];
  const hands = arms.map((shoulder) => arm(k, shoulder, coat, skin, 0.6, 0.6, 0.045, 4, 0.2, "#5a1d16"));
  // Un bisturí en la mano derecha.
  k.box(hands[1], "#c9ced3", [0.01, 0.16, 0.03], [0, -0.2, 0.03]);
  k.box(hands[1], "#2a2a2a", [0.018, 0.09, 0.02], [0, -0.1, 0.03]);
  // Salpicaduras en las mangas.
  for (const shoulder of arms) k.box(shoulder, blood, [0.07, 0.12, 0.01], [0, -0.45, 0.046]);
  // El cuello largo, torcido hacia un lado.
  const neck = k.pivot(torso, [0, 0.86, 0]);
  neck.rotation.z = 0.28;
  k.cyl(neck, skin, 0.04, 0.3, [0, 0.15, 0]);
  const head = k.pivot(neck, [0, 0.32, 0]);
  k.ball(head, skin, [0.135, 0.175, 0.145], [0, 0.1, 0]);
  // El gorro de cirujano.
  k.ball(head, "#5e7b80", [0.145, 0.1, 0.155], [0, 0.2, -0.01]);
  // Cuencas hondas con un punto de luz, y lágrimas de sangre.
  for (const side of [-1, 1]) {
    k.ball(head, "#030303", [0.05, 0.058, 0.035], [side * 0.055, 0.14, 0.11]);
    k.ball(head, "#ff9a3c", [0.009, 0.009, 0.009], [side * 0.055, 0.135, 0.142], true);
    k.box(head, blood, [0.012, 0.11, 0.008], [side * 0.058, 0.07, 0.128]);
  }
  const mouth = k.ball(head, "#050505", [0.035, 0.008, 0.03], [0, 0.02, 0.1]);
  const mask = k.box(head, "#8aa4ad", [0.19, 0.1, 0.05], [0, 0.03, 0.105]);
  k.box(head, "#6d8790", [0.26, 0.012, 0.012], [0, 0.07, 0.07]);

  scene.add(root);
  const rig: Rig = { root, body, head, arms, legs, torso };
  return figure(
    rig,
    2.1,
    1.45,
    {
      emerge(r) {
        r.body.position.y = -1.25;
        armPoses.up(r);
        r.head.rotation.x = -0.5;
      },
      wait(r) {
        armPoses.onDoor(r);
        r.head.rotation.set(0.25, 0, 0.35);
      },
      stand(r) {
        armPoses.hang(r, 0.12);
        r.head.rotation.set(0.15, 0, -0.2);
      },
      reach(r) {
        armPoses.reach(r);
        r.head.rotation.set(0, 0, -0.3);
      },
      peek(r) {
        armPoses.hang(r);
      },
      sit(r) {
        armPoses.hang(r);
      },
    },
    (r, on) => {
      mask.visible = !on;
      mouth.scale.set(0.05, on ? 0.09 : 0.008, 0.03);
      if (on) armPoses.reach(r);
    }
  );
}

/* ---------------- la Muñeca ---------------- */

export function makeDoll(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);
  const porcelain = "#ddd6c8";
  const dress = "#0e3a3f";

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.07, 0.5, 0]), k.pivot(body, [0.07, 0.5, 0])];
  for (const leg of legs) {
    k.cyl(leg, porcelain, 0.035, 0.46, [0, -0.23, 0]);
    k.ball(leg, porcelain, [0.042, 0.042, 0.042], [0, -0.24, 0]);
    k.box(leg, "#0b0b0b", [0.08, 0.06, 0.14], [0, -0.47, 0.03]);
  }
  const torso = k.pivot(body, [0, 0.5, 0]);
  k.cone(torso, dress, 0.25, 0.42, [0, 0.12, 0]);
  // El vestido roto y manchado.
  for (const [x, z, w] of [
    [0.12, 0.18, 0.08],
    [-0.15, 0.12, 0.06],
    [0.02, 0.23, 0.05],
  ]) {
    k.box(torso, "#061b1d", [w, 0.12, 0.01], [x, -0.03, z]);
  }
  k.cyl(torso, dress, 0.11, 0.26, [0, 0.42, 0]);
  k.cyl(torso, "#e9e4da", 0.14, 0.03, [0, 0.55, 0]);
  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.13, 0.52, 0]), k.pivot(torso, [0.13, 0.52, 0])];
  for (const shoulder of arms) {
    k.ball(shoulder, porcelain, [0.035, 0.035, 0.035], [0, 0, 0]);
    k.cyl(shoulder, porcelain, 0.028, 0.3, [0, -0.16, 0]);
    k.ball(shoulder, porcelain, [0.035, 0.035, 0.035], [0, -0.32, 0]);
  }
  const head = k.pivot(torso, [0, 0.6, 0]);
  // Cabezona, de porcelana, con rajaduras, mejillas pintadas y ojos de botón.
  k.ball(head, porcelain, [0.17, 0.18, 0.16], [0, 0.16, 0]);
  k.ball(head, "#1d130d", [0.18, 0.15, 0.17], [0, 0.22, -0.035]);
  k.box(head, "#1d130d", [0.3, 0.05, 0.1], [0, 0.3, 0.08]);
  // Un ojo de botón que brilla y, del otro lado, el agujero de uno que se cayó.
  k.ball(head, "#030303", [0.04, 0.04, 0.02], [0.06, 0.17, 0.14]);
  k.ball(head, "#6ff2ff", [0.008, 0.008, 0.008], [0.06, 0.17, 0.162], true);
  k.ball(head, "#000000", [0.05, 0.055, 0.04], [-0.062, 0.175, 0.125]);
  for (const side of [-1, 1]) k.ball(head, "#8a2f2f", [0.025, 0.015, 0.01], [side * 0.09, 0.1, 0.14]);
  // Rajaduras: una grande que baja del agujero del ojo, y otras más chicas.
  for (const [x, y, len, tilt] of [
    [-0.075, 0.1, 0.12, 0.25],
    [-0.04, 0.26, 0.1, -0.5],
    [0.03, 0.22, 0.12, 0.5],
    [0.07, 0.1, 0.08, -0.7],
    [-0.1, 0.03, 0.06, 1.1],
  ]) {
    k.box(head, "#141414", [0.007, len, 0.006], [x, y, 0.158]).rotation.z = tilt;
  }
  // Una sonrisa demasiado ancha, con dientitos.
  const mouth = k.ball(head, "#050505", [0.075, 0.018, 0.02], [0, 0.065, 0.142]);
  for (let i = 0; i < 7; i++) k.box(head, "#e8e1cf", [0.012, 0.014, 0.006], [-0.054 + i * 0.018, 0.074, 0.158]);
  // El pelo desgreñado.
  for (let i = 0; i < 12; i++) {
    const angle = -1.4 + (i / 11) * 2.8;
    const strand = k.box(head, "#1d130d", [0.02, 0.2 + (i % 3) * 0.05, 0.01], [Math.sin(angle) * 0.17, 0.12, Math.cos(angle) * 0.1 - 0.06]);
    strand.rotation.set(0.1, angle, Math.sin(angle) * 0.3);
  }
  // El moño.
  k.box(head, "#0e3a3f", [0.12, 0.05, 0.04], [0.09, 0.33, 0.02]).rotation.z = 0.4;

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
      mouth.scale.set(0.075, on ? 0.07 : 0.018, 0.02);
      if (on) {
        armPoses.reach(r);
        r.head.rotation.set(0, 0, 0);
      }
    }
  );
}

/* ---------------- la Mujer ---------------- */

export function makeWoman(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);
  const dress = "#7e7c73";
  const skin = "#9aa3a5";
  const hair = "#040404";

  const torso = k.pivot(body, [0, 0, 0]);
  k.cone(torso, dress, 0.33, 1.4, [0, 0.7, 0]);
  // El ruedo deshilachado y manchas de barro.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    k.cone(torso, dress, 0.035, 0.18, [Math.sin(angle) * 0.31, 0.02, Math.cos(angle) * 0.31]).rotation.x = Math.PI;
  }
  for (const [x, y] of [
    [0.1, 0.4],
    [-0.14, 0.25],
    [0.02, 0.8],
  ]) {
    k.box(torso, "#2c261d", [0.09, 0.14, 0.01], [x, y, 0.2 - y * 0.08]);
  }
  k.cyl(torso, dress, 0.13, 0.35, [0, 1.35, 0]);
  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.17, 1.47, 0]), k.pivot(torso, [0.17, 1.47, 0])];
  for (const shoulder of arms) arm(k, shoulder, skin, skin, 0.5, 0.5, 0.028, 5, 0.18);
  k.cyl(torso, skin, 0.035, 0.12, [0, 1.56, 0]);
  const head = k.pivot(torso, [0, 1.62, 0]);
  k.ball(head, skin, [0.11, 0.14, 0.12], [0, 0.05, 0]);
  const mouth = k.ball(head, "#050505", [0.03, 0.006, 0.02], [0, -0.03, 0.105]);
  // Un solo ojo a la vista, entre dos mechones.
  k.ball(head, "#050505", [0.03, 0.03, 0.02], [0.045, 0.07, 0.1]);
  k.ball(head, "#c8ff6a", [0.008, 0.008, 0.008], [0.045, 0.07, 0.12], true);
  // El pelo: mechones largos que caen de la coronilla y tapan la cara, menos ese ojo.
  k.ball(head, hair, [0.125, 0.1, 0.13], [0, 0.12, -0.01]);
  const strands: THREE.Mesh[] = [];
  // La cara que hay abajo: se ve recién cuando grita y se le abre el pelo.
  for (const side of [-1, 1]) k.ball(head, "#020202", [0.028, 0.035, 0.02], [side * 0.045, 0.07, 0.1]);
  for (let i = 0; i < 44; i++) {
    const angle = (i / 44) * Math.PI * 2;
    const x = Math.sin(angle) * 0.115;
    const z = Math.cos(angle) * 0.12;
    if (x > 0.02 && x < 0.075 && z > 0.05) continue;
    const length = 0.6 + ((i * 7) % 5) * 0.1 + (z > 0 ? 0.15 : 0.35);
    const strand = k.box(head, hair, [0.035, length, 0.012], [x, 0.14 - length / 2, z]);
    strand.rotation.y = angle;
    strands.push(strand);
  }

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
      mouth.scale.set(0.045, on ? 0.08 : 0.006, 0.02);
      // Al gritar, el pelo se abre y deja ver la cara.
      for (const strand of strands) strand.scale.x = on ? 0.012 : 0.035;
      if (on) armPoses.reach(r);
    }
  );
}

/* ---------------- el Hombre árbol ---------------- */

export function makeTreeMan(scene: THREE.Scene, keep: Keep): Figure {
  const k = kit(keep);
  const root = new THREE.Group();
  const body = k.pivot(root, [0, 0, 0]);
  const bark = "#4a3828";
  const barkLight = "#634b33";
  const moss = "#27331a";
  const sack = "#86734f";

  const legs: [THREE.Group, THREE.Group] = [k.pivot(body, [-0.13, 1.0, 0]), k.pivot(body, [0.13, 1.0, 0])];
  for (const [i, leg] of legs.entries()) {
    k.cyl(leg, bark, 0.075, 1.0, [0, -0.5, 0]).rotation.z = i ? -0.06 : 0.06;
    // Raíces en vez de pies, que se meten en la tierra.
    for (let r = 0; r < 4; r++) {
      const angle = (r / 4) * Math.PI * 2 + i;
      const rootling = k.cyl(leg, bark, 0.02, 0.35, [Math.sin(angle) * 0.1, -0.95, Math.cos(angle) * 0.1]);
      rootling.rotation.set(Math.cos(angle) * 1.1, 0, -Math.sin(angle) * 1.1);
    }
  }
  const torso = k.pivot(body, [0, 1.0, 0]);
  torso.rotation.x = 0.28;
  // El tronco: varios palos retorcidos juntos, con musgo.
  for (const [x, tilt, r] of [
    [-0.09, 0.12, 0.09],
    [0.08, -0.1, 0.1],
    [0, 0.03, 0.12],
  ]) {
    k.cyl(torso, x ? barkLight : bark, r, 0.95, [x, 0.45, 0]).rotation.z = tilt;
  }
  k.box(torso, moss, [0.2, 0.18, 0.06], [0.06, 0.3, 0.11]);
  const arms: [THREE.Group, THREE.Group] = [k.pivot(torso, [-0.24, 0.85, 0]), k.pivot(torso, [0.24, 0.85, 0])];
  for (const shoulder of arms) {
    arm(k, shoulder, bark, barkLight, 0.66, 0.66, 0.05, 5, 0.28);
    // Musgo que cuelga de las ramas.
    for (let m = 0; m < 3; m++) k.box(shoulder, moss, [0.03, 0.25 + m * 0.08, 0.01], [(m - 1) * 0.04, -0.35 - m * 0.1, 0.05]);
  }
  const neck = k.pivot(torso, [0, 0.95, 0.04]);
  k.cyl(neck, "#5e4d33", 0.06, 0.07, [0, 0.03, 0]);
  const head = k.pivot(neck, [0, 0.08, 0]);
  // La bolsa cosida por cabeza: dos ojos hundidos con luz roja y una costura por boca.
  k.ball(head, sack, [0.17, 0.2, 0.16], [0, 0.17, 0]);
  // Un ojo hundido con luz roja; el otro, cosido en cruz.
  k.ball(head, "#050505", [0.05, 0.045, 0.03], [0.06, 0.22, 0.135]);
  k.ball(head, "#ff2a1f", [0.013, 0.013, 0.013], [0.06, 0.22, 0.165], true);
  for (const tilt of [0.8, -0.8]) k.box(head, "#1b140d", [0.008, 0.08, 0.008], [-0.06, 0.22, 0.158]).rotation.z = tilt;
  // La boca: la bolsa rota de lado a lado, con astillas por dientes.
  const mouth = k.ball(head, "#030303", [0.085, 0.035, 0.03], [0, 0.1, 0.14]);
  for (let i = 0; i < 7; i++) {
    const x = -0.066 + i * 0.022;
    k.cone(head, "#c9b48a", 0.008, 0.045, [x, 0.125, 0.162]).rotation.x = Math.PI;
    k.cone(head, "#c9b48a", 0.007, 0.035, [x + 0.011, 0.075, 0.162]);
  }
  // El ojo tira luz roja alrededor: en el jardín oscuro, o en el hall sin luz, se ve venir.
  const eyeLight = new THREE.PointLight("#ff2a1f", 0.5, 2.8, 2);
  eyeLight.position.set(0.06, 0.22, 0.6);
  head.add(eyeLight);
  // Un manto de musgo y jirones que le cuelga de los hombros.
  for (let i = 0; i < 14; i++) {
    const angle = -1.3 + (i / 13) * 2.6;
    const strip = k.box(torso, i % 3 ? moss : "#2a1f15", [0.05, 0.45 + (i % 4) * 0.12, 0.012], [Math.sin(angle) * 0.2, 0.62, Math.cos(angle) * 0.12 - 0.02]);
    strip.rotation.set(0.15, angle, 0);
  }
  // Las astas: ramas secas que le salen de la cabeza.
  for (const side of [-1, 1]) {
    const antler = k.pivot(head, [side * 0.1, 0.32, 0]);
    antler.rotation.z = -side * 0.5;
    k.cyl(antler, bark, 0.018, 0.6, [0, 0.3, 0]);
    for (const [y, lean, length] of [
      [0.14, 0.9, 0.22],
      [0.28, -0.8, 0.26],
      [0.4, 0.7, 0.24],
      [0.52, -0.6, 0.2],
    ]) {
      k.cyl(antler, bark, 0.011, length, [0, y, 0]).rotation.z = lean * side;
    }
  }

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
      mouth.scale.set(0.09, on ? 0.09 : 0.035, 0.03);
      if (on) armPoses.reach(r);
    }
  );
}
