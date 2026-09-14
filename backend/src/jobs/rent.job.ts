import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { RentService } from "../rent/rent.service.js";

/**
 * Deja creadas las cuotas de alquiler del mes.
 *
 * La cuota de un mes se fija con la agenda y los precios del día en que se crea, así que
 * conviene que se cree apenas empieza el mes y no el día que alguien abra la pantalla. Corre
 * todas las noches y no solo el día 1: si el servidor estaba caído esa noche, la próxima
 * vuelta completa lo que falte. Lo que ya existe no se toca.
 */
async function prepare(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const created = await new RentService().ensureMonth();
      if (created > 0) console.log(`[${new Date().toISOString()}] ${created} cuotas de alquiler creadas para el mes`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creando las cuotas de alquiler:`, error);
    }
  });
}

export async function startRentJob() {
  console.log(`[${new Date().toISOString()}] Cron job de cuotas de alquiler inicializado (una vez por día)`);

  await prepare();

  cron.schedule("20 0 * * *", async () => {
    await prepare();
  });
}
