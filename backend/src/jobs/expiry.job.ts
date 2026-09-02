import cron from "node-cron";
import { AppointmentService } from "../appointments/appointments.service.js";
import { orm } from "../shared/db/orm.js";
import { RequestContext } from "@mikro-orm/core";

/**
 * Da de baja los pedidos de turno que nadie contestó.
 *
 * Un turno pendiente al que se le pasó la hora ya no puede ocurrir. Si queda ahí, ensucia
 * la agenda del profesional y le hace creer al paciente que todavía puede salir.
 *
 * Corre cada hora y no una vez por día porque el vencimiento es de la hora del turno, no
 * del día: un pedido de las nueve de la mañana que sigue sin respuesta al mediodía ya
 * venció, y esperar hasta la medianoche para reconocerlo no ayuda a nadie.
 */
async function expirePending(): Promise<void> {
  const em = orm.em.fork();
  const appointmentService = new AppointmentService();

  return RequestContext.create(em, async () => {
    try {
      const expired = await appointmentService.expirePendingAppointments();
      if (expired > 0) {
        console.log(`[${new Date().toISOString()}] ${expired} pedidos de turno vencidos por falta de respuesta`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error venciendo turnos pendientes:`, error);
    }
  });
}

export async function startExpiryJob() {
  console.log(`[${new Date().toISOString()}] Cron job de vencimiento de pendientes inicializado (cada hora)`);

  await expirePending();

  cron.schedule("15 * * * *", async () => {
    await expirePending();
  });
}
