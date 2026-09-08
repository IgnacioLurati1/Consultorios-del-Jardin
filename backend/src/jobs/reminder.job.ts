import cron from "node-cron";
import { AppointmentService } from "../appointments/appointments.service.js";
import { orm } from "../shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeReminderJob(): Promise<void> {
  const em = orm.em.fork();
  const appointmentService = new AppointmentService();

  return RequestContext.create(em, async () => {
    try {
      // Primero el del profesional, que es uno por cabeza y no depende de los mails: si
      // el correo se cae, el renglón de "mañana tenés catorce turnos" tiene que salir
      // igual. Se puede llamar todas las horas, que anota una sola vez por día.
      await appointmentService
        .notifyTomorrowToProfessionals()
        .catch((error) => console.error("Error avisándole a los profesionales de su día de mañana:", error));

      const appointments = await appointmentService.getAppointmentsForReminder();

      if (appointments.length === 0) {
        return;
      }

      for (const appointment of appointments) {
        try {
          await appointmentService.sendReminderEmails(appointment);
          await appointmentService.updateReminderStatus(appointment.numAppointment!);
          await delay(3000);
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error crítico en cron job:`, error);
    }
  });
}

export async function startReminderJob() {
  console.log(`[${new Date().toISOString()}] Cron job de recordatorios inicializado (cada hora)`);

  // Ejecutar inmediatamente al iniciar (para debugging)
  console.log(`[${new Date().toISOString()}] Ejecución inmediata del job de recordatorios...`);
  await executeReminderJob();

  // Luego programar para ejecutarse cada hora
  cron.schedule("0 * * * *", async () => {
    await executeReminderJob();
  });
}
