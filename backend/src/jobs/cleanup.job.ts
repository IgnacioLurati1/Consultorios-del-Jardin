import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { purgeDisabledAccounts } from "../people/accountCleanup.js";

/**
 * Borra las cuentas que llevan tres semanas deshabilitadas.
 *
 * La regla y el orden de borrado están en accountCleanup.ts. Acá solo está cuándo corre.
 *
 * Una vez por semana, los lunes de madrugada. Es una limpieza sin apuro y cada corrida se
 * paga: la cuenta que cumplió su fecha un martes se borra el lunes siguiente, y para lo que
 * esto hace, esos días no cambian nada. Correr también al arrancar es lo que hace que un
 * lunes con el servidor caído no le regale una semana a nadie.
 */
async function limpiar(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const { deleted, stamped } = await purgeDisabledAccounts(em);

      if (deleted.length > 0) {
        console.log(`[${new Date().toISOString()}] ${deleted.length} cuentas deshabilitadas borradas: ${deleted.join(", ")}`);
      }
      if (stamped > 0) {
        console.log(`[${new Date().toISOString()}] ${stamped} cuentas deshabilitadas sin fecha, contando desde hoy`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error borrando las cuentas deshabilitadas:`, error);
    }
  });
}

export async function startAccountCleanupJob() {
  console.log(`[${new Date().toISOString()}] Cron job de baja de cuentas deshabilitadas inicializado (una vez por semana)`);

  await limpiar();

  cron.schedule("45 4 * * 1", async () => {
    await limpiar();
  });
}
