import { orm } from "../shared/db/orm.js";
import { JobRun } from "../shared/jobs/jobRun.entity.js";
import { scheduledJobs } from "../shared/jobs/schedule.js";

/**
 * El estado del servidor, para mirarlo desde afuera.
 *
 * Lo leen el control del dueño (una tarea de GitHub cada media hora) y la consola, desde
 * el navegador, sin sesión. Por eso lo que devuelve está contado uno por uno y no se arma
 * a partir de nada que pueda crecer solo: ni variables de entorno, ni conteos de personas
 * o turnos, ni mensajes de error de la base, que a veces traen el host o el usuario.
 *
 * Lo que sí dice:
 *  - si el proceso contesta (que conteste ya lo dice),
 *  - qué versión del código corre, para confirmar un deploy sin iniciar sesión,
 *  - si la base responde a una consulta trivial,
 *  - y cuándo corrió por última vez cada tarea programada, y si está atrasada.
 */

export interface JobHealth {
  name: string;
  /** Cuándo tomó su última vuelta, en ISO. `null` si no hay ninguna en las dos semanas que se guardan. */
  lastRun: string | null;
  late: boolean;
}

export interface HealthReport {
  ok: boolean;
  time: string;
  version: string | null;
  db: "ok" | "error";
  /** `null` si no se pudo leer el registro de tareas (con la base caída, por ejemplo). */
  jobs: JobHealth[] | null;
}

/** Cuánto se espera a la base antes de darla por caída. Un health check que cuelga no sirve. */
const DB_TIMEOUT_MS = 3000;

/**
 * Cuánto se reutiliza una medición.
 *
 * La ruta es pública, y sin esto cada request es una consulta a la base por tarea. Con
 * quince segundos, la base ve como mucho unas pocas consultas por minuto, venga de donde
 * venga el tráfico; el limitador por dirección no alcanza para eso, porque se reparte.
 */
const CACHE_MS = 15_000;

/** El commit que publicó la plataforma, corto. Railway lo deja en esa variable en cada deploy. */
export function shortVersion(): string | null {
  const sha = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "").trim();
  // Solo hexadecimal: si alguien carga otra cosa en la variable, no sale por acá.
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : null;
}

/**
 * Cuánto margen se le da a una tarea antes de llamarla atrasada.
 *
 * La mitad de su período, y nunca menos de diez minutos. Una tarea de cada cinco minutos
 * que se salteó una vuelta todavía no es un problema; una de cada día que lleva un día y
 * medio sin correr, sí.
 */
export function lateAfterMinutes(everyMinutes: number): number {
  return everyMinutes + Math.max(everyMinutes / 2, 10);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tiempo agotado")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

interface Options {
  now?: Date;
  /** Cuánto lleva vivo el proceso, en segundos. Se pasa en las pruebas. */
  uptimeSeconds?: number;
  timeoutMs?: number;
}

/** La medición en sí, sin caché. */
export async function measureHealth(options: Options = {}): Promise<HealthReport> {
  const now = options.now ?? new Date();
  const uptimeMinutes = (options.uptimeSeconds ?? process.uptime()) / 60;
  const timeoutMs = options.timeoutMs ?? DB_TIMEOUT_MS;
  const em = orm.em.fork();

  let db: HealthReport["db"] = "ok";
  try {
    await withTimeout(em.getConnection().execute("select 1"), timeoutMs);
  } catch {
    // El motivo no sale: un error de conexión de la base puede traer el host y el usuario.
    db = "error";
  }

  let jobs: JobHealth[] | null = null;
  if (db === "ok") {
    try {
      jobs = [];
      for (const job of scheduledJobs()) {
        // La clave del candado es `nombre:ventana`, así que la última vuelta de una tarea es
        // la fila más nueva con ese prefijo. Va por la entidad y no por SQL suelto para que
        // la fecha vuelva convertida igual que en el resto del sistema.
        const last = await withTimeout(
          em.findOne(
            JobRun,
            { key: { $like: `${job.name}:%` } },
            { orderBy: { startedAt: "desc" }, fields: ["startedAt"] }
          ),
          timeoutMs
        );

        const lastRun = last?.startedAt ? new Date(last.startedAt) : null;
        const limite = lateAfterMinutes(job.everyMinutes);
        // Sin ninguna vuelta registrada, la cuenta corre desde que arrancó el proceso: recién
        // desplegado no hay nada y no es un atraso.
        const minutos = lastRun ? (now.getTime() - lastRun.getTime()) / 60_000 : uptimeMinutes;

        jobs.push({ name: job.name, lastRun: lastRun ? lastRun.toISOString() : null, late: minutos > limite });
      }
    } catch {
      jobs = null;
    }
  }

  const late = (jobs ?? []).some((job) => job.late);

  return {
    ok: db === "ok" && jobs !== null && !late,
    time: now.toISOString(),
    version: shortVersion(),
    db,
    jobs,
  };
}

let cached: { at: number; report: HealthReport } | null = null;
let inFlight: Promise<HealthReport> | null = null;

/**
 * La medición con caché.
 *
 * `time` siempre es el de ahora: dice cuándo contestó el servidor, no cuándo midió. Dos
 * pedidos que llegan juntos comparten la misma medición en curso.
 */
export async function getHealth(now = new Date()): Promise<HealthReport> {
  if (cached && now.getTime() - cached.at < CACHE_MS) {
    return { ...cached.report, time: now.toISOString() };
  }

  if (!inFlight) {
    inFlight = measureHealth({ now }).finally(() => {
      inFlight = null;
    });
  }

  const report = await inFlight;
  cached = { at: now.getTime(), report };
  return { ...report, time: now.toISOString() };
}

/** Para las pruebas: que cada una mida de nuevo. */
export function resetHealthCache(): void {
  cached = null;
  inFlight = null;
}
