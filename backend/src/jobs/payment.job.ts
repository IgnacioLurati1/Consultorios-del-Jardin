import cron from "node-cron";
import { RequestContext } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Person } from "../people/people.entity.js";
import { startOfDay, toISODate } from "../shared/dates.js";

/** El instante exacto en que terminó un turno: su día más su hora de fin. */
function endOf(appointment: Appointment): Date {
  const [hours, minutes] = appointment.finalHour.split(":").map(Number);
  const day = startOfDay(appointment.date);
  day.setHours(hours, minutes, 0, 0);
  return day;
}

/**
 * Da por cobrados los turnos que ya pasaron, para quien cobra siempre en el momento.
 *
 * En un consultorio donde se paga al salir, registrar cada cobro es escribir dos veces lo
 * mismo: lo único que importa es la excepción, el que quedó debiendo. Con esto la
 * excepción es lo único que hay que marcar a mano.
 *
 * Dos recaudos que son la razón de que esto sea un job y no una línea al cerrar el turno:
 *
 * 1. Solo toca lo que está en "unpaid". Un pago parcial ya registrado es información que
 *    alguien cargó mirando la plata, y darlo por saldado la borraría.
 * 2. Solo desde que se prendió el switch (`autoPaySince`). Prenderlo no puede dar por
 *    cobrada la agenda vieja, que es justamente donde puede haber deuda de verdad.
 *
 * Corre en el mismo pulso que el cierre automático porque contesta la misma pregunta —qué
 * turnos ya terminaron— y porque con los dos prendidos conviene que el turno quede cerrado
 * y cobrado en la misma pasada, y no cobrado un rato antes de figurar como atendido.
 */
async function payFinishedAppointments(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const professionals = await em.find(Person, { type: "professional", autoPay: true });
      if (professionals.length === 0) return;

      const now = new Date();
      const today = startOfDay(now);
      const nowHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      let paid = 0;

      for (const professional of professionals) {
        const since = professional.autoPaySince ?? new Date();

        // Los de días anteriores están vencidos para las dos opciones. El día de hoy solo
        // entra si se cobra turno por turno: "al final del día" quiere decir que hoy
        // todavía no se toca.
        const candidates = await em.find(Appointment, {
          professional: { email: professional.email },
          state: "assisted",
          paymentState: "unpaid",
          patient: { $ne: null },
          date: { $lt: today, $gte: startOfDay(since) },
        });

        if (professional.autoPayWhen === "appointment") {
          const finishedToday = await em.find(Appointment, {
            professional: { email: professional.email },
            state: "assisted",
            paymentState: "unpaid",
            patient: { $ne: null },
            date: today,
          });

          // "HH:MM" comparado como texto ordena igual que el reloj.
          candidates.push(...finishedToday.filter((appointment) => appointment.finalHour <= nowHour));
        }

        // El corte fino: el día en que se prendió el switch conviven turnos de la mañana
        // (anteriores) y de la tarde (posteriores), y el filtro por día no los separa.
        const due = candidates.filter((appointment) => endOf(appointment) > since);

        for (const appointment of due) {
          appointment.paymentState = "paid";
          appointment.paidAmount = null;
        }

        paid += due.length;
      }

      if (paid > 0) {
        await em.flush();
        console.log(`[${toISODate(now)}] ${paid} turnos dados por cobrados automáticamente`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error dando turnos por cobrados:`, error);
    }
  });
}

export async function startPaymentJob() {
  console.log(`[${new Date().toISOString()}] Cron job de cobro automático de turnos inicializado (cada 5 minutos)`);

  await payFinishedAppointments();

  cron.schedule("*/5 * * * *", async () => {
    await payFinishedAppointments();
  });
}
