import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { WaitlistService } from "../waitlist/waitlist.service.js";

/**
 * La lista de espera, cada noche: borra lo vencido y saca la foto de cuánta gente espera.
 *
 * Al arrancar solo se limpia. La foto va únicamente a la noche para que todas se saquen a
 * la misma hora: una sacada a media mañana por un deploy mediría otra cosa, y como cuenta
 * una por día, la de la noche ya no entraría.
 */
async function run(withSnapshot: boolean): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const service = new WaitlistService();
      const expired = await service.cleanupExpired();
      if (expired > 0) console.log(`[${new Date().toISOString()}] ${expired} lugares vencidos en listas de espera`);

      if (withSnapshot) await service.snapshot();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error manteniendo las listas de espera:`, error);
    }
  });
}

export async function startWaitlistJob() {
  console.log(`[${new Date().toISOString()}] Cron job de listas de espera inicializado (una vez por día)`);

  await run(false);

  cron.schedule("55 23 * * *", async () => {
    await run(true);
  });
}
