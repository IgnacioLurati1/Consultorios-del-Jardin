import { promises as dns } from "node:dns";
import { badRequest } from "./errors.js";

/**
 * ¿La casilla que se está cargando puede recibir mails?
 *
 * Se usa cuando alguien carga el mail de otro: el profesional que da de alta a un paciente
 * sin cuenta y el administrador que da de alta a un profesional. Quien se registra solo no
 * pasa por acá, porque ya prueba que el mail existe al abrir el link que le llega.
 *
 * Lo que se mira es el dominio, no la casilla. Preguntarle al servidor si existe el
 * usuario no se puede hacer de verdad —casi ninguno contesta, y los que contestan mienten
 * a propósito— así que lo que corta acá es lo que pasa en la vida real: el dominio mal
 * escrito ("gmial.com", "gmail.con") y el inventado. Una casilla que no existe adentro de
 * un dominio que sí existe pasa igual, y de eso se entera el que manda el mail.
 *
 * Nunca frena por un problema de red. Si el DNS no contesta, el alta sigue: dejar a un
 * consultorio sin poder cargar un paciente porque falló una consulta es peor que aceptar
 * un mail dudoso.
 */

/** Formato. Más estricto que el del registro: acá el mail se escribe para que llegue. */
const SYNTAX = /^[^\s@,;]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** Los dominios de casi todos los mails que se cargan acá. Sirven para sugerir el correcto. */
const COMMON = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.ar",
  "outlook.com",
  "outlook.com.ar",
  "live.com",
  "live.com.ar",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
];

/** Cuánto vale lo que ya se preguntó. El DNS cambia poco y el alta de a dos o tres mails es seguida. */
const CACHE_OK = 24 * 60 * 60 * 1000;
const CACHE_BAD = 10 * 60 * 1000;

/** Cuánto se espera al DNS. Pasado eso, el alta sigue sin la comprobación. */
const TIMEOUT_MS = 4000;

const cache = new Map<string, { exists: boolean; at: number }>();

/** Distancia de edición, para darse cuenta de que "gmial.com" quiso ser "gmail.com". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }

  return row[b.length];
}

/** El dominio conocido más parecido, si hay uno a un par de letras de distancia. */
function suggest(domain: string): string | null {
  let best: { domain: string; far: number } | null = null;

  for (const known of COMMON) {
    const far = distance(domain, known);
    if (far > 0 && far <= 2 && (!best || far < best.far)) best = { domain: known, far };
  }

  return best?.domain ?? null;
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS_TIMEOUT")), TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Los códigos con los que el DNS dice "ese nombre no existe". El resto no dice nada. */
const NO_EXISTE = ["ENOTFOUND", "ENODATA", "NXDOMAIN"];

/**
 * ¿Hay alguien del otro lado de ese dominio?
 *
 * Tres intentos, del más específico al más burdo. Primero los servidores de correo, que es
 * lo que se quiere saber. Después el dominio a secas, porque uno sin servidores propios
 * todavía puede recibir mails en su propia dirección. Y al final la consulta del sistema
 * operativo, que va por otro camino: las dos primeras hablan UDP contra el servidor de
 * nombres y hay redes donde eso está cerrado, y ahí la comprobación se volvía un adorno
 * que dejaba pasar todo.
 *
 * En null queda lo que no se pudo averiguar, y eso deja seguir el alta.
 */
async function domainReceivesMail(domain: string): Promise<boolean | null> {
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.at < (cached.exists ? CACHE_OK : CACHE_BAD)) return cached.exists;

  const remember = (exists: boolean) => {
    cache.set(domain, { exists, at: Date.now() });
    return exists;
  };

  let missing = false;

  const attempts: Array<() => Promise<unknown>> = [
    () => dns.resolveMx(domain),
    () => dns.resolve(domain),
    () => dns.lookup(domain),
  ];

  for (const ask of attempts) {
    try {
      const answer = await withTimeout(ask());
      if (!Array.isArray(answer) || answer.length > 0) return remember(true);
    } catch (error: any) {
      // Un nombre que no existe se contesta rápido y con nombre propio. Cualquier otra cosa
      // —el servidor de nombres caído, la red del servidor— no dice nada del mail.
      if (NO_EXISTE.includes(error?.code)) missing = true;
    }
  }

  return missing ? remember(false) : null;
}

/**
 * Deja pasar el mail o lo frena con el motivo escrito para mostrar en pantalla.
 *
 * Devuelve el mail normalizado, que es lo que hay que guardar.
 */
export async function assertDeliverableEmail(value: unknown): Promise<string> {
  const email = String(value ?? "").trim().toLowerCase();

  if (!SYNTAX.test(email)) throw badRequest("El email no tiene un formato válido");

  const domain = email.slice(email.lastIndexOf("@") + 1);
  const exists = await domainReceivesMail(domain);

  if (exists === false) {
    const alternative = suggest(domain);
    throw badRequest(
      alternative
        ? `Ese correo no existe. Puede ser ${email.slice(0, email.lastIndexOf("@"))}@${alternative}`
        : "Ese correo no existe. Revisá que esté bien escrito"
    );
  }

  return email;
}

/** Para los tests: la comprobación se acuerda de lo que ya preguntó. */
export function clearEmailCache(): void {
  cache.clear();
}
