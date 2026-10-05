import { scheduleJob } from "../shared/jobs/schedule.js";
import { AppointmentService } from "../appointments/appointments.service.js";
import { orm } from "../shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";
import { policies } from "../installation/installation.service.js";

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

      // Con los recordatorios apagados no sale ninguno. El aviso de arriba, al profesional,
      // sigue: es otro mail y no le promete nada al paciente.
      if (!(await policies()).reminders) return;

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
  await scheduleJob({
    name: "recordatorios",
    cron: "0 * * * *",
    everyMinutes: 60,
    label: "Tarea de recordatorios programada (cada hora)",
    run: async () => {
      await executeReminderJob();
    },
  });
}
