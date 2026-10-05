import crypto from "node:crypto";
import cron from "node-cron";
import { orm } from "../db/orm.js";
import { JobRun } from "./jobRun.entity.js";

/**
 * Cómo se programa una tarea, en un solo lugar.
 *
 * Las diez tareas hacían lo mismo escrito diez veces: un log, una corrida inmediata al
 * arrancar y un `cron.schedule`. Tenía dos problemas.
 *
 * El primero es la corrida inmediata. Cada reinicio del servidor mandaba los recordatorios,
 * cerraba y cobraba turnos, creaba las cuotas del mes y borraba definitivamente cuentas
 * vencidas. Un despliegue, un reinicio de la plataforma o una caída se volvían una tanda de
 * efectos reales que nadie pidió. Ahora al arrancar no corre nada, salvo que se diga
 * (`JOBS_RUN_ON_BOOT`, que es lo que se quiere mientras se desarrolla). El cron igual pasa
 * dentro de poco; para la tarea más lenta de todas, una semana.
 *
 * El segundo es que no había candado. Con dos instancias del mismo proceso, todo salía
 * dos veces. Ver JobRun.
 */

/** Quién es este proceso, para el registro. Se arma una vez y no se repite entre arranques. */
const INSTANCE = crypto.randomBytes(6).toString("hex");

/** Cuánto se guardan las filas del candado. Dos semanas alcanza para mirar qué pasó. */
const KEPT_DAYS = 14;

/**
 * Las tareas que este proceso programó, con su frecuencia.
 *
 * Lo lee la ruta de salud (ver health/) para saber qué buscar en job_run y cuándo una
 * tarea está atrasada. Sale de acá y no de una lista aparte para que una tarea nueva
 * aparezca sola: una lista escrita a mano se desactualiza sin que nadie se entere.
 */
const scheduled: { name: string; everyMinutes: number }[] = [];

export function scheduledJobs(): { name: string; everyMinutes: number }[] {
  return scheduled.map((job) => ({ ...job }));
}

export interface JobOptions {
  /** Nombre corto y estable. Es parte de la clave del candado, así que no se cambia a la ligera. */
  name: string;
  /** La expresión de cron, como siempre. */
  cron: string;
  /**
   * Cada cuánto corre, en minutos.
   *
   * Define la ventana del candado, y tiene que coincidir con la expresión de arriba: una
   * tarea de cada cinco minutos con una ventana de sesenta corre una vez por hora. Se pasa
   * a mano y no se deduce de la expresión a propósito, porque deducirlo mal es silencioso.
   */
  everyMinutes: number;
  /** Lo que se escribe en el log al programarla. */
  label: string;
  /** El trabajo. Recibe por qué está corriendo, nada más que para el registro. */
  run: (reason: "arranque" | "programado") => Promise<void>;
}

/** En qué ventana cae este momento. Son tramos de la línea de tiempo, no días del calendario. */
function windowOf(everyMinutes: number, now = new Date()): number {
  return Math.floor(now.getTime() / (Math.max(1, everyMinutes) * 60 * 1000));
}

function runsOnBoot(): boolean {
  const flag = (process.env.JOBS_RUN_ON_BOOT ?? "").trim();
  if (flag) return flag === "1" || flag.toLowerCase() === "true";

  // Sin decir nada: mientras se desarrolla sí, porque es la única forma cómoda de ver una
  // tarea andar. Desplegado no, que es el caso que importa.
  return process.env.NODE_ENV !== "production";
}

/**
 * Se queda con esta vuelta, o avisa que ya la tiene otro.
 *
 * Ante una falla que no es el choque de clave —la base no contesta, por ejemplo— devuelve
 * que sí. Es deliberado: dejar de mandar los recordatorios de todo un día porque la tabla
 * del candado no respondió es peor que el riesgo de mandar alguno dos veces.
 */
async function claim(name: string, everyMinutes: number): Promise<boolean> {
  const key = `${name}:${windowOf(everyMinutes)}`;
  const em = orm.em.fork();

  try {
    await em.insert(JobRun, { key, startedAt: new Date(), instance: INSTANCE });
  } catch (error: any) {
    const duplicada =
      error?.code === "ER_DUP_ENTRY" || (typeof error?.message === "string" && error.message.includes("Duplicate entry"));

    if (duplicada) return false;

    console.error(`No se pudo tomar el candado de ${name}, corre igual:`, error?.message ?? error);
    return true;
  }

  // Barrido de las viejas. Va acá y no en una tarea aparte porque es una consulta por
  // vuelta y así no hay una tarea más que pueda dejar de correr sin que nadie mire.
  try {
    const limite = new Date(Date.now() - KEPT_DAYS * 24 * 60 * 60 * 1000);
    await em.nativeDelete(JobRun, { startedAt: { $lt: limite } });
  } catch {
    // Que queden filas viejas no rompe nada.
  }

  return true;
}

export async function scheduleJob(options: JobOptions): Promise<void> {
  const { name, everyMinutes, label, run } = options;

  // Antes de cualquier await: así queda anotada aunque la corrida de arranque tarde.
  if (!scheduled.some((job) => job.name === name)) scheduled.push({ name, everyMinutes });

  console.log(`[${new Date().toISOString()}] ${label}`);

  const vuelta = async (reason: "arranque" | "programado") => {
    if (!(await claim(name, everyMinutes))) return;

    try {
      await run(reason);
    } catch (error) {
      // Una tarea que se cae no puede tumbar el proceso ni callarse. Las demás siguen.
      console.error(`[${new Date().toISOString()}] Falló la tarea ${name} (${reason}):`, error);
    }
  };

  if (runsOnBoot()) {
    console.log(`[${new Date().toISOString()}] ${name}: corrida de arranque`);
    await vuelta("arranque");
  }

  cron.schedule(options.cron, () => void vuelta("programado"));
}
