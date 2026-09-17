import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { syncBounces } from "../people/mailBounces.js";

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

export async function startMailBounceJob() {
  console.log(`[${new Date().toISOString()}] Cron job de correos rebotados inicializado (una vez por hora)`);

  await revisar();

  cron.schedule("25 * * * *", async () => {
    await revisar();
  });
}
