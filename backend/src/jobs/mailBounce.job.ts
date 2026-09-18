import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { hasBounced, syncBounces } from "../people/mailBounces.js";

/**
 * Trae del proveedor de correo las direcciones que rebotaron.
 *
 * Una vez por hora. El proveedor anota el rebote alrededor de un minuto después del envío,
 * así que quien cargó mal un mail se entera dentro de la hora, que es cuando todavía se
 * acuerda de a quién estaba cargando. Es una consulta por vuelta y no cuesta nada.
 *
 * La regla y el aviso están en mailBounces.ts. Acá solo está cuándo corre.
 */
async function revisar(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const { added, warned } = await syncBounces(em);
      if (added > 0 || warned > 0) {
        console.log(`[${new Date().toISOString()}] ${added} correos rebotados nuevos, ${warned} avisos mandados`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error revisando los correos rebotados:`, error);
    }
  });
}

/**
 * Cuándo se vuelve a mirar después de escribirle a una dirección recién cargada.
 *
 * El proveedor anota el rebote alrededor de un minuto después del envío, a veces más. Dos
 * miradas cubren los dos casos sin quedarse preguntando: si a los cinco minutos no rebotó,
 * lo que venga lo levanta la vuelta de cada hora.
 */
const SOON_MS = [2 * 60 * 1000, 5 * 60 * 1000];

/**
 * Revisar pronto una dirección a la que se le acaba de escribir por primera vez.
 *
 * Con la vuelta de cada hora sola, quien cargó mal un correo podía enterarse hasta una
 * hora después, cuando ya no tiene al paciente enfrente para preguntarle el bueno. Esto
 * lo adelanta a un par de minutos.
 *
 * Es la misma vuelta de siempre, adelantada: avisa igual y no avisa dos veces. Si en la
 * primera mirada ya quedó marcada, la segunda no pregunta.
 *
 * Los temporizadores no retienen el proceso. Si el servidor se reinicia en el medio, la
 * vuelta de cada hora sigue estando.
 */
export function checkBounceSoon(email: string, delays = SOON_MS): void {
  for (const delay of delays) {
    const timer = setTimeout(async () => {
      const em = orm.em.fork();
      try {
        if (await RequestContext.create(em, () => hasBounced(em, email))) return;
      } catch {
        // Sin poder mirar, se revisa igual: lo peor es una consulta de más.
      }
      await revisar();
    }, delay);
    timer.unref?.();
  }
}

export async function startMailBounceJob() {
  console.log(`[${new Date().toISOString()}] Cron job de correos rebotados inicializado (una vez por hora)`);

  await revisar();

  cron.schedule("25 * * * *", async () => {
    await revisar();
  });
}
