import * as THREE from "three";
import { makeDoctor, makeDoll, makeTreeMan, makeWoman, type Figure } from "./nightFigures";
import { NIGHTS, type NightState } from "./nightLevels";
import { createNightSound, type Place } from "./nightSound";

export { CAMERA_NAMES, NIGHTS, type NightState } from "./nightLevels";

/**
 * La noche de terror: el mismo hall, a oscuras y con tormenta, y cuatro cosas que salen de
 * los consultorios y del jardín entre las 12 y las 6. Se sobrevive hasta las 6.
 *
 * Tardan en aparecer, pero una vez que aparecen avanzan rápido y se pueden juntar.
 * - El Doctor (naranja): asoma del piso de su consultorio, después espera pegado a la
 *   puerta y al final la abre de par en par y se queda mirando. Hay cinco segundos para ir
 *   a cerrarla; si no, ataca.
 * - La Muñeca (turquesa): aparece una vez y se queda. Tiene treinta segundos que se van
 *   gastando; cada segundo que se la mira por la cámara suma dos. Mientras más se gasta, más
 *   cerca de la cámara está. Si llega a cero, ataca. Su cajita de música avisa cómo viene.
 * - La Mujer (verde): asoma del piso, espera en la puerta y al final sale y se para detrás
 *   del boquete, mirando. Hay diez segundos para tocar las tres plantas del alféizar; si no,
 *   o si uno se le acerca, ataca.
 * - El Hombre árbol (jardín): sale de la tierra, se apoya contra el vidrio y al final abre
 *   la corrediza a medias y asoma la cabeza. Hay diez segundos para tocársela, que cierra la
 *   puerta de un golpe. Si no, entra y se corta la luz: oscuridad total y sin cámaras hasta
 *   subir la palanca del tablero, y la luz vuelve cinco segundos después.
 *
 * Hay cinco noches, iguales salvo por la dificultad (ver NIGHTS): qué tan seguido aparecen,
 * cuánto tiempo dan una vez que salen y cuántos cortes de luz sueltos hay.
 *
 * Las cámaras se miran desde la computadora de la recepción: con la E sobre el monitor, de
 * frente, uno se sienta y se prenden. Las puertas y la corrediza no se pueden abrir, solo
 * cerrar.
 */


/** Lo que el juego necesita del hall. Las medidas son las de la escena, en metros. */
export interface NightContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  layout: {
    left: number;
    hallLeft: number;
    right: number;
    openingZ: number;
    backZ: number;
    gardenBackZ: number;
    hallH: number;
    corridorH: number;
    doorTop: number;
    glassLeft: number;
    nicheZ: number;
    roomBackX: number;
  };
  /** Las tres puertas de los consultorios, de la entrada al fondo: naranja, turquesa y verde. */
  doors: { hinge: THREE.Group; open: number; target: number; closeAt: number }[];
  doorZ: number[];
  garden: { open: number; target: number };
  slider: THREE.Object3D;
  fixedPane: THREE.Object3D;
  nichePlants: THREE.Object3D[];
  chair: THREE.Object3D;
  monitor: THREE.Object3D;
  lever: THREE.Object3D;
  breaker: THREE.Object3D;
  walker: { position: THREE.Vector3; yaw: number; pitch: number };
  seat: { active: boolean; standAt: THREE.Vector3 };
  /** Los spots del techo: se apagan con el corte de luz. */
  glow: THREE.MeshBasicMaterial;
  /** Las luces que parpadean, las del pasillo y el hall. */
  flicker: THREE.PointLight[];
  /** La luna, el cielo y el relleno: con el corte casi desaparecen, para que sea oscuro de verdad. */
  ambient: THREE.Light[];
  sky: { top: THREE.Color; horizon: THREE.Color };
  setView(camera: THREE.Camera | null): void;
  releasePointer(): void;
  relock(): void;
  onState(state: NightState): void;
}

export interface Night {
  update(dt: number): void;
  /** Una tecla. Devuelve true si la usó el juego (o si en ese momento no se puede hacer nada). */
  key(code: string): boolean;
  /** Si quien juega no se puede mover ni mirar: con las cámaras abiertas, o terminada la noche. */
  frozen(): boolean;
  command(name: "cam" | "close", value?: number): void;
  dispose(): void;
}

/* ---------------- lo que es igual en todas las noches ---------------- */

/** Lo que dura cada hora, en segundos. La noche entera son seis. */
const HOUR_S = 60;
/** Cada cuánto prueba aparecer cada una, y la chance por hora en la primera noche: tardan. */
const APPEAR_TICK_S = 5;
const APPEAR_CHANCE = [0.04, 0.06, 0.09, 0.12, 0.15, 0.18];
/**
 * Una vez afuera van rápido: los segundos de cada noche en cada estado, con un poco de azar
 * para que no sea un reloj.
 */
const ADVANCE_TICK_S = 1;
const ADVANCE_CHANCE = 0.6;
/**
 * Más cerca que esto de la mujer, ataca. Desde el hall, la pared del boquete no deja
 * llegar tan cerca: se la puede enfrentar para tocar las plantas, no ir a buscarla.
 */
const WOMAN_REACH = 0.9;
/** Con menos que esto, la cajita se oye aunque no se la mire. */
const DOLL_AUDIBLE_S = 10;
/**
 * Cortes de luz sueltos, sin nadie detrás: se prueba cada cinco segundos, con una chance
 * pensada para que se lleguen a dar los de la noche. Se arreglan subiendo la palanca, sin
 * esperar.
 */
const FAULT_TICK_S = 5;
const RESTORE_S = 5;
const INTRO_S = 4;
const SCARE_S = 1.5;

type FoeKey = "doctor" | "doll" | "woman" | "tree";

interface Foe {
  key: FoeKey;
  figure: Figure;
  stage: number;
  since: number;
  nextTick: number;
  deadline: number;
}

export function createNight(ctx: NightContext, nightIndex = 0): Night {
  const { scene, camera, layout, doors, garden, walker, seat } = ctx;
  const level = NIGHTS[Math.max(0, Math.min(NIGHTS.length - 1, nightIndex))];
  const DOCTOR_S = level.doctor;
  const WOMAN_S = level.woman;
  const TREE_S = level.tree;
  const DOLL_S = level.doll;
  const MAX_FAULTS = level.faults;
  const GRACE_S = level.grace;
  const MIN_STAGE_S = level.stage;
  const COOLDOWN_S = level.cooldown;
  const DOLL_WATCH_GAIN = level.dollGain;
  const blood = level.blood;
  // Unas setenta pruebas en la noche: con esta chance, lo esperable es llegar al tope.
  const FAULT_CHANCE = Math.min(0.2, (level.faults * 1.3) / ((6 * HOUR_S - GRACE_S) / FAULT_TICK_S));
  const sound = createNightSound();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  /* ---------------- la luz del edificio, para cortarla ---------------- */

  // Se anota ahora, antes de sumar lo del juego: los ojos brillan con o sin luz, y el
  // relámpago no es del edificio.
  const lamps: { light: THREE.PointLight; base: number; flickUntil: number }[] = [];
  const glowing: { material: THREE.MeshStandardMaterial; base: number }[] = [];
  const glowBase = ctx.glow.color.clone();
  scene.traverse((object) => {
    if (object instanceof THREE.PointLight) lamps.push({ light: object, base: object.intensity, flickUntil: 0 });
    if (object instanceof THREE.Mesh) {
      const material = object.material as THREE.Material;
      if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0 && !glowing.some((g) => g.material === material)) {
        glowing.push({ material, base: material.emissiveIntensity });
      }
    }
  });
  const ambient = ctx.ambient.map((light) => ({ light, base: light.intensity }));
  const environmentBase = scene.environmentIntensity;
  const flickering = new Set(ctx.flicker);

  let power = 1;
  function setPower(level: number) {
    power = level;
    for (const { material, base } of glowing) material.emissiveIntensity = base * level;
    ctx.glow.color.copy(glowBase).multiplyScalar(level);
    // Sin luz queda apenas un resto de la luna: los ojos, los rayos y nada más.
    for (const { light, base } of ambient) light.intensity = base * (0.06 + 0.94 * level);
    scene.environmentIntensity = environmentBase * level;
  }

  /* ---------------- los personajes ---------------- */

  const foes: Foe[] = (
    [
      ["doctor", makeDoctor],
      ["doll", makeDoll],
      ["woman", makeWoman],
      ["tree", makeTreeMan],
    ] as const
  ).map(([key, make], i) => ({
    key,
    figure: make(scene, keep),
    stage: 0,
    since: -COOLDOWN_S,
    nextTick: GRACE_S + i * 1.3,
    deadline: 0,
  }));
  const foe = (key: FoeKey) => foes.find((f) => f.key === key)!;
  if (blood) paintBlood(scene, layout, keep, nightIndex, foes.map((f) => f.figure.group));
  const doctor = foe("doctor");
  const doll = foe("doll");
  const woman = foe("woman");
  const tree = foe("tree");

  /* ---------------- las cámaras ---------------- */

  const { left, hallLeft, backZ, glassLeft, nicheZ, roomBackX } = layout;
  const feeds = ctx.doorZ.map((z) => {
    const feed = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
    feed.position.set(roomBackX + 0.2, 2.7, z + 0.75);
    feed.lookAt(left - 0.1, 0.9, z - 0.15);
    return feed;
  });
  // Desde la esquina de la izquierda: desde la otra, el tronco del árbol tapaba la puerta.
  const gardenFeed = new THREE.PerspectiveCamera(72, 1, 0.05, 80);
  gardenFeed.position.set(left + 0.4, 2.9, layout.gardenBackZ + 0.4);
  gardenFeed.lookAt(0.4, 1.0, backZ - 0.6);
  feeds.push(gardenFeed);
  // Cada cámara tiene su luz infrarroja, que se prende solo mientras se la mira: el
  // consultorio a oscuras se ve por la cámara y no a simple vista.
  const infrared = feeds.map((feed, index) => {
    // La del jardín tiene que llegar hasta la puerta, del otro lado del patio.
    const light = new THREE.PointLight("#cfe0ff", 0, index === 3 ? 16 : 9, index === 3 ? 1 : 1.4);
    light.position.copy(feed.position);
    // La del jardín, a mitad del patio: desde la esquina no llegaba a la puerta.
    if (index === 3) light.position.set(-0.6, 2.6, backZ - 3);
    scene.add(light);
    return light;
  });

  /* ---------------- el sonido, del lado de donde viene ---------------- */

  function placeOf(x: number, z: number): Place {
    const dx = x - walker.position.x;
    const dz = z - walker.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const right = (dx * Math.cos(walker.yaw) - dz * Math.sin(walker.yaw)) / distance;
    return { pan: right * 0.9, near: Math.max(0, 1 - distance / 14) };
  }
  const doorPlace = (index: number) => placeOf(left, ctx.doorZ[index]);
  const gardenPlace = () => placeOf(glassLeft + 0.5, backZ);

  /* ---------------- dónde se para cada una ---------------- */

  /** Asomando del piso, en el medio de su consultorio, mirando a la cámara. */
  function emergeInRoom(f: Foe, index: number) {
    const z = ctx.doorZ[index];
    f.figure.place(left - 0.95, 0, z - 0.45, 0);
    f.figure.face(feeds[index].position.x, feeds[index].position.z);
    f.figure.pose("emerge");
  }

  /**
   * Pegada a su puerta, con las manos apoyadas: de espaldas a la cámara. Se para a lo largo
   * de sus brazos, para que las manos toquen la puerta sin atravesarla.
   */
  function waitAtDoor(f: Foe, index: number) {
    f.figure.place(left - f.figure.reach - 0.05, 0, ctx.doorZ[index], Math.PI / 2);
    f.figure.pose("wait");
  }

  /** La muñeca, cada vez más cerca de la cámara a medida que se le acaba el tiempo. */
  let dollSpot = -1;
  function placeDoll(remaining: number) {
    const spot = remaining > (DOLL_S * 2) / 3 ? 0 : remaining > DOLL_S / 3 ? 1 : 2;
    if (spot === dollSpot) return;
    dollSpot = spot;
    const z = ctx.doorZ[1];
    const feed = feeds[1];
    const { figure } = doll;
    if (spot === 0) {
      figure.place(left - 0.5, 0, z - 0.62, 0);
      figure.pose("sit");
    } else if (spot === 1) {
      figure.place(left - 1.3, 0, z + 0.05, 0);
      figure.pose("stand");
    } else {
      figure.place(roomBackX + 0.85, 0, z + 0.4, 0);
      figure.pose("reach");
    }
    figure.face(feed.position.x, feed.position.z);
  }

  /* ---------------- el estado del juego ---------------- */

  let time = 0;
  let phase: NightState["phase"] = "intro";
  let hour = 0;
  let cams = false;
  let cam = 0;
  let blackoutAt = -1;
  let restoreAt = -1;
  /** El corte de luz fue una falla, no el del jardín: la palanca lo arregla al instante. */
  let fault = false;
  let faults = 0;
  let nextFault = GRACE_S;
  let nextKnock = 0;
  let nextGrowl = 0;
  let dollLeft: number | null = null;
  const plantsTouched = new Set<number>();
  let scareFoe: Foe | null = null;
  let scareUntil = 0;
  let outside = false;
  const lastStep = walker.position.clone();

  // La luz del susto viene de abajo, como una linterna bajo la cara.
  const scareLight = new THREE.PointLight("#ffd9b0", 0, 3, 2);
  scareLight.position.set(0, -0.45, -0.2);
  camera.add(scareLight);
  scene.add(camera);

  function advance(f: Foe) {
    f.stage += 1;
    f.since = time;

    if (f.key === "doll") {
      // Un solo estado: aparece y se queda, con su tiempo corriendo.
      dollLeft = DOLL_S;
      dollSpot = -1;
      placeDoll(dollLeft);
      sound.appear(doorPlace(1));
      return;
    }

    const index = f.key === "doctor" ? 0 : f.key === "woman" ? 2 : -1;
    const place = index >= 0 ? doorPlace(index) : gardenPlace();

    if (f.stage === 1) {
      if (index >= 0) emergeInRoom(f, index);
      else {
        f.figure.place(0, 0, layout.gardenBackZ + 2.3, 0);
        f.figure.face(gardenFeed.position.x, gardenFeed.position.z);
        f.figure.pose("emerge");
      }
      sound.appear(place);
      return;
    }

    if (f.stage === 2) {
      if (index >= 0) waitAtDoor(f, index);
      else {
        // Contra el vidrio del jardín, con las manos apoyadas, mirando adentro.
        f.figure.place(0.5, 0, backZ - 0.2 - f.figure.reach, 0);
        nextKnock = time + 1;
        f.figure.pose("wait");
      }
      sound.whisper(place);
      return;
    }

    sound.screech();
    if (f.key === "doctor") {
      f.deadline = time + DOCTOR_S;
      doors[0].target = 1;
      doors[0].closeAt = Infinity;
      // Del lado del marco donde no está la hoja abierta: más al medio, la atravesaba.
      f.figure.place(left + 0.7, 0, ctx.doorZ[0] + 0.6, 0);
      f.figure.pose("stand");
      sound.creak(place, 1.2);
    } else if (f.key === "woman") {
      f.deadline = time + WOMAN_S;
      plantsTouched.clear();
      doors[2].target = 1;
      doors[2].closeAt = Infinity;
      f.figure.place(hallLeft - 0.75, 0, nicheZ, 0);
      f.figure.pose("stand");
      sound.creak(place, 1.4);
    } else {
      // La cabeza por la corrediza a medio abrir: el cuerpo detrás de la pared, inclinado.
      f.deadline = time + TREE_S;
      garden.target = 0.45;
      f.figure.place(glassLeft - 0.32, 0, backZ - 0.4, 0);
      f.figure.group.rotation.z = -0.3;
      f.figure.pose("peek");
      f.figure.group.userData.onTouch = () => {
        garden.target = 0;
        sound.slam(gardenPlace());
        reset(f);
      };
      f.figure.group.userData.label = "Empujar";
      sound.creak(place, 1.2);
      sound.growl(place);
      nextGrowl = time + 3;
    }
  }

  function reset(f: Foe) {
    f.stage = 0;
    f.since = time;
    delete f.figure.group.userData.onTouch;
    f.figure.hide();
  }

  function tryAdvance(f: Foe) {
    if (time < GRACE_S || f.stage >= 3) return;
    if (f.key === "tree" && blackoutAt >= 0 && !fault) return;
    if (f.key === "doll" && f.stage >= 1) return;
    if (f.stage === 0) {
      if (time - f.since < COOLDOWN_S) return;
      const chance = Math.min(0.6, APPEAR_CHANCE[Math.min(hour, APPEAR_CHANCE.length - 1)] * level.appear);
      if (Math.random() < chance) advance(f);
      return;
    }
    if (time - f.since >= MIN_STAGE_S && Math.random() < ADVANCE_CHANCE) advance(f);
  }

  function openCams() {
    if (cams || blackoutAt >= 0) return;
    cams = true;
    sound.click();
    ctx.releasePointer();
  }

  function closeCams(relock = true) {
    if (!cams) return;
    cams = false;
    ctx.setView(null);
    sound.click();
    if (relock) ctx.relock();
  }

  function selectCam(index: number) {
    const next = (index + feeds.length) % feeds.length;
    if (next === cam) return;
    cam = next;
    sound.crackle();
  }

  function blackout(byFault = false) {
    blackoutAt = time;
    restoreAt = -1;
    fault = byFault;
    setPower(0);
    if (!byFault) {
      // Entró: se queda parado en el hall a oscuras, y solo se le ve el ojo, hasta que vuelve la luz.
      tree.figure.place(0.2, 0, backZ + 1.4, 0);
      tree.figure.pose("stand");
      tree.figure.face(walker.position.x, walker.position.z);
      sound.growl(gardenPlace());
    }
    ctx.lever.rotation.z = -0.6;
    closeCams(false);
    sound.setPower(false);
    sound.slam(gardenPlace());
  }

  function scare(f: Foe) {
    phase = "scare";
    closeCams(false);
    ctx.setView(null);
    ctx.releasePointer();
    scareFoe = f;
    scareUntil = time + SCARE_S;
    const { figure } = f;
    figure.pose("stand");
    figure.scream(true);
    camera.add(figure.group);
    figure.group.rotation.set(0, 0, 0);
    figure.group.position.set(0, -figure.headY, -0.55);
    scareLight.intensity = 1.4;
    sound.scream();
    sound.setHeartbeat(0);
    sound.setMusicBox(null);
  }

  function sit() {
    seat.active = true;
    seat.standAt.set(ctx.chair.position.x, 1.55, ctx.chair.position.z);
    walker.position.set(ctx.chair.position.x, 1.18, ctx.chair.position.z);
    walker.yaw = Math.PI / 2;
    walker.pitch = -0.08;
  }
  sit();

  /* ---------------- lo que se toca ---------------- */

  const plantKicks = ctx.nichePlants.map((plant) => plant.userData.onTouch as () => void);
  ctx.nichePlants.forEach((plant, index) => {
    plant.userData.onTouch = () => {
      plantKicks[index]?.();
      if (woman.stage === 3 && !plantsTouched.has(index)) {
        plantsTouched.add(index);
        sound.click();
      }
    };
  });

  const closeDoor = (index: number) => () => {
    doors[index].target = 0;
    sound.slam(doorPlace(index));
    if (index === 0 && doctor.stage === 3) reset(doctor);
  };
  const closeGarden = () => {
    garden.target = 0;
    sound.slam(gardenPlace());
  };
  const useMonitor = () => {
    if (!seat.active) sit();
    openCams();
  };
  const flipLever = () => {
    restoreAt = time + (fault ? 0 : RESTORE_S);
    ctx.lever.rotation.z = 0.6;
    sound.click();
    sound.creak(placeOf(layout.right, 0.55), 0.5);
  };

  /** Lo que hace cada cosa cambia con la situación: se pone al día en cada cuadro. */
  function refreshTouchables() {
    doors.forEach((door, index) => {
      door.hinge.userData.onTouch = door.target > 0 ? closeDoor(index) : undefined;
      door.hinge.userData.label = "Cerrar";
    });

    const gardenClosable = garden.target > 0 && tree.stage !== 3;
    for (const glass of [ctx.slider, ctx.fixedPane]) {
      glass.userData.onTouch = gardenClosable ? closeGarden : undefined;
      glass.userData.label = "Cerrar";
    }

    // De frente al monitor, del lado de la silla: la E sienta y prende las cámaras.
    const facingMonitor = seat.active || walker.position.x > ctx.chair.position.x - 0.9;
    ctx.monitor.userData.onTouch = facingMonitor && blackoutAt < 0 ? useMonitor : undefined;
    ctx.monitor.userData.label = "Cámaras";

    ctx.breaker.userData.onTouch = blackoutAt >= 0 && restoreAt < 0 ? flipLever : undefined;
    ctx.breaker.userData.label = "Subir la palanca";

    const tending = woman.stage === 3;
    for (const plant of ctx.nichePlants) plant.userData.label = tending ? "Tocar" : "";
  }

  /* ---------------- la tormenta ---------------- */

  const flash = new THREE.DirectionalLight(blood ? "#ff4a3a" : "#c9d6ff", 0);
  flash.position.set(-4, 20, -24);
  scene.add(flash);
  const skyTop = ctx.sky.top.clone();
  const skyHorizon = ctx.sky.horizon.clone();
  const flashSky = new THREE.Color(blood ? "#8a1414" : "#5d6b88");
  const bolts: number[] = [];
  const thunders: { at: number; strength: number }[] = [];
  let nextBolt = 8 + Math.random() * 10;

  function strike() {
    const pulses = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i++) bolts.push(time + i * (0.07 + Math.random() * 0.12));
    const delay = 0.3 + Math.random() * 1.8;
    thunders.push({ at: time + delay, strength: 1 - delay / 2.2 });
    nextBolt = time + 12 + Math.random() * 26;
  }

  // La lluvia: rayitas que caen sobre el jardín y sobre el techo de vidrio, y cortan donde tocan.
  const DROPS = 1400;
  const rainPositions = new Float32Array(DROPS * 6);
  const drops = Array.from({ length: DROPS }, () => ({ x: 0, y: 0, z: 0, floor: 0, speed: 0 }));
  const rainTop = 12;
  function floorAt(x: number, z: number) {
    if (z < backZ) return 0;
    if (x < hallLeft) return layout.corridorH + 0.35;
    return layout.doorTop + ((z - backZ) / (layout.openingZ - backZ)) * (layout.hallH - layout.doorTop) + 0.08;
  }
  function spawn(drop: (typeof drops)[number], anywhere: boolean) {
    drop.x = left + Math.random() * (layout.right + 0.8 - left);
    drop.z = layout.gardenBackZ + Math.random() * (layout.openingZ - layout.gardenBackZ);
    drop.floor = floorAt(drop.x, drop.z);
    drop.y = anywhere ? drop.floor + Math.random() * (rainTop - drop.floor) : rainTop + Math.random() * 2;
    drop.speed = 10 + Math.random() * 4;
  }
  for (const drop of drops) spawn(drop, true);
  const rainGeometry = keep(new THREE.BufferGeometry());
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeometry,
    // En las noches de sangre, llueve sangre.
    keep(new THREE.LineBasicMaterial({ color: blood ? "#8e0f0f" : "#7e8ea8", transparent: true, opacity: blood ? 0.45 : 0.28, depthWrite: false }))
  );
  rain.frustumCulled = false;
  // Nadie toca la lluvia: sin esto, cada rayito entraba en la búsqueda del puntero.
  rain.raycast = () => {};
  scene.add(rain);

  function updateStorm(dt: number) {
    if (time >= nextBolt) strike();
    let level = 0;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const age = time - bolts[i];
      if (age < 0) continue;
      if (age > 0.6) bolts.splice(i, 1);
      else level += Math.exp(-age * 14);
    }
    level = Math.min(1.2, level);
    flash.intensity = level * 3.2;
    ctx.sky.top.copy(skyTop).lerp(flashSky, Math.min(1, level * 0.6));
    ctx.sky.horizon.copy(skyHorizon).lerp(flashSky, Math.min(1, level));
    for (let i = thunders.length - 1; i >= 0; i--) {
      if (time < thunders[i].at) continue;
      sound.thunder(thunders[i].strength);
      thunders.splice(i, 1);
    }

    const drift = 1.2 * dt;
    for (let i = 0; i < DROPS; i++) {
      const drop = drops[i];
      drop.y -= drop.speed * dt;
      drop.x += drift;
      if (drop.y <= drop.floor) spawn(drop, false);
      const o = i * 6;
      rainPositions[o] = drop.x;
      rainPositions[o + 1] = drop.y;
      rainPositions[o + 2] = drop.z;
      rainPositions[o + 3] = drop.x - 0.04;
      rainPositions[o + 4] = drop.y + 0.38;
      rainPositions[o + 5] = drop.z;
    }
    rainGeometry.attributes.position.needsUpdate = true;
  }

  function updateLights(dt: number) {
    // Mientras vuelve la luz, todo titila.
    const restoring = restoreAt >= 0;
    for (const lamp of lamps) {
      let factor = power;
      if (restoring) factor = Math.random() < 0.25 ? 0.6 : 0;
      else if (flickering.has(lamp.light)) {
        if (time > lamp.flickUntil && Math.random() < dt * 0.12) lamp.flickUntil = time + 0.2 + Math.random() * 0.6;
        if (time < lamp.flickUntil) factor *= Math.random() > 0.5 ? 1 : 0.1;
      }
      lamp.light.intensity = lamp.base * factor;
    }
  }

  /* ---------------- el clima: tensión, latido y cajita ---------------- */

  function updateMood() {
    const out = foes.filter((f) => f.stage >= 1).length;
    const striking = foes.some((f) => f.stage === 3) || (dollLeft !== null && dollLeft < 10);
    const waiting = foes.some((f) => f.stage === 2) || (dollLeft !== null && dollLeft < 20);
    // En las noches de sangre la tensión arranca alta y no baja.
    const floor = blood ? 0.45 : 0;
    sound.setTension(Math.min(1, floor + hour / 10 + out * 0.12 + (striking ? 0.3 : 0) + (blackoutAt >= 0 ? 0.2 : 0)));
    sound.setHeartbeat(phase !== "play" ? 0 : striking ? 128 : waiting ? 78 : 0);
    // La cajita se oye solo mirándola por la cámara, o cuando ya casi no le queda.
    const watchingDoll = cams && cam === 1 && blackoutAt < 0;
    const audible = dollLeft !== null && phase === "play" && (watchingDoll || dollLeft < DOLL_AUDIBLE_S);
    sound.setMusicBox(audible ? dollLeft! / DOLL_S : null);
  }

  /* ---------------- el estado para la pantalla ---------------- */

  let last = "";
  function emit() {
    const state: NightState = {
      phase,
      hour,
      cams,
      cam,
      blackout: blackoutAt >= 0,
      restoring: restoreAt >= 0,
      seated: seat.active,
      doll: dollLeft === null ? null : Math.ceil(dollLeft),
      dollMax: DOLL_S,
      night: nightIndex,
    };
    const key = JSON.stringify(state);
    if (key === last) return;
    last = key;
    ctx.onState(state);
  }

  /* ---------------- cada cuadro ---------------- */

  function update(dt: number) {
    time += dt;
    updateStorm(dt);
    updateLights(dt);
    sound.tick(dt);

    const isOutside = walker.position.z < backZ;
    if (isOutside !== outside) {
      outside = isOutside;
      sound.setOutside(outside);
    }
    if (!seat.active && Math.hypot(walker.position.x - lastStep.x, walker.position.z - lastStep.z) > 0.75) {
      lastStep.copy(walker.position);
      sound.step();
    }

    if (phase === "scare" && scareFoe) {
      const { group } = scareFoe.figure;
      group.position.x = (Math.random() - 0.5) * 0.05;
      group.position.y = -scareFoe.figure.headY + (Math.random() - 0.5) * 0.05;
      group.rotation.z = (Math.random() - 0.5) * 0.12;
      if (time >= scareUntil) {
        phase = "dead";
        scene.add(group);
        scareFoe.figure.hide();
        scareLight.intensity = 0;
      }
    }

    if (phase === "intro" && time >= INTRO_S) phase = "play";

    if (phase === "play") {
      const nextHour = Math.min(6, Math.floor(time / HOUR_S));
      if (nextHour !== hour) {
        hour = nextHour;
        sound.toll(hour === 6 ? 3 : 1);
        if (hour === 6) {
          phase = "won";
          for (const f of foes) reset(f);
          dollLeft = null;
          closeCams(false);
          ctx.releasePointer();
          blackoutAt = -1;
          restoreAt = -1;
          setPower(1);
          sound.setPower(true);
        }
      }
    }

    if (phase === "play") {
      for (const f of foes) {
        if (time >= f.nextTick) {
          f.nextTick = time + (f.stage === 0 ? APPEAR_TICK_S : ADVANCE_TICK_S) * (0.8 + Math.random() * 0.4);
          tryAdvance(f);
        }
      }

      if (doctor.stage === 3) {
        doctor.figure.face(walker.position.x, walker.position.z);
        if (time >= doctor.deadline) scare(doctor);
      }
    }

    if (phase === "play" && dollLeft !== null) {
      const watching = cams && cam === 1 && blackoutAt < 0;
      dollLeft = watching ? Math.min(DOLL_S, dollLeft + DOLL_WATCH_GAIN * dt) : dollLeft - dt;
      placeDoll(dollLeft);
      if (dollLeft <= 0) {
        dollLeft = null;
        scare(doll);
      }
    }

    if (phase === "play" && woman.stage === 3) {
      const { group } = woman.figure;
      woman.figure.face(walker.position.x, walker.position.z);
      const close = Math.hypot(walker.position.x - group.position.x, walker.position.z - group.position.z) < WOMAN_REACH;
      if (plantsTouched.size === ctx.nichePlants.length) {
        doors[2].target = 0;
        sound.slam(doorPlace(2));
        reset(woman);
      } else if (close || time >= woman.deadline) {
        scare(woman);
      }
    }

    if (phase === "play" && tree.stage === 3 && time >= tree.deadline) {
      garden.target = 1;
      reset(tree);
      blackout();
    }

    // El del jardín hace ruido: golpea el vidrio mientras espera y gruñe mientras asoma.
    if (phase === "play" && tree.stage === 2 && time >= nextKnock) {
      nextKnock = time + 4 + Math.random() * 5;
      sound.glassKnock(gardenPlace());
    }
    if (phase === "play" && tree.stage === 3 && time >= nextGrowl) {
      nextGrowl = time + 3;
      sound.growl(gardenPlace());
    }
    if (phase === "play" && blackoutAt >= 0 && !fault && tree.stage === 0) {
      tree.figure.face(walker.position.x, walker.position.z);
    }

    // Un corte suelto, cada tanto.
    if (phase === "play" && time >= nextFault) {
      nextFault = time + FAULT_TICK_S;
      if (faults < MAX_FAULTS && blackoutAt < 0 && time > GRACE_S && Math.random() < FAULT_CHANCE) {
        faults += 1;
        blackout(true);
      }
    }

    if (phase === "play" && restoreAt >= 0 && time >= restoreAt) {
      blackoutAt = -1;
      restoreAt = -1;
      if (tree.stage === 0) tree.figure.hide();
      setPower(1);
      sound.setPower(true);
      sound.click();
    }

    updateMood();

    infrared.forEach((light, index) => (light.intensity = cams && index === cam ? (index === 3 ? 4 : 2.2) : 0));
    if (cams) {
      const feed = feeds[cam];
      if (feed.aspect !== camera.aspect) {
        for (const f of feeds) {
          f.aspect = camera.aspect;
          f.updateProjectionMatrix();
        }
      }
      ctx.setView(feed);
    }

    refreshTouchables();
    emit();
  }

  return {
    update,
    key(code) {
      if (phase === "scare" || phase === "dead" || phase === "won") return true;
      if (!cams) return false;
      if (code.startsWith("Digit")) {
        const index = Number(code.slice(5)) - 1;
        if (index >= 0 && index < feeds.length) selectCam(index);
      } else if (code === "KeyA" || code === "ArrowLeft") {
        selectCam(cam - 1);
      } else if (code === "KeyD" || code === "ArrowRight") {
        selectCam(cam + 1);
      } else if (code === "KeyE" || code === "Space" || code === "KeyS" || code === "Escape") {
        closeCams();
      }
      return true;
    },
    frozen() {
      return cams || phase !== "play";
    },
    command(name, value) {
      if (name === "cam" && typeof value === "number") selectCam(value);
      if (name === "close") closeCams();
    },
    dispose() {
      sound.dispose();
      camera.remove(scareLight);
      scene.remove(rain, flash, ...infrared);
      for (const f of foes) f.figure.group.removeFromParent();
      for (const thing of disposables) thing.dispose();
    },
  };
}

/* ---------------- la sangre de las dos últimas noches ---------------- */

/** Un dibujo en un lienzo, como textura. */
function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  draw(ctx, rand);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Un charco o una salpicadura: una mancha grande y gotas alrededor. */
function splatter(ctx: CanvasRenderingContext2D, rand: () => number, size: number) {
  const c = size / 2;
  ctx.fillStyle = "#2a0103";
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = c * (0.45 + rand() * 0.25);
    ctx.lineTo(c + Math.cos(angle) * r, c + Math.sin(angle) * r);
  }
  ctx.fill();
  for (let i = 0; i < 26; i++) {
    const angle = rand() * Math.PI * 2;
    const r = c * (0.6 + rand() * 0.38);
    ctx.beginPath();
    ctx.arc(c + Math.cos(angle) * r, c + Math.sin(angle) * r, 2 + rand() * c * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Llena el hall de sangre: charcos húmedos en el piso, arrastres hacia las puertas de los
 * consultorios, manos en el vidrio del jardín, gotas que caen de la viga del pasillo y una
 * frase escrita en la pared. Y a los cuatro los tiñe y les pone los ojos rojos.
 */
function paintBlood(
  scene: THREE.Scene,
  layout: NightContext["layout"],
  keep: <T extends { dispose(): void }>(thing: T) => T,
  nightIndex: number,
  figures: THREE.Object3D[]
) {
  const wet = (map: THREE.Texture | null) =>
    keep(
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        roughness: 0.2,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
  const plane = keep(new THREE.PlaneGeometry(1, 1));
  function decal(material: THREE.Material, size: [number, number], at: [number, number, number], rotation: [number, number, number]) {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(size[0], size[1], 1);
    mesh.position.set(...at);
    mesh.rotation.set(...rotation);
    mesh.raycast = () => {};
    scene.add(mesh);
  }
  const flat: [number, number, number] = [-Math.PI / 2, 0, 0];

  const pool = paint(256, 256, (ctx, rand) => splatter(ctx, rand, 256));
  if (pool) keep(pool);
  const pools = wet(pool);
  for (const [x, z, size] of [
    [0.6, -1.2, 1.6],
    [-0.4, -5.8, 1.2],
    [2.2, -6.9, 0.9],
    [-2.5, 0.9, 1.1],
    [-2.4, -4.8, 1.3],
    [1.1, 0.8, 0.8],
  ]) {
    decal(pools, [size, size], [x, 0.006, z], [flat[0], 0, x * 3]);
  }

  // Arrastres: algo que se llevaron hacia los consultorios.
  const smear = paint(512, 128, (ctx, rand) => {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(42, 1, 3, ${0.45 + rand() * 0.4})`;
      ctx.fillRect(0, 30 + rand() * 50, 512, 6 + rand() * 18);
    }
    splatter(ctx, rand, 128);
  });
  if (smear) keep(smear);
  const smears = wet(smear);
  decal(smears, [2.6, 0.55], [-2.2, 0.007, 0.35], [flat[0], 0, 0]);
  decal(smears, [3.2, 0.6], [-1.1, 0.007, -2.2], [flat[0], 0, 0.5]);

  // Manos en el vidrio del jardín, del lado de adentro, y en la pared del fondo.
  const hand = paint(128, 160, (ctx) => {
    ctx.fillStyle = "#6a0508";
    ctx.beginPath();
    ctx.ellipse(64, 108, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rot, len] of [
      [26, 60, -0.5, 30],
      [46, 40, -0.15, 38],
      [68, 34, 0.05, 40],
      [90, 42, 0.25, 36],
      [108, 86, 0.9, 26],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, len / 2 + 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3, 0, 6, 40 + len);
      ctx.restore();
    }
  });
  if (hand) keep(hand);
  const hands = wet(hand);
  for (const [x, y, tilt] of [
    [0.4, 1.3, 0.2],
    [0.75, 1.55, -0.15],
    [1.1, 1.2, 0.35],
    [-0.9, 1.45, -0.3],
  ]) {
    decal(hands, [0.2, 0.25], [x, y, layout.backZ + 0.02], [0, 0, tilt]);
  }

  // Gotas que caen de la viga del borde del techo del pasillo.
  const dripMaterial = keep(new THREE.MeshStandardMaterial({ color: "#3a0204", roughness: 0.2, metalness: 0.15 }));
  const drip = keep(new THREE.BoxGeometry(1, 1, 1));
  for (let i = 0; i < 16; i++) {
    const length = 0.1 + ((i * 37) % 11) * 0.05;
    const mesh = new THREE.Mesh(drip, dripMaterial);
    mesh.scale.set(0.02, length, 0.02);
    mesh.position.set(layout.hallLeft + ((i % 3) - 1) * 0.06, layout.corridorH - 0.06 - length / 2, layout.openingZ - 0.3 - i * 0.62);
    mesh.raycast = () => {};
    scene.add(mesh);
  }

  // La frase en la pared de la derecha, con letras que chorrean.
  const words = nightIndex >= 4 ? "NO HAY SALIDA" : "SEGUIMOS ACÁ";
  const writing = paint(1024, 320, (ctx, rand) => {
    ctx.fillStyle = "#6e0508";
    ctx.font = "bold 150px Impact, 'Arial Black', sans-serif";
    ctx.textBaseline = "middle";
    let x = 30;
    for (const letter of words) {
      ctx.save();
      ctx.translate(x, 130 + (rand() - 0.5) * 20);
      ctx.rotate((rand() - 0.5) * 0.18);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
      const w = ctx.measureText(letter).width;
      if (letter !== " ") {
        for (let d = 0; d < 2; d++) {
          const dx = x + rand() * w;
          const len = 30 + rand() * 120;
          ctx.fillRect(dx, 170, 5 + rand() * 4, len);
          ctx.beginPath();
          ctx.arc(dx + 4, 170 + len, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      x += w + 8;
    }
  });
  if (writing) keep(writing);
  decal(wet(writing), [3.4, 1.06], [layout.right - 0.02, 2.2, -1.8], [0, -Math.PI / 2, 0]);

  // Los cuatro, ensangrentados y con los ojos rojos.
  const red = new THREE.Color("#5a0a0a");
  const touched = new Set<THREE.Material>();
  for (const figure of figures) {
    figure.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.Material;
      if (touched.has(material)) return;
      touched.add(material);
      if (material instanceof THREE.MeshStandardMaterial) material.color.lerp(red, 0.35);
      else if (material instanceof THREE.MeshBasicMaterial) {
        const { r, g, b } = material.color;
        if (r + g + b > 0.3) material.color.set("#ff1a12");
      }
    });
  }
}
