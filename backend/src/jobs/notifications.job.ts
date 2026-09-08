import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { NotificationService } from "../notifications/notifications.service.js";

/**
 * Borra los avisos que ya no se le muestran a nadie.
 *
 * Guardar los avisos en la base trae esto de la mano: una tabla que solo crece termina
 * siendo el problema del año que viene. El corte es el mismo que usa la lectura, así que
 * lo que se borra acá es lo que ya nadie estaba viendo.
 *
 * Una vez por día y de madrugada. No hay ninguna urgencia —lo viejo ya no se muestra, esté
 * o no borrado— y de madrugada no le saca la base a nadie.
 */
async function limpiar(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const borrados = await new NotificationService().cleanup();
      if (borrados > 0) console.log(`[${new Date().toISOString()}] ${borrados} avisos viejos borrados`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error limpiando los avisos viejos:`, error);
    }
  });
}

export async function startNotificationCleanupJob() {
  console.log(`[${new Date().toISOString()}] Cron job de limpieza de avisos inicializado (una vez por día)`);

  await limpiar();

  cron.schedule("30 4 * * *", async () => {
    await limpiar();
  });
}
