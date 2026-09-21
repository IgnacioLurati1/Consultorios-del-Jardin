import { nightAudio } from "./nightAudio";

/**
 * Los sonidos de la noche de terror, armados en el momento con Web Audio: ruido filtrado,
 * osciladores y un eco de edificio grande. No hay archivos que bajar.
 *
 * Lo que da miedo no es un sonido fuerte sino lo que no para: la lluvia sobre el vidrio,
 * un viento que aúlla y cambia, un zumbido grave que se pone más tenso con las horas, y
 * cada tanto algo lejos (una madera que cruje, tres golpes, un susurro). Encima van los
 * avisos: un golpe grave cuando alguien aparece, un chirrido de cuerdas cuando sale, el
 * latido cuando hay peligro y la cajita de música de la muñeca.
 *
 * Todo pasa por un compresor antes de salir, para que el grito y los truenos se sientan
 * sin reventar los parlantes. Lo que viene de un lugar suena de ese lado (`Place`).
 */

/** De dónde viene un sonido: a qué lado (-1 izquierda, 1 derecha) y qué tan cerca (0 a 1). */
export interface Place {
  pan: number;
  near: number;
}

const HERE: Place = { pan: 0, near: 1 };

export interface NightSound {
  /** Lo que se programa solo: los ruidos lejanos, las gotas, el latido y la cajita. */
  tick(dt: number): void;
  /** Cuánto peligro hay, de 0 a 1: sube el zumbido, el viento y los ruidos lejanos. */
  setTension(level: number): void;
  /** Latidos por minuto; 0 lo apaga. */
  setHeartbeat(bpm: number): void;
  /** La cajita de la muñeca: apagada (null) o sonando, más lenta y desafinada cuanto más cerca de 0. */
  setMusicBox(level: number | null): void;
  setOutside(outside: boolean): void;
  setPower(on: boolean): void;
  setStatic(on: boolean): void;
  thunder(strength: number): void;
  creak(place?: Place, duration?: number): void;
  slam(place?: Place): void;
  appear(place?: Place): void;
  whisper(place?: Place): void;
  /** Golpes secos con los nudillos sobre un vidrio. */
  glassKnock(place?: Place): void;
  /** Un gruñido áspero y grave, como una respiración que raspa. */
  growl(place?: Place): void;
  screech(): void;
  scream(): void;
  /** Pasos que se acercan desde donde no hay nadie. */
  footsteps(place?: Place): void;
  /** Una respiración ronca, muy cerca. */
  breath(place?: Place): void;
  /** Lo que deja el Retorcido al irse: un golpe, un pitido en los oídos y todo apagado. */
  dread(): void;
  /** "It's me": una voz que no es voz, dos veces, entre estática. */
  itsMe(): void;
  /** El Retorcido: huesos que crujen y se acomodan, y un gemido grave que no respira. */
  twisted(place?: Place): void;
  /** Cargando la luz en el baño: un zumbido que sube y no termina de estar bien. */
  charge(): void;
  /** Sin luz: una canción de cuna que se va quedando sin cuerda. Dura ocho segundos. */
  nursery(): void;
  /** Un segundo de algo que no debería estar: un golpe y un chillido rasposo que se corta. */
  jolt(place?: Place): void;
  /** La sombra del balcón que se va: un soplido que se da vuelta y un golpe hueco. */
  vanish(place?: Place): void;
  /** La del diario: un vals de cajita, alegre de más y apenas desafinado. Unos cuarenta segundos. */
  newspaper(): void;
  /** Una frase de la voz del final: un murmullo grave, sin palabras, de lo que dura la frase. */
  murmur(seconds: number): void;
  /** El final: un coro grave en menor, campanas lentas y un golpe por cada uno que se arrodilla. */
  finale(): void;
  /** Un golpe grave, como algo pesado que se apoya en el piso. */
  kneel(): void;
  /** Todo se apaga de a poco: la lluvia, el viento y el zumbido. */
  fadeOut(seconds: number): void;
  toll(times: number): void;
  crackle(): void;
  click(): void;
  step(): void;
  dispose(): void;
}

const SILENT: NightSound = {
  tick() {},
  setTension() {},
  setHeartbeat() {},
  setMusicBox() {},
  setOutside() {},
  setPower() {},
  setStatic() {},
  thunder() {},
  creak() {},
  slam() {},
  appear() {},
  whisper() {},
  glassKnock() {},
  growl() {},
  screech() {},
  scream() {},
  footsteps() {},
  breath() {},
  dread() {},
  itsMe() {},
  twisted() {},
  charge() {},
  nursery() {},
  jolt() {},
  vanish() {},
  newspaper() {},
  murmur() {},
  finale() {},
  kneel() {},
  fadeOut() {},
  toll() {},
  crackle() {},
  click() {},
  step() {},
  dispose() {},
};

/** La melodía de la cajita, en notas MIDI: una canción de cuna en menor. */
const LULLABY = [76, 79, 81, 79, 76, 72, 74, 76, 74, 71, 72, 74, 72, 69, 71, 68];

/**
 * La de cuando se acaba la luz: una rueda de chicos en menor, con la sensible arriba. Se va
 * quedando sin cuerda a medida que avanza, y no llega a terminar.
 */
const NURSERY = [69, 72, 76, 72, 69, 68, 69, 71, 72, 71, 69, 67, 69, 64, 65, 64];

/**
 * El vals del diario, en notas MIDI y de a tres tiempos: una melodía de feria en mayor que
 * no termina de resolver. Cero es un silencio.
 */
const WALTZ = [72, 76, 79, 84, 0, 83, 81, 0, 77, 79, 0, 76, 74, 0, 71, 72, 0, 0, 72, 76, 79, 84, 0, 86, 85, 0, 81, 79, 0, 75, 74, 0, 71, 72, 0, 0];
/** El bajo, uno por compás. */
const WALTZ_BASS = [48, 43, 45, 40, 41, 43, 48, 48, 48, 43, 49, 45, 41, 43, 48, 48];

/** Los acordes del final, de a cuatro notas: menor, bajando de a medio tono. */
const FINALE = [
  [45, 52, 57, 60],
  [44, 51, 56, 59],
  [41, 48, 53, 57],
  [40, 47, 52, 56],
];

export function createNightSound(): NightSound {
  const ac = nightAudio();
  if (!ac) return SILENT;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const now = () => ac.currentTime;

  /* ---------------- la salida: compresor, volumen y eco ---------------- */

  const out = ac.createDynamicsCompressor();
  out.threshold.value = -20;
  out.knee.value = 12;
  out.ratio.value = 5;
  out.attack.value = 0.004;
  out.release.value = 0.3;
  const master = ac.createGain();
  master.gain.value = 0;
  master.gain.setTargetAtTime(0.9, now(), 1.5);
  // Todo pasa por acá: con el susto del Retorcido se cierra, como oír bajo el agua.
  const muffle = ac.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 20000;
  master.connect(muffle);
  muffle.connect(out);
  out.connect(ac.destination);

  // El eco: la respuesta de una sala grande y vacía, tres segundos y medio que se apagan.
  const reverb = ac.createConvolver();
  const length = Math.floor(ac.sampleRate * 3.5);
  const impulse = ac.createBuffer(2, length, ac.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
  }
  reverb.buffer = impulse;
  const wet = ac.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet);
  wet.connect(master);

  const noise = ac.createBuffer(2, ac.sampleRate * 3, ac.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = noise.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  // Ruido "marrón": más grave y más parecido al retumbo de un trueno o al viento.
  const brown = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  {
    const data = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  }

  const running: AudioScheduledSourceNode[] = [];

  function source(buffer: AudioBuffer, loop = false) {
    const node = ac!.createBufferSource();
    node.buffer = buffer;
    node.loop = loop;
    return node;
  }
  function osc(type: OscillatorType, frequency: number) {
    const node = ac!.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    return node;
  }
  function filter(type: BiquadFilterType, frequency: number, q = 0.7) {
    const node = ac!.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }
  function gain(value = 0) {
    const node = ac!.createGain();
    node.gain.value = value;
    return node;
  }

  /**
   * La salida de un sonido: de qué lado, qué tan fuerte según la distancia y cuánto eco.
   * Lo lejano tiene más eco y menos agudos, como en un pasillo.
   */
  function exit(place: Place = HERE, send = 0.3): AudioNode {
    const panner = ac!.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, place.pan));
    const level = gain(0.25 + place.near * 0.75);
    const tone = filter("lowpass", 1500 + place.near * 14000);
    tone.connect(level);
    level.connect(panner);
    panner.connect(master);
    const echo = gain(send + (1 - place.near) * 0.5);
    panner.connect(echo);
    echo.connect(reverb);
    return tone;
  }

  /** Conecta en fila. El último puede ser un parámetro, para modular algo con otro sonido. */
  function chain(...nodes: (AudioNode | AudioParam)[]) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i] as AudioNode;
      const to = nodes[i + 1];
      if (to instanceof AudioParam) from.connect(to);
      else from.connect(to);
    }
  }

  function envelope(node: GainNode, at: number, peak: number, attack: number, hold: number, release: number) {
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(peak, at + attack);
    node.gain.setValueAtTime(peak, at + attack + hold);
    node.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  }

  function once(node: AudioScheduledSourceNode, at: number, duration: number) {
    node.start(at);
    node.stop(at + duration);
  }

  /* ---------------- lo que suena siempre ---------------- */

  // La lluvia: un colchón agudo y otro grave, y las gotas sueltas sobre el vidrio (en tick).
  const rainHigh = gain(0.03);
  const rainLow = gain(0.035);
  const rainA = source(noise, true);
  const rainB = source(brown, true);
  chain(rainA, filter("highpass", 1200), filter("lowpass", 8000), rainHigh, master);
  chain(rainB, filter("lowpass", 500), rainLow, master);
  rainA.start(0, Math.random() * 2);
  rainB.start(0, Math.random() * 2);
  running.push(rainA, rainB);

  // El viento: ruido por un filtro angosto que va y viene, como un aullido lejano.
  const windBand = filter("bandpass", 420, 9);
  const windGain = gain(0.05);
  const wind = source(brown, true);
  chain(wind, windBand, windGain, master);
  windGain.connect(reverb);
  wind.start();
  running.push(wind);
  const windSweep = osc("sine", 0.06);
  const windDepth = gain(220);
  chain(windSweep, windDepth, windBand.frequency);
  windSweep.start();
  running.push(windSweep);

  // El zumbido: dos graves a medio tono (el intervalo más incómodo), un sub que se siente
  // más de lo que se oye y un pitido agudo, casi un acúfeno, que aparece con la tensión.
  const droneFilter = filter("lowpass", 160, 2);
  const droneGain = gain(0.05);
  chain(droneFilter, droneGain, master);
  droneGain.connect(reverb);
  for (const frequency of [55, 58.27]) {
    const o = osc("sawtooth", frequency);
    o.connect(droneFilter);
    o.start();
    running.push(o);
  }
  const sub = osc("sine", 34);
  const subGain = gain(0.07);
  chain(sub, subGain, master);
  sub.start();
  running.push(sub);
  const droneWobble = osc("sine", 0.09);
  const droneWobbleDepth = gain(60);
  chain(droneWobble, droneWobbleDepth, droneFilter.frequency);
  droneWobble.start();
  running.push(droneWobble);
  const ringGain = gain(0);
  chain(ringGain, master);
  ringGain.connect(reverb);
  for (const frequency of [1318, 1396]) {
    const o = osc("sine", frequency);
    o.connect(ringGain);
    o.start();
    running.push(o);
  }

  // El zumbido de la instalación eléctrica: está siempre, y solo se nota cuando se corta.
  const humGain = gain(0.018);
  chain(humGain, filter("lowpass", 400), master);
  for (const frequency of [50, 100, 150]) {
    const o = osc("sine", frequency);
    const g = gain(frequency === 50 ? 1 : 0.4);
    chain(o, g, humGain);
    o.start();
    running.push(o);
  }

  // La estática de las cámaras.
  const staticGain = gain(0);
  const staticSource = source(noise, true);
  chain(staticSource, filter("highpass", 1500), staticGain, master);
  staticSource.start();
  running.push(staticSource);

  /* ---------------- los sonidos sueltos ---------------- */

  function thump(at: number, level: number, frequency = 55) {
    const o = osc("sine", frequency * 1.6);
    o.frequency.setValueAtTime(frequency * 1.6, at);
    o.frequency.exponentialRampToValueAtTime(frequency, at + 0.12);
    const g = gain();
    chain(o, g, master);
    envelope(g, at, level, 0.008, 0.02, 0.22);
    once(o, at, 0.35);
  }

  /** Madera que se queja: un roce a saltos pasado por las resonancias de una puerta. */
  function creak(place?: Place, duration = 1.6) {
    const t = now();
    const grain = osc("sawtooth", 38);
    for (let i = 1; i < 24; i++) grain.frequency.setValueAtTime(30 + Math.random() * 55, t + (i * duration) / 24);
    const g = gain();
    const target = exit(place, 0.45);
    for (const [frequency, q] of [
      [620, 14],
      [1180, 16],
      [2350, 18],
    ]) {
      const band = filter("bandpass", frequency, q);
      band.frequency.setValueAtTime(frequency, t);
      band.frequency.linearRampToValueAtTime(frequency * (1.1 + Math.random() * 0.25), t + duration);
      chain(g, band, target);
    }
    grain.connect(g);
    envelope(g, t, 0.9, 0.2, duration - 0.5, 0.3);
    once(grain, t, duration + 0.1);
  }

  function slam(place?: Place) {
    const t = now();
    const hit = source(brown);
    const g = gain();
    chain(hit, filter("lowpass", 700), g, exit(place, 0.6));
    envelope(g, t, 1.2, 0.003, 0.02, 0.5);
    once(hit, t, 0.7);
    const o = osc("sine", 110);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const og = gain();
    chain(o, og, exit(place, 0.4));
    envelope(og, t, 0.7, 0.003, 0.02, 0.4);
    once(o, t, 0.5);
    const latch = source(noise);
    const lg = gain();
    chain(latch, filter("bandpass", 3200, 3), lg, exit(place, 0.3));
    envelope(lg, t + 0.02, 0.25, 0.002, 0.01, 0.06);
    once(latch, t, 0.2);
  }

  /** Susurros: ruido por dos formantes que se mueven como sílabas, sin palabras. */
  function whisper(place?: Place, duration = 2.2) {
    const t = now();
    const breath = source(noise);
    const g = gain();
    const target = exit(place, 0.5);
    for (const base of [700, 1900]) {
      const band = filter("bandpass", base, 6);
      for (let i = 0; i < 14; i++) band.frequency.setValueAtTime(base * (0.7 + Math.random() * 0.7), t + (i * duration) / 14);
      chain(breath, band, g);
    }
    g.connect(target);
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 10; i++) g.gain.setTargetAtTime(Math.random() < 0.3 ? 0.02 : 0.18 + Math.random() * 0.12, t + (i * duration) / 10, 0.04);
    g.gain.setTargetAtTime(0.0001, t + duration, 0.1);
    once(breath, t, duration + 0.5);
  }

  function knocks(place: Place) {
    const t = now();
    for (let i = 0; i < 3; i++) {
      const at = t + i * (0.28 + Math.random() * 0.08);
      const hit = source(brown);
      const g = gain();
      chain(hit, filter("lowpass", 500), g, exit(place, 0.7));
      envelope(g, at, 0.7, 0.003, 0.01, 0.18);
      once(hit, at, 0.3);
    }
  }

  /** Un quejido metálico lejano: una chapa o una cañería que se estira. */
  function groan(place: Place) {
    const t = now();
    const o = osc("sawtooth", 70 + Math.random() * 40);
    o.frequency.linearRampToValueAtTime(40 + Math.random() * 30, t + 3);
    const g = gain();
    chain(o, filter("bandpass", 380, 10), g, exit(place, 0.9));
    envelope(g, t, 0.4, 0.8, 1.2, 1.2);
    once(o, t, 3.3);
  }

  /* ---------------- lo que se programa solo ---------------- */

  let tension = 0;
  let heartbeat = 0;
  let nextBeat = 0;
  let nextDrop = 0;
  let nextEvent = now() + 8;
  let box: number | null = null;
  let nextNote = 0;
  let noteIndex = 0;
  let outside = false;
  /** Después de fadeOut: el edificio queda en silencio y ya no vuelve nada de lo de fondo. */
  let faded = false;

  function randomPlace(): Place {
    return { pan: Math.random() * 2 - 1, near: 0.15 + Math.random() * 0.35 };
  }

  function tick() {
    if (faded) return;
    const t = now();
    // Las gotas grandes sobre el techo de vidrio.
    while (nextDrop < t + 0.1) {
      nextDrop = Math.max(nextDrop, t) + 0.03 + Math.random() * (outside ? 0.04 : 0.12);
      const drop = source(noise);
      const g = gain();
      chain(drop, filter("bandpass", 2500 + Math.random() * 4000, 12), g, exit({ pan: Math.random() * 2 - 1, near: 0.5 }, 0.2));
      envelope(g, nextDrop, 0.05 + Math.random() * 0.08, 0.001, 0, 0.03);
      once(drop, nextDrop, 0.06);
    }
    // Algo lejos, cada tanto: más seguido cuanto más tensa está la noche.
    if (t > nextEvent) {
      nextEvent = t + 10 + Math.random() * (30 - tension * 18);
      const roll = Math.random();
      if (roll < 0.35) creak(randomPlace(), 1.2 + Math.random());
      else if (roll < 0.55) knocks(randomPlace());
      else if (roll < 0.8) groan(randomPlace());
      else whisper(randomPlace(), 1.5);
    }
    // El latido: dos golpes graves, cada vez más seguidos.
    if (heartbeat > 0 && t > nextBeat) {
      const period = 60 / heartbeat;
      nextBeat = t + period;
      thump(t, 0.55, 48);
      thump(t + period * 0.28, 0.4, 44);
    }
    // La cajita: una nota por vez, con eco. Desafinada y lenta cuando se está por acabar.
    if (box !== null && t > nextNote - 0.05) {
      const worn = 1 - box;
      const at = Math.max(t, nextNote);
      nextNote = at + 0.32 + worn * 0.35;
      const note = LULLABY[noteIndex++ % LULLABY.length];
      const frequency = 440 * 2 ** ((note - 69) / 12) * (1 + (Math.random() - 0.5) * worn * 0.06);
      const pan = Math.sin(noteIndex * 0.7) * 0.3;
      for (const [ratio, level] of [
        [1, 0.1],
        [3.01, 0.025],
        [5.4, 0.012],
      ]) {
        const o = osc("sine", frequency * ratio);
        const g = gain();
        chain(o, g, exit({ pan, near: 0.35 }, 0.6));
        envelope(g, at, level, 0.003, 0, 0.9);
        once(o, at, 1);
      }
    }
  }

  return {
    tick,

    setTension(level) {
      if (faded) return;
      tension = Math.max(0, Math.min(1, level));
      const t = now();
      droneGain.gain.setTargetAtTime(0.05 + tension * 0.07, t, 1.5);
      droneFilter.frequency.setTargetAtTime(150 + tension * 250, t, 1.5);
      ringGain.gain.setTargetAtTime(tension > 0.4 ? (tension - 0.4) * 0.012 : 0, t, 2);
      windGain.gain.setTargetAtTime((outside ? 0.11 : 0.05) + tension * 0.03, t, 1.5);
    },

    setHeartbeat(bpm) {
      if (bpm > 0 && heartbeat === 0) nextBeat = now();
      heartbeat = bpm;
    },

    setMusicBox(level) {
      if (level !== null && box === null) nextNote = now();
      box = level;
    },

    setOutside(isOutside) {
      outside = isOutside;
      const t = now();
      rainHigh.gain.setTargetAtTime(outside ? 0.09 : 0.03, t, 0.4);
      rainLow.gain.setTargetAtTime(outside ? 0.08 : 0.035, t, 0.4);
      windGain.gain.setTargetAtTime((outside ? 0.11 : 0.05) + tension * 0.03, t, 0.6);
    },

    setPower(on) {
      humGain.gain.setTargetAtTime(on ? 0.018 : 0, now(), on ? 0.6 : 0.05);
    },

    setStatic(on) {
      staticGain.gain.setTargetAtTime(on ? 0.05 : 0, now(), 0.05);
    },

    thunder(strength) {
      const t = now();
      const level = 0.35 + strength * 0.65;
      if (strength > 0.55) {
        const crack = source(noise);
        const g = gain();
        chain(crack, filter("highpass", 1500), g, exit({ pan: -0.3, near: 1 }, 0.8));
        envelope(g, t, level * 0.5, 0.002, 0.05, 0.5);
        once(crack, t, 0.7);
      }
      // Tres capas de retumbo que se pisan y se van cerrando, con mucho eco.
      for (let layer = 0; layer < 3; layer++) {
        const at = t + layer * (0.15 + Math.random() * 0.3);
        const rumble = source(brown, true);
        const low = filter("lowpass", 700);
        low.frequency.setValueAtTime(700 - layer * 150, at);
        low.frequency.exponentialRampToValueAtTime(70, at + 4);
        const g = gain();
        chain(rumble, low, g, exit({ pan: (Math.random() - 0.5) * 1.2, near: 0.8 }, 0.9));
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(level * (1 - layer * 0.2), at + 0.1);
        for (let i = 1; i < 10; i++) g.gain.setTargetAtTime(level * (0.25 + Math.random() * 0.6) * (1 - i / 11), at + i * 0.45, 0.18);
        g.gain.setTargetAtTime(0.0001, at + 4.6, 0.5);
        rumble.start(at, Math.random() * 2);
        rumble.stop(at + 7);
      }
    },

    creak,
    slam,
    whisper,

    glassKnock(place) {
      const t = now();
      for (let i = 0; i < 3; i++) {
        const at = t + i * (0.22 + Math.random() * 0.08);
        const tap = source(noise);
        const g = gain();
        chain(tap, filter("bandpass", 2600 + Math.random() * 600, 4), g, exit(place, 0.5));
        envelope(g, at, 0.5, 0.001, 0.005, 0.07);
        once(tap, at, 0.12);
        const ring = osc("sine", 1900 + Math.random() * 300);
        const rg = gain();
        chain(ring, rg, exit(place, 0.5));
        envelope(rg, at, 0.06, 0.001, 0, 0.25);
        once(ring, at, 0.3);
      }
    },

    growl(place) {
      const t = now();
      const rasp = source(brown);
      const band = filter("bandpass", 170, 3);
      const g = gain();
      chain(rasp, band, g, exit(place, 0.5));
      // Una vibración rápida, como cuerdas vocales que no deberían estar.
      const flutter = osc("square", 23);
      const depth = gain(0.5);
      const tremolo = gain(0.5);
      chain(flutter, depth, tremolo.gain);
      g.connect(tremolo);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.6, t + 0.6);
      g.gain.setValueAtTime(1.6, t + 1.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      band.frequency.linearRampToValueAtTime(120, t + 2.6);
      once(rasp, t, 2.8);
      once(flutter, t, 2.8);
    },

    /** Alguien apareció: un golpe grave que viene de lejos y un soplido que crece al revés. */
    appear(place) {
      const t = now();
      const swell = source(noise);
      const g = gain();
      chain(swell, filter("bandpass", 900, 1.5), g, exit(place, 0.8));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.18);
      once(swell, t, 1.3);
      const boom = osc("sine", 90);
      boom.frequency.setValueAtTime(90, t + 1.1);
      boom.frequency.exponentialRampToValueAtTime(30, t + 2.4);
      const bg = gain();
      chain(boom, bg, exit(place, 0.9));
      envelope(bg, t + 1.1, 0.9, 0.01, 0.1, 1.8);
      once(boom, t + 1.1, 2.5);
    },

    /** Alguien salió: cuerdas desafinadas que suben en un chirrido, como en las películas. */
    screech() {
      const t = now();
      const g = gain();
      chain(g, filter("highpass", 400), exit(HERE, 0.7));
      envelope(g, t, 0.28, 0.6, 0.5, 0.6);
      for (let i = 0; i < 5; i++) {
        const o = osc("sawtooth", 880 * 2 ** (i / 12 / 2) + Math.random() * 12);
        o.frequency.linearRampToValueAtTime(o.frequency.value * 1.08, t + 1.6);
        const vib = osc("sine", 6 + Math.random() * 3);
        const depth = gain(9);
        chain(vib, depth, o.frequency);
        o.connect(g);
        once(o, t, 1.8);
        once(vib, t, 1.8);
      }
    },

    scream() {
      const t = now();
      // El golpe del susto: grave, seco y fuerte.
      const hit = osc("sine", 120);
      hit.frequency.exponentialRampToValueAtTime(35, t + 0.5);
      const hg = gain();
      chain(hit, hg, master);
      envelope(hg, t, 1.4, 0.003, 0.05, 0.5);
      once(hit, t, 0.7);
      // El alarido: voces desafinadas con un temblor rápido, distorsionadas y con formantes.
      const shaper = ac.createWaveShaper();
      const curve = new Float32Array(2048);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 6);
      shaper.curve = curve;
      const g = gain();
      const target = exit(HERE, 0.5);
      for (const [frequency, q] of [
        [900, 3],
        [1500, 4],
        [2800, 5],
      ]) {
        const band = filter("bandpass", frequency, q);
        band.frequency.linearRampToValueAtTime(frequency * 1.3, t + 1.2);
        chain(shaper, band, g);
      }
      g.connect(target);
      envelope(g, t, 1.1, 0.02, 1.0, 0.5);
      for (const base of [310, 415, 620, 830]) {
        const o = osc("sawtooth", base);
        o.frequency.exponentialRampToValueAtTime(base * 1.9, t + 1.3);
        const wobble = osc("sine", 24 + Math.random() * 14);
        const depth = gain(base * 0.18);
        chain(wobble, depth, o.frequency);
        o.connect(shaper);
        once(o, t, 1.6);
        once(wobble, t, 1.6);
      }
      const hiss = source(noise);
      const hs = gain();
      chain(hiss, filter("highpass", 3000), hs, target);
      envelope(hs, t, 0.3, 0.01, 1, 0.4);
      once(hiss, t, 1.6);
    },

    footsteps(place) {
      const t = now();
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        // Cada vez un poco más fuertes: vienen para acá.
        const at = t + i * (0.5 + Math.random() * 0.08);
        const hit = source(brown);
        const g = gain();
        chain(hit, filter("lowpass", 240 + Math.random() * 60), g, exit(place, 0.5));
        envelope(g, at, 0.35 + i * 0.12, 0.004, 0.02, 0.16);
        once(hit, at, 0.25);
        const scuff = source(noise);
        const sg = gain();
        chain(scuff, filter("bandpass", 1800, 2), sg, exit(place, 0.5));
        envelope(sg, at + 0.03, 0.03 + i * 0.01, 0.01, 0.03, 0.08);
        once(scuff, at, 0.2);
      }
    },

    breath(place) {
      const t = now();
      const air = source(noise);
      const band = filter("bandpass", 600, 1.2);
      const g = gain();
      chain(air, band, filter("lowpass", 2200), g, exit(place, 0.15));
      // Entra despacio y sale ronca, con un temblor.
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.02, t + 1.35);
      g.gain.exponentialRampToValueAtTime(0.3, t + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      band.frequency.setValueAtTime(900, t);
      band.frequency.linearRampToValueAtTime(1300, t + 1.1);
      band.frequency.setValueAtTime(500, t + 1.4);
      band.frequency.linearRampToValueAtTime(350, t + 3);
      const rattle = osc("square", 31);
      const depth = gain(0.35);
      chain(rattle, depth, g.gain);
      once(air, t, 3.2);
      once(rattle, t + 1.35, 1.7);
    },

    dread() {
      const t = now();
      thump(t, 1.3, 38);
      thump(t + 0.02, 0.9, 70);
      // Un pitido agudo que tapa todo y se va muy de a poco.
      const ring = osc("sine", 5400);
      const rg = gain();
      chain(ring, rg, master);
      envelope(rg, t, 0.035, 0.01, 1.5, 5);
      once(ring, t, 7);
      muffle.frequency.cancelScheduledValues(t);
      muffle.frequency.setValueAtTime(20000, t);
      muffle.frequency.exponentialRampToValueAtTime(320, t + 0.08);
      muffle.frequency.setValueAtTime(320, t + 2.5);
      muffle.frequency.exponentialRampToValueAtTime(20000, t + 8);
    },

    itsMe() {
      const t = now();
      // La estática de fondo, a golpes.
      const hiss = source(noise);
      const hg = gain();
      chain(hiss, filter("highpass", 900), hg, master);
      for (let i = 0; i < 18; i++) hg.gain.setValueAtTime(Math.random() < 0.5 ? 0.02 : 0.14, t + i * 0.15);
      hg.gain.setValueAtTime(0.0001, t + 2.8);
      once(hiss, t, 2.9);
      // La voz: grave, rota y con formantes que dicen, más o menos, "it's me". Dos veces,
      // la segunda más grave y más cerca.
      const shaper = ac.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 4);
      shaper.curve = curve;
      for (const [start, pitch, level] of [
        [0.25, 92, 0.9],
        [1.45, 68, 1.2],
      ]) {
        const at = t + start;
        const voice = osc("sawtooth", pitch);
        voice.frequency.setValueAtTime(pitch * 1.1, at);
        voice.frequency.linearRampToValueAtTime(pitch * 0.8, at + 0.9);
        const vg = gain();
        voice.connect(shaper);
        const f1 = filter("bandpass", 320, 6);
        const f2 = filter("bandpass", 2300, 9);
        shaper.connect(f1);
        shaper.connect(f2);
        f1.connect(vg);
        f2.connect(vg);
        vg.connect(exit({ pan: 0, near: 1 }, 0.6));
        // "i" corta, un corte, "ts" soplado, y "miii" larga con la boca cerrada al principio.
        vg.gain.setValueAtTime(0.0001, at);
        vg.gain.exponentialRampToValueAtTime(level * 0.5, at + 0.04);
        vg.gain.setValueAtTime(0.0001, at + 0.14);
        vg.gain.setValueAtTime(0.0001, at + 0.3);
        vg.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.36);
        vg.gain.setValueAtTime(level * 0.35, at + 0.44);
        vg.gain.exponentialRampToValueAtTime(level, at + 0.52);
        vg.gain.setValueAtTime(level, at + 0.85);
        vg.gain.exponentialRampToValueAtTime(0.0001, at + 1.05);
        f2.frequency.setValueAtTime(900, at + 0.3);
        f2.frequency.linearRampToValueAtTime(2500, at + 0.5);
        once(voice, at, 1.1);
        const ts = source(noise);
        const tg = gain();
        chain(ts, filter("highpass", 4500), tg, exit({ pan: 0, near: 1 }, 0.3));
        envelope(tg, at + 0.15, level * 0.3, 0.01, 0.08, 0.05);
        once(ts, at + 0.15, 0.3);
      }
      thump(t, 1, 45);
    },

    twisted(place) {
      const t = now();
      // Crujidos: chasquidos secos y graves, en ráfagas desparejas, como nudillos o vértebras.
      const cracks = 4 + Math.floor(Math.random() * 5);
      let at = t;
      for (let i = 0; i < cracks; i++) {
        at += 0.03 + Math.random() * (i % 3 === 2 ? 0.25 : 0.07);
        const snap = source(noise);
        const g = gain();
        chain(snap, filter("bandpass", 900 + Math.random() * 1400, 5), g, exit(place, 0.35));
        envelope(g, at, 0.5 + Math.random() * 0.4, 0.001, 0.004, 0.03);
        once(snap, at, 0.06);
        const body = source(brown);
        const bg = gain();
        chain(body, filter("lowpass", 300), bg, exit(place, 0.35));
        envelope(bg, at, 0.35, 0.002, 0.01, 0.06);
        once(body, at, 0.1);
      }
      // El gemido: una voz grave con la boca cerrada, que baja y tiembla, casi un zumbido.
      const moanAt = t + 0.2 + Math.random() * 0.4;
      const moan = osc("sawtooth", 62 + Math.random() * 10);
      moan.frequency.linearRampToValueAtTime(44, moanAt + 2.2);
      const shake = osc("sine", 7 + Math.random() * 3);
      const depth = gain(4);
      chain(shake, depth, moan.frequency);
      const mg = gain();
      chain(moan, filter("bandpass", 420, 4), filter("lowpass", 900), mg, exit(place, 0.5));
      envelope(mg, moanAt, 0.55, 0.5, 0.9, 0.8);
      once(moan, moanAt, 2.4);
      once(shake, moanAt, 2.4);
    },

    charge() {
      const t = now();
      thump(t, 0.5, 70);
      const o = osc("sawtooth", 140);
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 2.8);
      const g = gain();
      chain(o, filter("lowpass", 900, 6), g, exit(HERE, 0.2));
      envelope(g, t, 0.06, 0.2, 2.2, 0.5);
      once(o, t, 3.1);
    },

    nursery() {
      const t = now();
      // Un grave que no se va en toda la canción y que la vuelve otra cosa.
      const bed = osc("sine", 41.2);
      const bg = gain();
      chain(bed, bg, master);
      envelope(bg, t, 0.16, 1.5, 4.5, 2);
      once(bed, t, 8.5);
      // La melodía, en campanitas: cada nota un poco más lenta y más baja que la anterior.
      let at = t + 0.35;
      NURSERY.forEach((note, i) => {
        const worn = i / (NURSERY.length - 1);
        const frequency = 440 * 2 ** ((note - 69) / 12) * (1 - worn * 0.045);
        for (const [ratio, level] of [
          [1, 0.13],
          [2.01, 0.05],
          [4.03, 0.018],
          [6.4, 0.009],
        ]) {
          const o = osc("sine", frequency * ratio);
          const g = gain();
          chain(o, g, exit({ pan: Math.sin(i * 1.1) * 0.35, near: 0.6 }, 0.7));
          envelope(g, at, level, 0.004, 0, 1.1);
          once(o, at, 1.3);
        }
        at += 0.4 + worn * 0.22;
      });
    },

    jolt(place) {
      const t = now();
      thump(t, 1.1, 48);
      const shaper = ac.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 9);
      shaper.curve = curve;
      const g = gain();
      chain(shaper, filter("bandpass", 1700, 2), g, exit(place, 0.4));
      envelope(g, t, 0.6, 0.005, 0.55, 0.12);
      for (const base of [180, 187, 395]) {
        const o = osc("sawtooth", base);
        o.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.7);
        const wobble = osc("square", 31 + Math.random() * 9);
        const depth = gain(base * 0.4);
        chain(wobble, depth, o.frequency);
        o.connect(shaper);
        once(o, t, 0.8);
        once(wobble, t, 0.8);
      }
      const hiss = source(noise);
      const hg = gain();
      chain(hiss, filter("highpass", 2500), hg, exit(place, 0.4));
      envelope(hg, t, 0.25, 0.003, 0.5, 0.1);
      once(hiss, t, 0.75);
    },

    vanish(place) {
      const t = now();
      // Un soplido al revés: crece y se corta de golpe, como algo que se traga el aire.
      const air = source(noise);
      const band = filter("bandpass", 500, 3);
      band.frequency.setValueAtTime(300, t);
      band.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
      const g = gain();
      chain(air, band, g, exit(place, 0.8));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.9);
      g.gain.setValueAtTime(0.0001, t + 0.92);
      once(air, t, 1);
      const low = osc("sine", 90);
      low.frequency.setValueAtTime(90, t);
      low.frequency.exponentialRampToValueAtTime(30, t + 0.9);
      const lg = gain();
      chain(low, lg, exit(place, 0.6));
      envelope(lg, t, 0.3, 0.8, 0, 0.05);
      once(low, t, 1);
      thump(t + 0.93, 0.9, 40);
    },

    newspaper() {
      const t = now() + 0.3;
      const beat = 0.34;
      const note = (midi: number, at: number, level: number, pan: number, decay: number) => {
        // Un poco más bajo de lo que debería, y cada vez un poco más: la cajita está gastada.
        const frequency = 440 * 2 ** ((midi - 69) / 12) * (1 - (at - t) * 0.0004);
        for (const [ratio, amount] of [
          [1, level],
          [3.01, level * 0.25],
          [5.2, level * 0.08],
        ]) {
          const o = osc("sine", frequency * ratio);
          const g = gain();
          chain(o, g, exit({ pan, near: 0.8 }, 0.35));
          envelope(g, at, amount, 0.003, 0, decay);
          once(o, at, decay + 0.1);
        }
      };
      const round = WALTZ.length * beat;
      for (let r = 0; r < 3; r++) {
        const start = t + r * round;
        WALTZ.forEach((midi, i) => {
          if (midi) note(midi, start + i * beat, 0.07, 0.25, 0.9);
        });
        // El bajo en el primer tiempo y el acorde en los otros dos, como un organito.
        const barLength = round / WALTZ_BASS.length;
        WALTZ_BASS.forEach((midi, b) => {
          const at = start + b * barLength;
          note(midi, at, 0.06, -0.25, 0.7);
          note(midi + 16, at + barLength / 3, 0.022, -0.1, 0.35);
          note(midi + 19, at + (barLength * 2) / 3, 0.022, -0.1, 0.35);
        });
      }
    },

    murmur(seconds) {
      const t = now();
      const shaper = ac.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 3);
      shaper.curve = curve;
      const voice = osc("sawtooth", 58);
      voice.frequency.setValueAtTime(64, t);
      voice.frequency.linearRampToValueAtTime(49, t + seconds);
      const f1 = filter("bandpass", 380, 5);
      const f2 = filter("bandpass", 1100, 7);
      // Las "sílabas": los formantes se mueven a saltos, como si dijera algo con la boca cerrada.
      for (let at = 0; at < seconds; at += 0.16 + Math.random() * 0.14) {
        f1.frequency.setTargetAtTime(280 + Math.random() * 300, t + at, 0.04);
        f2.frequency.setTargetAtTime(800 + Math.random() * 1200, t + at, 0.04);
      }
      const g = gain();
      chain(voice, shaper);
      shaper.connect(f1);
      shaper.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(exit(HERE, 0.8));
      envelope(g, t, 0.4, 0.15, Math.max(0.1, seconds - 0.6), 0.45);
      once(voice, t, seconds + 0.1);
    },

    finale() {
      const t = now() + 0.2;
      const chord = 3.6;
      FINALE.forEach((notes, i) => {
        const at = t + i * chord;
        for (const midi of notes) {
          const frequency = 440 * 2 ** ((midi - 69) / 12);
          // Un coro: tres voces apenas desafinadas por nota, con la vocal "o" de los formantes.
          const g = gain();
          chain(g, filter("bandpass", 500, 1.5), filter("lowpass", 1800), exit({ pan: (midi % 5) / 5 - 0.4, near: 0.7 }, 0.9));
          envelope(g, at, 0.05, 1.2, chord - 1.6, 1.6);
          for (const detune of [-7, 0, 6]) {
            const o = osc("sawtooth", frequency);
            o.detune.value = detune;
            o.connect(g);
            once(o, at, chord + 1.2);
          }
        }
        // Una campana grave al empezar cada acorde.
        for (const [ratio, level, decay] of [
          [1, 0.2, 4],
          [2.76, 0.07, 2.5],
          [5.4, 0.035, 1.5],
        ]) {
          const o = osc("sine", 440 * 2 ** ((notes[0] - 12 - 69) / 12) * ratio);
          const g = gain();
          chain(o, g, exit({ pan: 0, near: 0.6 }, 1));
          envelope(g, at, level, 0.005, 0, decay);
          once(o, at, decay + 0.2);
        }
      });
      const bed = osc("sine", 36.7);
      const bg = gain();
      chain(bed, bg, master);
      envelope(bg, t, 0.18, 2, FINALE.length * chord - 2, 3);
      once(bed, t, FINALE.length * chord + 3.5);
    },

    kneel() {
      const t = now();
      thump(t, 1.2, 36);
      const dust = source(brown);
      const g = gain();
      chain(dust, filter("lowpass", 500), g, exit(HERE, 0.8));
      envelope(g, t, 0.35, 0.01, 0.1, 0.6);
      once(dust, t, 0.9);
    },

    fadeOut(seconds) {
      faded = true;
      heartbeat = 0;
      box = null;
      const t = now();
      for (const level of [rainHigh, rainLow, windGain, droneGain, subGain, ringGain, humGain]) {
        level.gain.cancelScheduledValues(t);
        level.gain.setTargetAtTime(0, t, seconds / 3);
      }
    },

    /** Un reloj de péndulo lejano: una campana grave con parciales desafinados. */
    toll(times) {
      for (let i = 0; i < times; i++) {
        const at = now() + i * 2.2;
        for (const [ratio, level, decay] of [
          [1, 0.22, 5],
          [2.76, 0.08, 3],
          [5.4, 0.05, 2],
          [8.93, 0.025, 1.2],
        ]) {
          const o = osc("sine", 98 * ratio);
          const g = gain();
          chain(o, g, exit({ pan: 0.4, near: 0.4 }, 1));
          envelope(g, at, level, 0.005, 0, decay);
          once(o, at, decay + 0.2);
        }
      }
    },

    crackle() {
      const t = now();
      const burst = source(noise);
      const g = gain();
      chain(burst, filter("highpass", 1200), g, master);
      envelope(g, t, 0.14, 0.003, 0.05, 0.12);
      once(burst, t, 0.3);
    },

    click() {
      const t = now();
      const o = osc("square", 1400);
      const g = gain();
      chain(o, filter("lowpass", 3000), g, master);
      envelope(g, t, 0.05, 0.002, 0, 0.04);
      once(o, t, 0.07);
    },

    step() {
      const t = now();
      const hit = source(brown);
      const g = gain();
      chain(hit, filter("lowpass", 260 + Math.random() * 80), g, exit(HERE, 0.25));
      envelope(g, t, 0.35, 0.004, 0.01, 0.12);
      once(hit, t, 0.2);
    },

    dispose() {
      master.gain.setTargetAtTime(0, now(), 0.08);
      setTimeout(() => {
        for (const node of running) {
          try {
            node.stop();
          } catch {
            // Ya estaba parado.
          }
        }
        master.disconnect();
        muffle.disconnect();
        out.disconnect();
      }, 400);
    },
  };
}
