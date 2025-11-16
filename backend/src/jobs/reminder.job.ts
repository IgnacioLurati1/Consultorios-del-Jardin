import cron from "node-cron";
import { AppointmentService } from "../appointments/appointments.service.js";

const appointmentService = new AppointmentService();

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startReminderJob() {
  cron.schedule("0 * * * *", async () => {
    try {
      const appointments = await appointmentService.getAppointmentsForReminder();

      if (appointments.length === 0) {
        return;
      }

      for (const appointment of appointments) {
        try {
          await appointmentService.sendReminderEmails(appointment);
          await appointmentService.updateReminderStatus(appointment.numAppointment!);
          await delay(3000);
        } catch {
          continue;
        }
      }
    } catch {
      // Silenciar errores críticos
    }
  });
}
