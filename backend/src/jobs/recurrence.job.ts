import cron from "node-cron";
import { RecurrenceService } from "../recurrences/recurrences.service.js";
import { orm } from "../shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";

/**
 * Mantiene el horizonte de los turnos repetibles: cada día se fija si alguna repetición
 * quedó corta y crea los turnos que falten. Como el horizonte se mide contra la fecha de
 * hoy, al pasar una semana aparece sola la semana siguiente.
 */
async function executeRecurrenceJob(): Promise<void> {
  const em = orm.em.fork();
  const recurrenceService = new RecurrenceService();

  return RequestContext.create(em, async () => {
    try {
      const { recurrences, created } = await recurrenceService.generatePending();
      if (created > 0) {
        console.log(`[${new Date().toISOString()}] Turnos repetibles: ${created} turnos nuevos sobre ${recurrences} repeticiones`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error en el job de turnos repetibles:`, error);
    }
  });
}

export async function startRecurrenceJob() {
  console.log(`[${new Date().toISOString()}] Cron job de turnos repetibles inicializado (cada día a las 03:00)`);

  // Una pasada al arrancar, para que un servidor que estuvo apagado se ponga al día.
  await executeRecurrenceJob();

  cron.schedule("0 3 * * *", async () => {
    await executeRecurrenceJob();
  });
}
