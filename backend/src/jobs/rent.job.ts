import { scheduleJob } from "../shared/jobs/schedule.js";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { RentService } from "../rent/rent.service.js";
import { policies } from "../installation/installation.service.js";

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
      // Sin alquileres en esta instalación no hay cuotas que preparar.
      if (!(await policies()).rentModule) return;

      const created = await new RentService().ensureMonth();
      if (created > 0) console.log(`[${new Date().toISOString()}] ${created} cuotas de alquiler creadas para el mes`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error creando las cuotas de alquiler:`, error);
    }
  });
}

export async function startRentJob() {
  await scheduleJob({
    name: "alquileres",
    cron: "20 0 * * *",
    everyMinutes: 1440,
    label: "Tarea de cuotas de alquiler programada (una vez por dia)",
    run: async () => {
      await prepare();
    },
  });
}
