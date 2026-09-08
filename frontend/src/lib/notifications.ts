import { readJsonCookie, writeJsonCookie } from "./cookies";

/**
 * Los avisos de la campanita, guardados en el equipo desde el que se mira.
 *
 * Todo esto vive del lado de la web a propósito. Un aviso no es un dato del consultorio:
 * es la lectura que hace la pantalla de datos que ya venía trayendo igual. Guardarlos en
 * la base sería una tabla más que mantener, más consultas por cada persona que entra y
 * una limpieza periódica, todo para repetir algo que la pantalla puede deducir sola.
 *
 * Cómo lo deduce: cada vez que mira, se guarda una foto de cómo estaban las cosas. La
 * próxima compara y lo que cambió es la novedad. Un turno que pasó de pendiente a
 * confirmado es "te confirmaron el turno"; uno que no estaba y ahora sí, es uno nuevo. La
 * primera vez no avisa nada —no hay con qué comparar, y anunciar los cuarenta turnos que
 * ya existían sería inservible—.
 *
 * Lo que no se puede deducir así queda afuera, y está bien que quede: si alguien confirma
 * y cancela un turno mientras la pestaña está cerrada, se ve el resultado y no las dos
 * cosas. El aviso sirve para enterarse de en qué quedó todo, no para llevar el registro.
 */

export type NotificationTone = "info" | "good" | "warn" | "urgent";

export interface AppNotification {
  /**
   * El mismo hecho siempre da el mismo id. Es lo que impide que un aviso borrado
   * reaparezca y que el mismo cambio se anote dos veces desde dos pestañas.
   */
  id: string;
  title: string;
  body?: string;
  tone: NotificationTone;
  /** Cuándo nos enteramos, en milisegundos. */
  at: number;
  /**
   * A dónde lleva tocarlo. En null cuando el aviso es de algo que ya no está —un turno
   * cancelado, una cuenta cerrada—: llevar hasta una pantalla que va a decir que no
   * existe es peor que no llevar a ningún lado.
   */
  to: string | null;
}

/** Cuánto se guarda. Lo pidió así: tres días y lo viejo se cae solo. */
export const DAYS_KEPT = 3;
const MS_KEPT = DAYS_KEPT * 24 * 60 * 60 * 1000;

/** Tope de avisos guardados, por si un día pasan muchas cosas juntas. */
const MAX_KEPT = 60;

/**
 * Lo guardado de una persona.
 *
 * `foto` es cómo estaban las cosas la última vez que se miró, y hace dos trabajos: contra
 * ella se comparan los cambios, y sirve de memoria de los avisos que se mandan una sola
 * vez (el de "mañana tenés turno", que no responde a ningún cambio sino a la fecha).
 */
interface Stored {
  lista: AppNotification[];
  foto: Record<string, string>;
}

const VACIO: Stored = { lista: [], foto: {} };

/**
 * Por persona, porque en una computadora del consultorio entran varias.
 *
 * Sin esto, el profesional que entra después del que se fue vería los avisos del otro,
 * que además de no servirle es información de pacientes que no son suyos.
 */
function storeKey(email: string): string {
  return `avisos:${email.toLowerCase()}`;
}

function readStore(email: string): Stored {
  try {
    const raw = localStorage.getItem(storeKey(email));
    if (!raw) return VACIO;

    const parsed = JSON.parse(raw);
    return {
      lista: Array.isArray(parsed?.lista) ? parsed.lista : [],
      foto: parsed?.foto && typeof parsed.foto === "object" ? parsed.foto : {},
    };
  } catch {
    // Almacenamiento bloqueado o guardado a medias. Se empieza de cero, que como mucho
    // cuesta perderse los avisos de un rato.
    return VACIO;
  }
}

function writeStore(email: string, store: Stored): void {
  try {
    localStorage.setItem(storeKey(email), JSON.stringify(store));
  } catch {
    // Sin lugar donde guardar, los avisos duran lo que dura la pestaña.
  }
}

/* ---------- el visto ----------
   Va en una cookie y no con el resto porque es lo único de todo esto que es una
   preferencia de la persona y no un dato derivado: la marca de hasta dónde leyó. Es un
   número, así que entra de sobra al lado de las otras. */

const VISTO_COOKIE = "avisos-visto";

/** El mail no entra en el nombre de una cookie, así que entra achicado. */
function huella(email: string): string {
  let hash = 5381;
  for (const letra of email.toLowerCase()) hash = ((hash << 5) + hash + letra.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

/** Hasta cuándo se leyó. Cero cuando nunca se abrió la campana en este equipo. */
export function readSeenMark(email: string): number {
  const todos = readJsonCookie<Record<string, number>>(VISTO_COOKIE, {});
  const valor = todos[huella(email)];
  return typeof valor === "number" ? valor : 0;
}

/**
 * Marca todo como leído hasta ahora. Se llama al abrir la campana.
 *
 * Guarda solo las tres últimas personas: una cookie es chica y en la computadora del
 * consultorio entra gente todo el tiempo. La que se cae vuelve a ver sus avisos como no
 * leídos una vez, que es bastante mejor que romper la cookie por tamaño.
 */
export function markSeen(email: string): void {
  const todos = readJsonCookie<Record<string, number>>(VISTO_COOKIE, {});
  const proximos = { ...todos, [huella(email)]: Date.now() };

  const claves = Object.keys(proximos);
  for (const vieja of claves.slice(0, Math.max(0, claves.length - 3))) delete proximos[vieja];

  writeJsonCookie(VISTO_COOKIE, proximos);
}

/* ---------- lectura ---------- */

/** Lo que hay para mostrar, de lo más nuevo a lo más viejo y sin lo que ya venció. */
export function readNotifications(email: string): AppNotification[] {
  const corte = Date.now() - MS_KEPT;

  return readStore(email)
    .lista.filter((aviso) => aviso.at > corte)
    .sort((a, b) => b.at - a.at);
}

/* ---------- escritura ---------- */

export function dismissNotification(email: string, id: string): void {
  const store = readStore(email);
  writeStore(email, { ...store, lista: store.lista.filter((aviso) => aviso.id !== id) });
}

export function dismissAll(email: string): void {
  writeStore(email, { ...readStore(email), lista: [] });
}

/**
 * Guarda la foto nueva y anota lo que haya cambiado.
 *
 * `emitir` recibe la foto vieja y devuelve los avisos que correspondan; se le pasa la
 * vieja y no se la deja leer sola para que sea una función pura y se pueda probar aparte.
 * Con la foto vieja vacía no emite nada: es la primera vez que se mira.
 *
 * `sinRefrescar` son los prefijos de clave que esta vuelta no se pudieron volver a
 * preguntar porque el servidor no contestó. De esas claves se conserva lo que decía la
 * foto anterior, y ahí está todo el asunto:
 *
 * - Pisarlas con nada dejaba la foto vacía. La vuelta siguiente la leía como la primera
 *   de todas y no emitía nada, así que lo que hubiera pasado en el medio —un turno
 *   confirmado, uno cancelado— no se avisaba nunca. Es lo que hacía antes.
 * - Dejarlas afuera sin conservarlas es peor todavía: la vuelta siguiente ve cada turno
 *   sin huella previa, o sea como recién aparecido, y saldrían de golpe cuarenta avisos
 *   de turnos que la persona ya tenía.
 *
 * Conservándolas, la vuelta que sí ande compara contra la última foto buena y encuentra
 * lo que cambió mientras tanto. Se avisa una vuelta más tarde y no se pierde nada.
 *
 * Devuelve la lista completa que quedó, así quien llama no tiene que volver a leerla.
 */
export function applySnapshot(
  email: string,
  foto: Record<string, string>,
  emitir: (anterior: Record<string, string>) => AppNotification[],
  sinRefrescar: string[] = []
): AppNotification[] {
  const store = readStore(email);
  const primeraVez = Object.keys(store.foto).length === 0;

  // Primera foto de todas y encima incompleta: no se guarda nada. Guardar media foto haría
  // que la próxima vuelta ya no cuente como primera y anuncie como nuevo todo lo que la
  // parte que falló no alcanzó a registrar.
  if (primeraVez && sinRefrescar.length > 0) return readNotifications(email);

  const nuevos = primeraVez ? [] : emitir(store.foto);
  const conocidos = new Set(store.lista.map((aviso) => aviso.id));
  const corte = Date.now() - MS_KEPT;

  const lista = [...store.lista, ...nuevos.filter((aviso) => !conocidos.has(aviso.id))]
    .filter((aviso) => aviso.at > corte)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_KEPT);

  const guardada = { ...foto };
  for (const [clave, valor] of Object.entries(store.foto)) {
    if (sinRefrescar.some((prefijo) => clave.startsWith(prefijo))) guardada[clave] = valor;
  }

  writeStore(email, { lista, foto: guardada });
  return lista;
}

/** Se va con la sesión: los avisos son de quien los recibió, no de la computadora. */
export function forgetNotifications(email: string): void {
  try {
    localStorage.removeItem(storeKey(email));
  } catch {
    // Nada que borrar.
  }
}
