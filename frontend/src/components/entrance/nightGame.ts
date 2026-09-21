import * as THREE from "three";
import { makeDoctor, makeDoll, makeShadow, makeTreeMan, makeTwisted, makeWoman, type Figure } from "./nightFigures";
import { CLOSING_NIGHT, NIGHTS, WATCHING_NIGHT, type NightState } from "./nightLevels";
import { createNightSound, type Place } from "./nightSound";

export { CAMERA_NAMES, NIGHTS, type NightState } from "./nightLevels";

/**
 * La noche de terror: el mismo hall, a oscuras y con tormenta, y cuatro cosas que salen de
 * los consultorios y del jardín entre las 12 y las 6. Se sobrevive hasta las 6.
 *
 * Tardan en aparecer, pero una vez que aparecen avanzan rápido y se pueden juntar.
 * - El Doctor (naranja): asoma del piso de su consultorio, después espera pegado a la
 *   puerta y al final la abre de par en par y se queda parado en el vano, con la cabeza
 *   asomada al hall. Hay cinco segundos para ir a cerrarla; si no, ataca. La mitad de las
 *   veces, en vez de esperar en la puerta, apaga su consultorio y se pega a la cámara: por
 *   ella no se ve nada, solo sus dos ojos.
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
 * Y uno que no mata: el Retorcido, que vive en el baño de la entrada. Cada tanto abre la
 * puerta y asoma el cuerpo entero, quieto, mientras le crujen los huesos. Mientras no se lo
 * mire se queda ahí y al rato se vuelve a meter. Si uno gira y lo ve, sale corriendo, y al
 * alcanzarlo deja la vista cerrada y el corazón a mil. Cada vez que asoma se lleva un
 * décimo de la luz. Alguna noche, no todas, además dice que es él. Y a veces, al abrir la
 * puerta del baño, está ahí adentro: un segundo, y no está más.
 *
 * La luz que se lleva encima se gasta sola y dura hasta las dos. Se carga en el fondo del
 * baño, que es el único lugar donde uno se puede encerrar: con la puerta cerrada, el
 * Retorcido se cansa y se va. La puerta se cierra sola al rato de abrirla, así que no se la
 * puede dejar abierta. Si la luz llega a cero, se apaga todo, suena una canción y después ya
 * no hay nada que hacer.
 *
 * Una vez por noche, agachado detrás de la baranda del balcón, algo negro con ojos violetas
 * mira. Mirarlo dos segundos seguidos lo hace irse.
 *
 * Hay siete noches, iguales salvo por la dificultad (ver NIGHTS): qué tan seguido aparecen,
 * cuánto tiempo dan una vez que salen y cuántos cortes de luz sueltos hay. Después de la
 * quinta sale el diario: el consultorio cerró. La sexta y la séptima son en el lugar
 * clausurado, y la séptima termina con él, que habla, y con los cuatro arrodillados.
 *
 * Cada noche arranca con un cartel que explica lo básico; el reloj espera a que se lo
 * cierre. Alt+F la da por pasada.
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
    /** La pared del fondo de la entrada, la de la puerta de calle. */
    roomZ: number;
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
  /** El baño del hall: su puerta, el cargador de la luz y dónde empieza y termina el cuarto. */
  bath: {
    door: { hinge: THREE.Group; open: number; target: number; closeAt: number };
    charger: THREE.Object3D;
    doorAt: { x: number; z: number };
    /** Un paso afuera del vano, del lado de la recepción. */
    outside: { x: number; z: number };
    box: { x0: number; x1: number; z0: number; z1: number };
  };
  /** El balconcito de arriba de la escalera: a qué altura está su piso, de dónde a dónde y su borde. */
  balcony: { y: number; x0: number; x1: number; z: number };
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
  key(code: string, alt?: boolean): boolean;
  /** Si quien juega no se puede mover ni mirar: con las cámaras abiertas, o terminada la noche. */
  frozen(): boolean;
  command(name: "cam" | "close" | "start", value?: number): void;
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
/** Sin rosca abre su puerta y mira. Lo que tarda después en saltar. */
const DOLL_STARE_S = 3;
/**
 * Cortes de luz sueltos, sin nadie detrás: se prueba cada cinco segundos, con una chance
 * pensada para que se lleguen a dar los de la noche. Se arreglan subiendo la palanca, sin
 * esperar.
 */
const FAULT_TICK_S = 5;
const RESTORE_S = 5;
const INTRO_S = 4;
/** Cuánto de la luz del hall queda prendida de noche. */
const LIGHT_LEVEL = 0.5;
const SCARE_S = 1.5;
/** El Retorcido: cada cuánto prueba salir del baño, con qué chance, y cuánto espera a que lo vean. */
const TWISTED_TICK_S = 7;
const TWISTED_CHANCE = 0.12;
const TWISTED_COOLDOWN_S = 80;
const TWISTED_WAIT_S = 40;
/** A qué velocidad corre, y a qué distancia ya alcanzó. Desde la entrada hasta la recepción hay un buen trecho. */
const TWISTED_RUN = 4.6;
const TWISTED_REACH = 0.85;
/** Lo que dura lo que deja. */
const DREAD_S = 8;
/**
 * La luz que se lleva encima. Se gasta sola, muy despacio: sin cargarla llega hasta las dos.
 * Cada vez que el Retorcido asoma se lleva un décimo, y cargarla del todo lleva unos segundos.
 */
const LIGHT_DRAIN = 1 / (2 * HOUR_S);
const LIGHT_BITE = 0.1;
const LIGHT_FILL_S = 3;
/** Sin luz: lo que dura la canción antes del final, y cuándo aparecen los ojos. */
const OUT_S = 8;
const OUT_EYES_S = 4.6;
/** Abierta, la puerta del baño dura esto y se cierra sola. */
const BATH_OPEN_S = 6;
/** Al abrirla, a veces el Retorcido está adentro. Un segundo, y nada más. */
const JOLT_CHANCE = 0.1;
const JOLT_S = 1;
/** La sombra del balcón: cuánto hay que mirarla para que se vaya, y cuánto se queda si no. */
const SHADOW_SEEN_S = 2;
const SHADOW_STAY_S = 70;
/**
 * El final de la última noche, en segundos desde las 6: cuándo dice cada frase y cuánto
 * dura, cuándo se pasa al hall, cuándo se arrodilla cada uno y cuándo se apaga todo.
 */
const WORDS_AT = [1.5, 4.6, 7.7, 10.8, 25, 28.4];
const WORDS_S = 2.2;
const HALL_AT = 14.5;
const KNEEL_AT = [17.2, 18.8, 20.4, 22];
/** Al terminar la tercera, la primera vez que habla: cuándo lo dice y cuándo se va. */
const WATCHING_AT = [1.6];
const WATCHING_S = 6;
/** Ya arrodillados, aparece él detrás de ellos y dice lo último. */
const BEHIND_AT = 23.6;
const DARK_AT = 32.5;
/** La chance de que en la noche diga que es él, y cuánto dura. */
const ITS_ME_CHANCE = 0.4;
const ITS_ME_S = 2.8;

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
  const abandoned = level.abandoned ?? false;
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
  // Todo el edificio más a oscuras que el hall de siempre: se ve, pero apenas.
  for (const lamp of lamps) lamp.base *= LIGHT_LEVEL;
  for (const glow of glowing) glow.base *= LIGHT_LEVEL;
  const ambient = ctx.ambient.map((light) => ({ light, base: light.intensity * LIGHT_LEVEL }));
  const environmentBase = scene.environmentIntensity * LIGHT_LEVEL;
  const flickering = new Set(ctx.flicker);
  // Clausurado, nadie cambió un tubo: todo un poco más apagado, y todo falla.
  if (abandoned) {
    for (const lamp of lamps) {
      lamp.base *= 0.8;
      flickering.add(lamp.light);
    }
  }

  let power = 1;
  /** La luz que se lleva encima, de 1 a 0. Gastada, el edificio entero se ve más apagado. */
  let carry = 1;
  /** Lo que queda prendido de verdad: el corte de luz por lo que le queda a la linterna. */
  let lit = 1;
  function applyLight() {
    lit = power * (0.42 + 0.58 * carry);
    for (const { material, base } of glowing) material.emissiveIntensity = material.userData.off ? 0 : base * lit;
    ctx.glow.color.copy(glowBase).multiplyScalar(lit);
    // Sin luz queda apenas un resto de la luna: los ojos, los rayos y nada más.
    for (const { light, base } of ambient) light.intensity = base * (0.06 + 0.94 * lit);
    scene.environmentIntensity = environmentBase * lit;
  }
  function setPower(level: number) {
    power = level;
    applyLight();
  }
  function setCarry(level: number) {
    carry = Math.max(0, Math.min(1, level));
    applyLight();
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
  const twisted = makeTwisted(scene, keep);
  const shadow = makeShadow(scene, keep);
  const figures = [...foes.map((f) => f.figure.group), twisted.group, shadow.group];
  if (blood) paintBlood(scene, layout, keep, nightIndex, figures);
  const dust = abandoned ? paintAbandoned(scene, ctx, keep, figures) : null;
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
  const bounds = new THREE.Box3();
  const piece = new THREE.Box3();
  function waitAtDoor(f: Foe, index: number) {
    f.figure.place(left - f.figure.reach - 0.05, 0, ctx.doorZ[index], Math.PI / 2);
    f.figure.pose("wait");
    // Después se mide de verdad hasta dónde llega y se lo corre: con `reach` solo, las manos
    // del Doctor y de la Mujer atravesaban la puerta y asomaban al hall.
    f.figure.group.updateMatrixWorld(true);
    bounds.makeEmpty();
    f.figure.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.visible || (object.material as THREE.Material).transparent) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      bounds.union(piece.copy(object.geometry.boundingBox!).applyMatrix4(object.matrixWorld));
    });
    if (!bounds.isEmpty()) f.figure.group.position.x += left - 0.03 - bounds.max.x;
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
  // Arranca con el cartel de cómo se juega: el reloj no corre hasta que se lo cierra.
  let phase: NightState["phase"] = "brief";
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
  const lurkLight = new THREE.PointLight("#c8d3e6", 0, 1.6, 1.5);
  scene.add(lurkLight);
  /** El Doctor está en su consultorio a oscuras, y no en la puerta. */
  let doctorDark = false;
  let roomDark = false;
  // Sus ojos, casi tocando el lente. La cámara de ese consultorio, mientras tanto, no ve
  // nada más que esta capa: el cuarto, los muebles y hasta los relámpagos quedan afuera.
  const EYES_LAYER = 5;
  const darkEyes = new THREE.Group();
  const eyeGeometry = keep(new THREE.SphereGeometry(1, 12, 8));
  const eyeCore = keep(new THREE.MeshBasicMaterial({ color: "#fff4d6", fog: false }));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeCore);
    eye.scale.set(0.011, 0.007, 0.004);
    eye.position.set(side * 0.042, 0, 0);
    eye.rotation.z = side * -0.12;
    eye.layers.set(EYES_LAYER);
    darkEyes.add(eye);
  }
  darkEyes.visible = false;
  // Un poco abajo y a la derecha del centro, a un palmo del lente.
  darkEyes.quaternion.copy(feeds[0].quaternion);
  darkEyes.position.copy(feeds[0].position).add(new THREE.Vector3(0.05, -0.06, -0.3).applyQuaternion(feeds[0].quaternion));
  scene.add(darkEyes);
  // La luz del techo de ese consultorio, para apagarla mientras está ahí.
  const roomLamp = lamps.find(({ light }) => light.position.x < layout.hallLeft - 1 && Math.abs(light.position.z - ctx.doorZ[0]) < 0.3);
  const roomLampBase = roomLamp?.base ?? 0;
  function endDark() {
    doctorDark = false;
    darkEyes.visible = false;
    if (roomLamp) roomLamp.base = roomLampBase;
  }
  let scareUntil = 0;
  /** Cuándo se acabó la luz, o -1. Desde ahí ya no se puede hacer nada. */
  let outAt = -1;
  let eyesOut = false;
  /** Mientras se carga la luz en el baño. */
  let fillingUntil = -1;
  let outside = false;
  const lastStep = walker.position.clone();

  // La luz del susto viene de abajo, como una linterna bajo la cara.
  const scareLight = new THREE.PointLight("#ffd9b0", 0, 3, 2);
  scareLight.position.set(0, -0.45, -0.2);
  camera.add(scareLight);
  scene.add(camera);

  /**
   * Pega una figura delante de la cámara, con la cara en el medio a esa distancia. Se mide
   * la cabeza de verdad: encorvados o con el cuello quebrado, la altura sola no alcanza.
   */
  const faceAt = new THREE.Vector3();
  function frameFace(figure: Figure, distance: number, roll = 0) {
    camera.add(figure.group);
    figure.group.visible = true;
    figure.group.position.set(0, 0, 0);
    figure.group.rotation.set(0, 0, roll);
    figure.group.updateMatrixWorld(true);
    const head = figure.head.getWorldPosition(new THREE.Vector3());
    camera.worldToLocal(head);
    faceAt.set(-head.x, -head.y - 0.03, -head.z - distance);
    figure.group.position.copy(faceAt);
  }

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
      if (f.key === "doctor" && Math.random() < 0.5) {
        // Apagó su consultorio y está pegado a la cámara: no se lo ve, solo los ojos.
        doctorDark = true;
        f.figure.hide();
        darkEyes.visible = true;
        if (roomLamp) roomLamp.base = 0;
      } else if (index >= 0) waitAtDoor(f, index);
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
      endDark();
      f.deadline = time + DOCTOR_S;
      // La puerta abierta de par en par. Él, parado en el vano, apenas adentro: el cuerpo a
      // la altura de la puerta y la cabeza asomada al hall.
      // Más que el uno de siempre: la hoja queda contra la pared y el vano, a la vista desde
      // cualquier lado.
      doors[0].target = 2.45;
      doors[0].closeAt = Infinity;
      f.figure.place(left - 0.38, 0, ctx.doorZ[0] + 0.05, Math.PI / 2 + 0.15);
      f.figure.pose("lurk");
      // Una luz fría que le da en la cara desde el pasillo: sin ella, en la rendija oscura
      // no se le ve más que los ojos.
      f.figure.group.updateMatrixWorld(true);
      f.figure.head.getWorldPosition(lurkLight.position);
      lurkLight.position.x += 0.35;
      lurkLight.position.y -= 0.3;
      lurkLight.position.z -= 0.45;
      lurkLight.intensity = 0.9;
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

  /**
   * Se acabó la rosca de la cajita. Abre su puerta de par en par, se para en el vano y
   * mira. Tres segundos, y ya no hay puerta que cerrar.
   */
  function dollStare() {
    doll.stage = 4;
    doll.since = time;
    doll.deadline = time + DOLL_STARE_S;
    doors[1].target = 2.45;
    doors[1].closeAt = Infinity;
    doll.figure.place(left - 0.38, 0, ctx.doorZ[1] + 0.05, Math.PI / 2 + 0.15);
    doll.figure.pose("lurk");
    doll.figure.eyes(true);
    doll.figure.group.updateMatrixWorld(true);
    doll.figure.head.getWorldPosition(lurkLight.position);
    lurkLight.position.x += 0.35;
    lurkLight.position.y -= 0.3;
    lurkLight.position.z -= 0.45;
    lurkLight.intensity = 0.9;
    sound.screech();
    sound.creak(doorPlace(1), 1.2);
  }

  function reset(f: Foe) {
    f.stage = 0;
    f.since = time;
    if (f.key === "doctor") {
      lurkLight.intensity = 0;
      endDark();
    }
    if (f.key === "doll") {
      lurkLight.intensity = 0;
      f.figure.eyes(false);
    }
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
    // Muy de vez en cuando, al cambiar, el Retorcido está en ese consultorio. Un instante.
    if (next < 3 && twistedAt === "gone" && itsMeUntil < 0 && Math.random() < 0.05) {
      const z = ctx.doorZ[next];
      twisted.place(left - 0.3, 0, z - 0.35, 0);
      twisted.face(feeds[next].position.x, feeds[next].position.z);
      twisted.pose("stand");
      glimpseUntil = time + 0.35 + Math.random() * 0.3;
      glimpseCam = next;
      sound.setStatic(true);
    }
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

  /**
   * Se acabó la luz. Todo se apaga, empieza a sonar una canción de cuna que no tendría por
   * qué sonar en un lugar así y, cuando termina, ya no hay nada que hacer.
   */
  function lightsOut() {
    outAt = time;
    eyesOut = false;
    fillingUntil = -1;
    setCarry(0);
    setPower(0);
    closeCams(false);
    ctx.releasePointer();
    for (const f of foes) reset(f);
    dollLeft = null;
    hideTwisted();
    endItsMe();
    sound.setPower(false);
    sound.setMusicBox(null);
    sound.setHeartbeat(0);
    sound.nursery();
  }

  function updateOut() {
    if (outAt < 0) return;
    const age = time - outAt;
    if (!eyesOut && age >= OUT_EYES_S) {
      eyesOut = true;
      // Una cara en la oscuridad, a unos pasos, que se va haciendo cada vez más nítida
      // mientras termina la canción. La luz es chica y pegada a él: alumbra la cara y nada más.
      const ahead = 2.7;
      doctor.figure.place(walker.position.x - Math.sin(walker.yaw) * ahead, 0, walker.position.z - Math.cos(walker.yaw) * ahead, 0);
      doctor.figure.face(walker.position.x, walker.position.z);
      doctor.figure.pose("stand");
      doctor.figure.group.updateMatrixWorld(true);
      doctor.figure.head.getWorldPosition(lurkLight.position);
      lurkLight.position.x += Math.sin(walker.yaw) * 0.4;
      lurkLight.position.z += Math.cos(walker.yaw) * 0.4;
      lurkLight.position.y += 0.1;
    }
    if (eyesOut) {
      lurkLight.intensity = 0.35 + ((age - OUT_EYES_S) / (OUT_S - OUT_EYES_S)) * 1.45;
      doctor.figure.tick?.(time);
    }
    if (age >= OUT_S) {
      outAt = -1;
      scare(doctor);
    }
  }

  function scare(f: Foe) {
    endItsMe();
    phase = "scare";
    closeCams(false);
    ctx.setView(null);
    ctx.releasePointer();
    scareFoe = f;
    scareUntil = time + SCARE_S;
    const { figure } = f;
    figure.pose("stand");
    figure.scream(true);
    frameFace(figure, 0.55);
    scareLight.intensity = 1.4;
    lurkLight.intensity = 0;
    sound.scream();
    sound.setHeartbeat(0);
    sound.setMusicBox(null);
  }

  /** Se cerró el cartel del principio: arranca la noche. */
  function start() {
    if (phase !== "brief") return;
    phase = "intro";
    ctx.relock();
  }

  function sit() {
    seat.active = true;
    // Al pararse, medio paso hacia el hall: debajo de la escalera no hay lugar para estar parado.
    seat.standAt.set(ctx.chair.position.x - 0.1, 1.55, ctx.chair.position.z + 0.55);
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
  let bathCloseAt = Infinity;
  const toggleBath = () => {
    const opening = !ctx.bath.door.target;
    ctx.bath.door.target = opening ? 1 : 0;
    if (!opening) return sound.slam(bathPlace());
    bathCloseAt = time + BATH_OPEN_S;
    sound.creak(bathPlace(), 0.9);
    const quiet = twistedAt === "gone" && joltUntil < 0 && glimpseUntil < 0 && itsMeUntil < 0;
    if (quiet && !inBath(walker.position.x, walker.position.z) && Math.random() < JOLT_CHANCE) jolt();
  };
  const useCharger = () => {
    fillingUntil = time + (1 - carry) * LIGHT_FILL_S + 0.1;
    sound.charge();
  };

  /** Lo que hace cada cosa cambia con la situación: se pone al día en cada cuadro. */
  function refreshTouchables() {
    doors.forEach((door, index) => {
      // La turquesa, con ella parada en el vano, ya no se cierra: no hay nada que hacer.
      const stuck = index === 1 && doll.stage === 4;
      door.hinge.userData.onTouch = door.target > 0 && !stuck ? closeDoor(index) : undefined;
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

    // El baño es el único lugar que se abre y se cierra a gusto, y el cargador está al fondo.
    ctx.bath.door.hinge.userData.onTouch = toggleBath;
    ctx.bath.door.hinge.userData.label = ctx.bath.door.target ? "Cerrar" : "Abrir";
    const full = carry > 0.995;
    ctx.bath.charger.userData.onTouch = full || fillingUntil >= 0 ? undefined : useCharger;
    ctx.bath.charger.userData.label = full ? "Luz cargada" : "Cargar la luz";

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
  const drops = Array.from({ length: DROPS }, () => ({ x: 0, y: 0, z: 0, speed: 0 }));
  const rainTop = 12;
  function floorAt(x: number, z: number) {
    if (z < backZ) return 0;
    if (x < hallLeft) return layout.corridorH + 0.35;
    return layout.doorTop + ((z - backZ) / (layout.openingZ - backZ)) * (layout.hallH - layout.doorTop) + 0.08;
  }
  function spawn(drop: (typeof drops)[number], anywhere: boolean) {
    drop.x = left + Math.random() * (layout.right + 0.8 - left);
    drop.z = layout.gardenBackZ + Math.random() * (layout.openingZ - layout.gardenBackZ);
    const floor = floorAt(drop.x, drop.z);
    drop.y = anywhere ? floor + Math.random() * (rainTop - floor) : rainTop + Math.random() * 2;
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
      // Dónde corta se mira donde está ahora y no donde nació: el viento la corre, y las que
      // nacían sobre el techo del pasillo, que es más bajo, pasaban por el vidrio del hall.
      if (drop.y <= floorAt(drop.x, drop.z)) spawn(drop, false);
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
      let factor = lit;
      if (restoring) factor = Math.random() < 0.25 ? 0.6 : 0;
      else if (flickering.has(lamp.light)) {
        if (time > lamp.flickUntil && Math.random() < dt * 0.12) lamp.flickUntil = time + 0.2 + Math.random() * 0.6;
        if (time < lamp.flickUntil) factor *= Math.random() > 0.5 ? 1 : 0.1;
      }
      // La lámpara del escritorio, si se la apagó, queda apagada pase lo que pase.
      lamp.light.intensity = lamp.light.userData.off ? 0 : lamp.base * factor;
    }
  }

  /* ---------------- el clima: tensión, latido y cajita ---------------- */

  function updateMood() {
    // Sin luz queda solo la canción: nada de latido, de cajita ni de zumbido.
    if (outAt >= 0) {
      sound.setTension(0.15);
      sound.setHeartbeat(0);
      sound.setMusicBox(null);
      return;
    }
    const out = foes.filter((f) => f.stage >= 1).length;
    const striking = foes.some((f) => f.stage >= 3) || (dollLeft !== null && dollLeft < 10);
    const waiting = foes.some((f) => f.stage === 2) || (dollLeft !== null && dollLeft < 20);
    // En las noches de sangre la tensión arranca alta y no baja.
    const floor = blood ? 0.45 : 0;
    sound.setTension(Math.min(1, floor + hour / 10 + out * 0.12 + (striking ? 0.3 : 0) + (blackoutAt >= 0 ? 0.2 : 0) + (1 - carry) * 0.25));
    // Después de ver al Retorcido, el corazón a mil, y baja de a poco.
    const dread = dreadUntil > time ? (dreadUntil - time) / DREAD_S : 0;
    // Con poca luz el corazón no baja de ochenta.
    const spent = carry < 0.3 ? 80 + (0.3 - carry) * 160 : 0;
    const beat = phase !== "play" || outAt >= 0 ? 0 : itsMeUntil >= 0 ? 170 : Math.max(spent, striking ? 128 : waiting ? 78 : 0);
    sound.setHeartbeat(dread > 0 ? Math.max(beat, 90 + dread * 90) : beat);
    // La cajita se oye solo mirándola por la cámara, o cuando ya casi no le queda.
    const watchingDoll = cams && cam === 1 && blackoutAt < 0;
    const audible = dollLeft !== null && phase === "play" && outAt < 0 && (watchingDoll || dollLeft < DOLL_AUDIBLE_S);
    sound.setMusicBox(audible ? dollLeft! / DOLL_S : null);
  }

  /* ---------------- el Retorcido, el del baño ---------------- */

  const bath = ctx.bath;
  const inBath = (x: number, z: number) => x > bath.box.x0 && x < bath.box.x1 && z > bath.box.z0 && z < bath.box.z1;

  // Una luz fría y débil encima de él, que titila: sin ella, en la penumbra del hall no se
  // distingue de la pared.
  const twistedLight = new THREE.PointLight("#b8c4d8", 0, 8, 1.4);
  scene.add(twistedLight);
  let twistedAt: "gone" | "waiting" | "running" = "gone";
  let twistedSince = -TWISTED_COOLDOWN_S;
  let nextTwisted = GRACE_S + 15 + Math.random() * 30;
  let nextSightCheck = 0;
  let nextCrack = 0;
  /** Asomado en el vano del baño, apenas adentro, con el cuerpo entero a la vista. */
  const TWISTED_SPOT = { x: bath.doorAt.x, z: bath.doorAt.z + 0.14 };
  /** Corriendo, primero sale del vano y recién después va a buscar a quien juega. */
  let outOfDoor = false;
  let dreadUntil = -1;
  let glimpseUntil = -1;
  let glimpseCam = -1;
  const eye = new THREE.Vector3();
  const target = new THREE.Vector3();
  const sight = new THREE.Raycaster();

  /**
   * Si desde donde está la cámara se ve ese punto: en pantalla y sin nada en el medio. Lo
   * que se choca de `owner` no tapa: es el mismo que se está buscando.
   */
  function inSight(point: THREE.Vector3, owner: THREE.Object3D = twisted.group) {
    const onScreen = point.clone().project(camera);
    if (onScreen.z > 1 || Math.abs(onScreen.x) > 0.85 || Math.abs(onScreen.y) > 0.9) return false;
    camera.getWorldPosition(eye);
    const distance = eye.distanceTo(point);
    sight.set(eye, target.copy(point).sub(eye).normalize());
    sight.far = distance;
    for (const hit of sight.intersectObjects(scene.children, true)) {
      let object: THREE.Object3D | null = hit.object;
      let hidden = false;
      let his = false;
      while (object) {
        if (!object.visible) hidden = true;
        if (object === owner) his = true;
        object = object.parent;
      }
      if (hidden) continue;
      return his || hit.distance > distance - 0.4;
    }
    return true;
  }

  /**
   * Si se lo está viendo. Se prueban la cara y el pecho: es alto, y desde lejos y de abajo
   * la cabeza puede quedar tapada por el dintel del baño mientras espera en el vano.
   */
  const chest = new THREE.Vector3();
  function seesTwisted() {
    if (cams || itsMeUntil >= 0) return false;
    twisted.head.getWorldPosition(chest);
    if (inSight(chest)) return true;
    chest.set(twisted.group.position.x, twisted.group.position.y + 1.4, twisted.group.position.z);
    return inSight(chest);
  }

  const bathPlace = () => placeOf(bath.doorAt.x, bath.doorAt.z);

  /** Abre la puerta del baño y asoma, quieto. Cada vez que lo hace se lleva un poco de luz. */
  function showTwisted() {
    twistedAt = "waiting";
    twistedSince = time;
    outOfDoor = false;
    bath.door.target = 1;
    twisted.group.userData.running = false;
    twisted.place(TWISTED_SPOT.x, 0, TWISTED_SPOT.z, Math.PI);
    twisted.pose("stand");
    twisted.eyes(true);
    twistedLight.position.set(bath.doorAt.x, 2.3, bath.doorAt.z - 0.45);
    nextCrack = time + 0.5;
    setCarry(carry - LIGHT_BITE);
    sound.creak(bathPlace(), 1.1);
  }

  function hideTwisted() {
    twistedAt = "gone";
    twistedSince = time;
    outOfDoor = false;
    twisted.group.userData.running = false;
    twisted.hide();
    twistedLight.intensity = 0;
    // Se vuelve a meter y cierra, salvo que quien juega esté adentro: ahí se cierra sola al rato.
    if (!inBath(walker.position.x, walker.position.z)) bath.door.target = 0;
    else bathCloseAt = time + BATH_OPEN_S;
  }

  /** Abrieron la puerta del baño y está ahí, de frente, a un paso del vano. Un segundo. */
  let joltUntil = -1;
  function jolt() {
    joltUntil = time + JOLT_S;
    twisted.group.userData.running = false;
    twisted.place(bath.doorAt.x, 0, bath.doorAt.z + 0.75, Math.PI);
    twisted.face(walker.position.x, walker.position.z);
    twisted.pose("stand");
    twisted.eyes(true);
    twistedLight.position.set(bath.doorAt.x, 2.2, bath.doorAt.z + 0.2);
    twistedLight.intensity = 2.4;
    sound.jolt(bathPlace());
  }

  /** Lo miraron: sale del baño y viene. */
  function startRun() {
    twistedAt = "running";
    twistedSince = time;
    // Si lo miraron desde adentro del baño, no hay vano del que salir.
    outOfDoor = inBath(walker.position.x, walker.position.z);
    twisted.pose("run");
    twisted.group.userData.running = true;
    sound.screech();
    sound.growl(bathPlace());
  }

  /** Te alcanzó: se va y deja la vista cerrada y el corazón a mil. No mata. */
  function stun() {
    hideTwisted();
    dreadUntil = time + DREAD_S;
    sound.dread();
  }

  function updateTwisted(dt: number) {
    if (glimpseUntil >= 0 && (time >= glimpseUntil || !cams || cam !== glimpseCam)) {
      glimpseUntil = -1;
      twisted.hide();
      sound.setStatic(false);
    }
    if (joltUntil >= 0 && (time >= joltUntil || phase !== "play")) {
      joltUntil = -1;
      twisted.hide();
      twistedLight.intensity = 0;
    }
    if (phase !== "play" || outAt >= 0) {
      if (twistedAt !== "gone") hideTwisted();
      return;
    }
    if (twistedAt === "gone") {
      if (time < nextTwisted) return;
      nextTwisted = time + TWISTED_TICK_S * (0.8 + Math.random() * 0.4);
      if (time - twistedSince < TWISTED_COOLDOWN_S || glimpseUntil >= 0 || itsMeUntil >= 0 || joltUntil >= 0) return;
      if (Math.random() < TWISTED_CHANCE * Math.min(2, level.appear)) showTwisted();
      return;
    }

    const glow = twistedAt === "running" ? 3.4 : 1.4;
    twistedLight.intensity = Math.random() < 0.08 ? 0.2 : glow * (0.4 + 0.6 * lit);
    const { group } = twisted;

    if (twistedAt === "waiting") {
      // Quieto en el vano, mirando al hall, mientras le crujen los huesos.
      if (time >= nextCrack) {
        nextCrack = time + 2.5 + Math.random() * 2.5;
        sound.twisted(bathPlace());
      }
      if (time - twistedSince > TWISTED_WAIT_S) return hideTwisted();
      if (time < nextSightCheck) return;
      nextSightCheck = time + 0.1;
      if (seesTwisted()) startRun();
      return;
    }

    // Encerrado en el baño con la puerta cerrada, se cansa y se vuelve.
    if (outOfDoor && bath.door.open < 0.25 && inBath(walker.position.x, walker.position.z)) return hideTwisted();

    const goX = outOfDoor ? walker.position.x : bath.outside.x;
    const goZ = outOfDoor ? walker.position.z : bath.outside.z;
    const dx = goX - group.position.x;
    const dz = goZ - group.position.z;
    const far = Math.hypot(dx, dz);
    if (!outOfDoor && far < 0.3) {
      outOfDoor = true;
      return;
    }
    if (outOfDoor && far <= TWISTED_REACH) return stun();
    if (far < 0.001) return;
    const step = Math.min(far, TWISTED_RUN * (0.85 + level.appear * 0.08) * dt);
    group.position.x += (dx / far) * step;
    group.position.z += (dz / far) * step;
    twisted.face(goX, goZ);
    twistedLight.position.set(group.position.x + (dx / far) * 0.7, 2.2, group.position.z + (dz / far) * 0.7);
    if (time >= nextCrack) {
      nextCrack = time + 0.5;
      sound.twisted(placeOf(group.position.x, group.position.z));
    }
  }

  /* ---------------- la sombra del balcón ---------------- */

  const { balcony } = ctx;
  /** Cuándo aparece, una sola vez en la noche. */
  let shadowAt = GRACE_S + HOUR_S * 0.5 + Math.random() * HOUR_S * 3.5;
  let shadowSince = -1;
  let shadowSeen = 0;
  let shadowVisible = false;
  let nextShadowCheck = 0;
  const shadowEyes = new THREE.Vector3();

  function goneShadow(loud: boolean) {
    if (shadowSince < 0) return;
    shadowSince = -1;
    if (loud) sound.vanish(placeOf(shadow.group.position.x, shadow.group.position.z));
    shadow.hide();
  }

  function updateShadow(dt: number) {
    if (shadowSince < 0) {
      if (phase !== "play" || outAt >= 0 || time < shadowAt) return;
      shadowAt = Infinity;
      shadowSince = time;
      shadowSeen = 0;
      // Agachado detrás de la baranda, en cualquier punto del balcón.
      const x = balcony.x0 + 0.5 + Math.random() * (balcony.x1 - balcony.x0 - 1);
      shadow.place(x, balcony.y, balcony.z + 0.42);
      return;
    }
    if (phase !== "play" || outAt >= 0 || time - shadowSince > SHADOW_STAY_S) return goneShadow(false);
    shadow.face(walker.position.x, walker.position.z);
    shadow.tick(time);
    if (time >= nextShadowCheck) {
      nextShadowCheck = time + 0.1;
      shadow.group.updateMatrixWorld(true);
      shadow.eyes.getWorldPosition(shadowEyes);
      shadowVisible = !cams && itsMeUntil < 0 && inSight(shadowEyes, shadow.group);
    }
    // Dos segundos seguidos: si se deja de mirar, empieza de nuevo.
    shadowSeen = shadowVisible ? shadowSeen + dt : 0;
    if (shadowSeen >= SHADOW_SEEN_S) goneShadow(true);
  }

  /* ---------------- el final de la última noche ---------------- */

  let endingAt = -1;
  let ending = 0;
  let said = 0;
  let kneeled = 0;
  // Una luz violeta arriba de los cuatro, como la de los ojos de él.
  const finaleLight = new THREE.PointLight("#9b4dff", 0, 13, 1.1);
  scene.add(finaleLight);
  const court = [doctor, doll, woman, tree];

  /**
   * Son las 6 de la última noche: él habla, en la oscuridad y a unos pasos, y después los
   * cuatro. En la tercera es lo mismo pero corto: una frase, y recién ahí el cartel de las 6.
   */
  const firstWords = nightIndex === WATCHING_NIGHT;
  const wordsAt = firstWords ? WATCHING_AT : WORDS_AT;
  function startEnding() {
    phase = "ending";
    endingAt = time;
    ending = 1;
    said = 0;
    kneeled = 0;
    setCarry(1);
    setPower(0);
    sound.setPower(false);
    sound.fadeOut(3);
    lurkLight.intensity = 0;
    goneShadow(false);
    // No se le ve nada más que los ojos, a la altura de los de uno y en el medio de la pantalla.
    // Siempre en el mismo lugar despejado del hall, parado y mirando al fondo: puesto delante
    // de donde uno estuviera, sentado en la recepción quedaba metido en el escritorio.
    seat.active = false;
    walker.position.set(0.6, 1.55, 0.6);
    walker.yaw = 0;
    walker.pitch = 0;
    const ahead = 1.6;
    shadow.place(walker.position.x - Math.sin(walker.yaw) * ahead, 0, walker.position.z - Math.cos(walker.yaw) * ahead);
    shadow.face(walker.position.x, walker.position.z);
    shadow.group.updateMatrixWorld(true);
    shadow.group.position.y += walker.position.y - shadow.eyes.getWorldPosition(shadowEyes).y;
  }

  function updateEnding() {
    if (phase !== "ending") return;
    const age = time - endingAt;
    if (ending === 1 || (ending === 2 && age >= BEHIND_AT)) shadow.tick(time);
    while (said < wordsAt.length && age >= wordsAt[said]) {
      sound.murmur(WORDS_S);
      said += 1;
    }
    if (firstWords) {
      if (age < WATCHING_S) return;
      // Se va, vuelve la luz y queda el cartel de las 6, en silencio.
      phase = "won";
      ending = 0;
      shadow.hide();
      setPower(1);
      return;
    }
    if (ending === 1 && age >= HALL_AT) {
      ending = 2;
      shadow.hide();
      // Parado en medio del hall, mirando hacia el fondo, y los cuatro en semicírculo delante.
      seat.active = false;
      walker.position.set(0.6, 1.55, 0.6);
      walker.yaw = 0;
      walker.pitch = -0.1;
      court.forEach((f, i) => {
        f.figure.place(-0.75 + i * 1.0, 0, -2.4 + Math.abs(i - 1.5) * 0.4, 0);
        f.figure.face(walker.position.x, walker.position.z);
        f.figure.pose("stand");
        f.figure.eyes(true);
      });
      finaleLight.position.set(0.6, 3.2, -1.7);
      setPower(0.3);
      sound.finale();
    }
    if (ending === 2) {
      finaleLight.intensity = Math.min(4.6, (age - HALL_AT) * 1.6) * (Math.random() < 0.04 ? 0.5 : 1);
      while (kneeled < court.length && age >= KNEEL_AT[kneeled]) {
        court[kneeled].figure.pose("kneel");
        sound.kneel();
        kneeled += 1;
      }
      if (age >= BEHIND_AT && shadow.group.position.y < -1) {
        // Detrás de ellos, en el hueco del medio y más grande que en el balcón: de pie, con los
        // ojos a la altura de los de uno.
        shadow.group.scale.setScalar(1.6);
        shadow.place(0.75, 0, -3.8);
        shadow.face(walker.position.x, walker.position.z);
        shadow.group.updateMatrixWorld(true);
        shadow.group.position.y += walker.position.y - 0.05 - shadow.eyes.getWorldPosition(shadowEyes).y;
        sound.vanish(placeOf(0.75, -3.8));
      }
      if (age >= DARK_AT) {
        ending = 3;
        finaleLight.intensity = 0;
        setPower(0);
        for (const f of court) f.figure.hide();
        shadow.hide();
      }
    }
  }

  /** Alt+F: la noche pasa de una, como si ya fueran las 6. */
  function skip() {
    if ((phase !== "play" && phase !== "intro" && phase !== "brief") || outAt >= 0) return;
    phase = "play";
    time = Math.max(time, 6 * HOUR_S);
  }

  /* ---------------- "it's me" ---------------- */

  let itsMeAt = Math.random() < ITS_ME_CHANCE ? HOUR_S * (1.5 + Math.random() * 3.5) : Infinity;
  let itsMeUntil = -1;
  let nextFlick = 0;

  function startItsMe() {
    itsMeUntil = time + ITS_ME_S;
    itsMeAt = Infinity;
    hideTwisted();
    // Pegado a la cara, en el medio de la pantalla. Se lo gira un poco para que la cabeza,
    // que la tiene acostada sobre el hombro, se lea como una cara, torcida igual.
    twisted.group.userData.running = false;
    twisted.pose("stand");
    twisted.scream(true);
    frameFace(twisted, 0.62, -1.15);
    scareLight.intensity = 1.2;
    sound.itsMe();
  }

  function endItsMe() {
    if (itsMeUntil < 0) return;
    itsMeUntil = -1;
    scene.add(twisted.group);
    twisted.group.visible = true;
    twisted.scream(false);
    twisted.hide();
    scareLight.intensity = 0;
  }

  function updateItsMe() {
    if (itsMeUntil < 0) {
      if (phase === "play" && time >= itsMeAt) {
        if (blackoutAt < 0 && twistedAt === "gone") startItsMe();
        else itsMeAt = time + 10;
      }
      return;
    }
    if (time >= itsMeUntil || phase !== "play") return endItsMe();
    // A saltos: la cara, negro, la cara. Cada cuadro dura lo que quiere.
    if (time >= nextFlick) {
      nextFlick = time + 0.05 + Math.random() * 0.13;
      twisted.group.visible = Math.random() < 0.55;
    }
    ctx.setView(null);
  }

  /* ---------------- más cosas que se oyen ---------------- */

  let nextSteps = GRACE_S + 40 + Math.random() * 40;
  let nextBreath = 0;

  function updateHaunting() {
    if (phase !== "play") return;
    // Pasos detrás: se da vuelta y no hay nadie.
    if (time >= nextSteps) {
      nextSteps = time + 35 + Math.random() * (60 - hour * 6);
      const behind = walker.yaw + Math.PI + (Math.random() - 0.5) * 0.8;
      sound.footsteps(placeOf(walker.position.x + Math.sin(behind) * 3, walker.position.z + Math.cos(behind) * 3));
    }
    // A oscuras, una respiración muy cerca, de un lado o del otro.
    if (blackoutAt >= 0 && time >= nextBreath) {
      nextBreath = time + 5 + Math.random() * 5;
      sound.breath({ pan: Math.random() < 0.5 ? -0.8 : 0.8, near: 0.95 });
    }
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
      dread: dreadUntil > time,
      itsMe: itsMeUntil >= 0,
      light: Math.round(carry * 100) / 100,
      lightsOut: outAt >= 0,
      filling: fillingUntil >= 0,
      ending,
      said,
    };
    const key = JSON.stringify(state);
    if (key === last) return;
    last = key;
    ctx.onState(state);
  }

  /* ---------------- cada cuadro ---------------- */

  function update(dt: number) {
    // Con el cartel de cómo se juega, el reloj espera: llueve, pero no pasa nada más.
    if (phase !== "brief") time += dt;
    updateStorm(dt);
    dust?.(dt);
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
      group.position.x = faceAt.x + (Math.random() - 0.5) * 0.05;
      group.position.y = faceAt.y + (Math.random() - 0.5) * 0.05;
      group.rotation.z = (Math.random() - 0.5) * 0.12;
      if (time >= scareUntil) {
        phase = "dead";
        scene.add(group);
        scareFoe.figure.hide();
        scareLight.intensity = 0;
      }
    }

    if (phase === "intro" && time >= INTRO_S) phase = "play";

    if (phase === "play" && outAt < 0) {
      const nextHour = Math.min(6, Math.floor(time / HOUR_S));
      if (nextHour !== hour) {
        hour = nextHour;
        sound.toll(hour === 6 ? 3 : 1);
        if (hour === 6) {
          phase = "won";
          for (const f of foes) reset(f);
          endItsMe();
          hideTwisted();
          goneShadow(false);
          dreadUntil = -1;
          dollLeft = null;
          closeCams(false);
          ctx.releasePointer();
          blackoutAt = -1;
          restoreAt = -1;
          setPower(1);
          sound.setPower(true);
          if (nightIndex === NIGHTS.length - 1 || firstWords) startEnding();
          else if (nightIndex === CLOSING_NIGHT) {
            // El diario: la tormenta se va y queda la musiquita.
            sound.fadeOut(2);
            sound.newspaper();
          }
        }
      }
    }

    if (phase === "play" && outAt < 0) {
      for (const f of foes) {
        if (time >= f.nextTick) {
          f.nextTick = time + (f.stage === 0 ? APPEAR_TICK_S : ADVANCE_TICK_S) * (0.8 + Math.random() * 0.4);
          tryAdvance(f);
        }
      }

      if (doctor.stage === 3) {
        if (time >= doctor.deadline) scare(doctor);
      }
    }

    if (phase === "play" && outAt < 0) {
      if (fillingUntil >= 0) {
        setCarry(carry + dt / LIGHT_FILL_S);
        if (carry >= 1 || time >= fillingUntil) fillingUntil = -1;
      } else {
        setCarry(carry - LIGHT_DRAIN * dt);
        if (carry <= 0) lightsOut();
      }
    }
    updateOut();

    if (phase === "play" && outAt < 0 && dollLeft !== null) {
      const watching = cams && cam === 1 && blackoutAt < 0;
      dollLeft = watching ? Math.min(DOLL_S, dollLeft + DOLL_WATCH_GAIN * dt) : dollLeft - dt;
      placeDoll(dollLeft);
      if (dollLeft <= 0) {
        dollLeft = null;
        dollStare();
      }
    }

    if (phase === "play" && doll.stage === 4 && time >= doll.deadline) scare(doll);

    if (phase === "play" && outAt < 0 && woman.stage === 3) {
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

    if (phase === "play" && outAt < 0 && tree.stage === 3 && time >= tree.deadline) {
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
    if (phase === "play" && outAt < 0 && time >= nextFault) {
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

    updateTwisted(dt);
    updateShadow(dt);
    updateEnding();
    updateHaunting();

    // La del baño no se puede dejar abierta: al rato se cierra sola. Con alguien en el vano, espera.
    if (bath.door.target && twistedAt === "gone" && time >= bathCloseAt) {
      if (Math.hypot(walker.position.x - bath.doorAt.x, walker.position.z - bath.doorAt.z) > 0.75) {
        bath.door.target = 0;
        bathCloseAt = Infinity;
        sound.slam(bathPlace());
      }
    }

    // El Doctor a oscuras: su cámara solo ve la capa de los ojos. Al entrar, se lo oye
    // respirar ahí nomás.
    const dark = cams && cam === 0 && doctorDark;
    if (dark !== roomDark) {
      roomDark = dark;
      if (dark) {
        feeds[0].layers.set(EYES_LAYER);
        sound.breath({ pan: 0, near: 0.9 });
      } else feeds[0].layers.set(0);
    }

    // Lo que se mueve solo en las figuras que están a la vista: respirar, temblar, mirar.
    // Arrodillados al final, quietos.
    for (const f of foes) if (f.figure.group.position.y > -1 && ending !== 2) f.figure.tick?.(time);
    twisted.tick?.(time);

    updateMood();

    infrared.forEach((light, index) => (light.intensity = cams && index === cam && !roomDark ? (index === 3 ? 4 : 2.2) : 0));
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
    updateItsMe();

    refreshTouchables();
    emit();
  }

  return {
    update,
    key(code, alt) {
      if (alt && code === "KeyF") {
        skip();
        return true;
      }
      if (phase === "brief") {
        if (code === "Enter" || code === "Space" || code === "KeyE") start();
        return code !== "Escape";
      }
      if (phase === "scare" || phase === "dead" || phase === "won" || phase === "ending" || outAt >= 0) return true;
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
      return cams || phase !== "play" || outAt >= 0;
    },
    command(name, value) {
      if (name === "cam" && typeof value === "number") selectCam(value);
      if (name === "close") closeCams();
      if (name === "start") start();
    },
    dispose() {
      sound.dispose();
      camera.remove(scareLight);
      scene.remove(rain, flash, twistedLight, lurkLight, darkEyes, finaleLight, ...infrared);
      for (const f of foes) f.figure.group.removeFromParent();
      twisted.group.removeFromParent();
      shadow.group.removeFromParent();
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

/* ---------------- el consultorio clausurado, las dos noches después del diario ---------------- */

/**
 * Lo que quedó cuando cerró: cintas de clausura cruzadas en las puertas de los consultorios
 * y en la del jardín, el cartel de la clausura en la pared, telarañas en los rincones,
 * papeles y hojas secas por el piso, polvo flotando y todo gastado, tirando a gris. Devuelve
 * lo que mueve el polvo en cada cuadro.
 */
function paintAbandoned(
  scene: THREE.Scene,
  ctx: NightContext,
  keep: <T extends { dispose(): void }>(thing: T) => T,
  figures: THREE.Object3D[]
) {
  const { layout } = ctx;
  const plane = keep(new THREE.PlaneGeometry(1, 1));
  function decal(
    material: THREE.Material,
    size: [number, number],
    at: [number, number, number],
    rotation: [number, number, number],
    parent: THREE.Object3D = scene
  ) {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(size[0], size[1], 1);
    mesh.position.set(...at);
    mesh.rotation.set(...rotation);
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  }
  const flatMaterial = (map: THREE.Texture | null, extra: THREE.MeshStandardMaterialParameters = {}) =>
    keep(
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        roughness: 0.8,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        ...extra,
      })
    );

  // Todo gastado: los colores de la escena se ensucian hacia un gris amarronado. Los de ellos no.
  const theirs = new Set<THREE.Material>();
  for (const figure of figures) {
    figure.traverse((object) => {
      if (object instanceof THREE.Mesh) theirs.add(object.material as THREE.Material);
    });
  }
  const grime = new THREE.Color("#5e5949");
  const touched = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    if (theirs.has(material) || touched.has(material) || !(material instanceof THREE.MeshStandardMaterial)) return;
    touched.add(material);
    material.color.lerp(grime, 0.38);
    material.roughness = Math.min(1, material.roughness + 0.2);
  });

  // La cinta de la clausura: amarilla, con la palabra repetida.
  const tape = paint(512, 48, (c) => {
    c.fillStyle = "#e8c21c";
    c.fillRect(0, 0, 512, 48);
    c.fillStyle = "#141414";
    c.fillRect(0, 0, 512, 5);
    c.fillRect(0, 43, 512, 5);
    c.font = "bold 28px 'Arial Black', Impact, sans-serif";
    c.textBaseline = "middle";
    for (let x = 6; x < 512; x += 250) c.fillText("CLAUSURADO", x, 25);
  });
  if (tape) keep(tape);
  const tapeMaterial = flatMaterial(tape, { roughness: 0.5 });
  // En cada puerta, cruzada de lado a lado. Va pegada a la hoja: al abrirla, gira con ella.
  for (const door of ctx.doors) {
    for (const tilt of [0.55, -0.5]) decal(tapeMaterial, [1.25, 0.1], [0.03, 1.35 + tilt * 0.1, 0.475], [0, Math.PI / 2, tilt], door.hinge);
  }
  // La del jardín, en equis sobre el vidrio.
  const glassMid = layout.glassLeft + 1.45;
  for (const tilt of [0.62, -0.62]) decal(tapeMaterial, [3.4, 0.13], [glassMid, 1.35, layout.backZ + 0.08], [0, 0, tilt]);
  // Y una de lado a lado del hall, a la altura de la cintura, floja: la cruzaron al cerrar.
  decal(tapeMaterial, [4.2, 0.1], [(layout.hallLeft + layout.right) / 2, 1.05, layout.backZ + 2.2], [0, 0, 0.03]);

  // El cartel de la clausura, pegado en la pared de la derecha.
  const notice = paint(256, 340, (c, rand) => {
    c.fillStyle = "#e9e3cf";
    c.fillRect(0, 0, 256, 340);
    c.fillStyle = "#9c1b16";
    c.fillRect(14, 18, 228, 58);
    c.fillStyle = "#f4efe0";
    c.font = "bold 30px 'Arial Black', Impact, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("CLAUSURADO", 128, 48);
    c.fillStyle = "#2b2824";
    for (let y = 100; y < 300; y += 16) c.fillRect(22, y, 150 + rand() * 62, 5);
    c.strokeStyle = "#7a1612";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(190, 290, 30, 0, Math.PI * 2);
    c.stroke();
    // Manchas de humedad.
    for (let i = 0; i < 7; i++) {
      c.fillStyle = `rgba(120, 96, 50, ${0.1 + rand() * 0.15})`;
      c.beginPath();
      c.arc(rand() * 256, rand() * 340, 10 + rand() * 40, 0, Math.PI * 2);
      c.fill();
    }
  });
  if (notice) keep(notice);
  decal(flatMaterial(notice), [0.5, 0.66], [layout.right - 0.02, 1.6, -2.4], [0, -Math.PI / 2, 0.04]);

  // Telarañas en los rincones de arriba: hilos que salen de la esquina y vueltas entre ellos.
  const web = paint(256, 256, (c) => {
    c.strokeStyle = "rgba(230, 230, 225, 0.55)";
    c.lineWidth = 1.5;
    const spokes = 9;
    for (let i = 0; i < spokes; i++) {
      const a = (i / (spokes - 1)) * (Math.PI / 2);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 256, Math.sin(a) * 256);
      c.stroke();
    }
    for (let r = 26; r < 256; r += 26) {
      c.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = (i / (spokes - 1)) * (Math.PI / 2);
        const sag = r * (0.9 + (i % 2) * 0.06);
        if (i === 0) c.moveTo(Math.cos(a) * sag, Math.sin(a) * sag);
        else c.lineTo(Math.cos(a) * sag, Math.sin(a) * sag);
      }
      c.stroke();
    }
  });
  if (web) keep(web);
  const webs = flatMaterial(web, { roughness: 1, polygonOffset: false });
  const corners: [number, number, number, number, number, number][] = [
    [layout.right - 0.02, layout.corridorH - 0.05, layout.openingZ - 0.2, -Math.PI / 2, 0, 0.9],
    [layout.left + 0.02, layout.corridorH - 0.02, layout.backZ + 0.25, Math.PI / 2, -Math.PI / 2, 0.8],
    [layout.hallLeft + 0.12, layout.corridorH - 0.02, layout.openingZ - 0.2, Math.PI / 2, 0, 0.7],
    [layout.right - 0.02, layout.doorTop - 0.05, layout.backZ + 0.25, -Math.PI / 2, -Math.PI / 2, 1],
    [layout.left + 0.02, 0.05, layout.openingZ - 0.2, Math.PI / 2, Math.PI, 0.5],
  ];
  for (const [x, y, z, ry, rz, size] of corners) decal(webs, [size, size], [x, y, z], [0, ry, rz]);

  // Papeles, fichas y hojas secas por el piso.
  const scrap = paint(64, 64, (c, rand) => {
    c.fillStyle = "#ddd6c2";
    c.fillRect(4, 4, 56, 56);
    c.fillStyle = "#6f685a";
    for (let y = 14; y < 54; y += 8) c.fillRect(10, y, 20 + rand() * 24, 2);
  });
  if (scrap) keep(scrap);
  const scraps = flatMaterial(scrap);
  const leaves = flatMaterial(null, { color: "#5a3f22" });
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    const x = layout.left + 0.3 + rand() * (layout.right - layout.left - 0.6);
    const z = layout.backZ + 0.3 + rand() * (layout.openingZ - layout.backZ - 0.6);
    const paper = i % 3 === 0;
    const size = paper ? 0.22 + rand() * 0.08 : 0.06 + rand() * 0.06;
    decal(paper ? scraps : leaves, [size, size * (paper ? 1.3 : 0.6)], [x, 0.007 + i * 0.00005, z], [-Math.PI / 2, 0, rand() * Math.PI * 2]);
  }

  // El polvo: motas que flotan en el aire del hall y apenas se ven cuando les da la luz.
  const MOTES = 500;
  const positions = new Float32Array(MOTES * 3);
  const phase = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    positions[i * 3] = layout.hallLeft + rand() * (layout.right - layout.hallLeft);
    positions[i * 3 + 1] = rand() * 3.2;
    positions[i * 3 + 2] = layout.backZ + rand() * (layout.openingZ - layout.backZ);
    phase[i] = rand() * Math.PI * 2;
  }
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const motes = new THREE.Points(
    geometry,
    keep(new THREE.PointsMaterial({ color: "#b9b29c", size: 0.006, transparent: true, opacity: 0.45, depthWrite: false }))
  );
  motes.raycast = () => {};
  motes.frustumCulled = false;
  scene.add(motes);
  let clock = 0;
  return (dt: number) => {
    clock += dt;
    for (let i = 0; i < MOTES; i++) {
      const o = i * 3;
      positions[o] += Math.sin(clock * 0.3 + phase[i]) * 0.02 * dt;
      positions[o + 1] -= 0.03 * dt;
      positions[o + 2] += Math.cos(clock * 0.23 + phase[i]) * 0.02 * dt;
      if (positions[o + 1] < 0) positions[o + 1] = 3.2;
    }
    geometry.attributes.position.needsUpdate = true;
  };
}
