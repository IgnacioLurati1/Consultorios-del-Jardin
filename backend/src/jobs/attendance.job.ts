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
 * Cierra los turnos que ya pasaron, para quien pidió que se cierren solos.
 *
 * Un turno confirmado queda en "accepted" hasta que alguien dice si la persona vino o
 * no. El que atiende doce turnos por día no vuelve a la pantalla a marcarlos uno por
 * uno, así que la agenda de la semana pasada queda entera sin cerrar y los números del
 * mes salen vacíos. Esto lo cierra con el estado que el profesional eligió.
 *
 * Se espera a la hora de fin y no a la de inicio a propósito: durante el turno todavía
 * puede pasar cualquier cosa, y marcar "no vino" a los cinco minutos de empezado sería
 * mentira la mitad de las veces.
 *
 * Corre cada cinco minutos porque la opción "al terminar el turno" se toma en serio: con
 * el cron por hora, un turno que termina a las 10:05 se cerraría a las 11 y el profesional
 * lo vería sin cerrar justo cuando va a mirar.
 */
async function closeFinishedAppointments(): Promise<void> {
  const em = orm.em.fork();

  return RequestContext.create(em, async () => {
    try {
      const professionals = await em.find(Person, { type: "professional", autoMark: { $ne: null } });
      if (professionals.length === 0) return;

      const now = new Date();
      const today = startOfDay(now);
      const nowHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      let closed = 0;

      for (const professional of professionals) {
        // Nada anterior a haber prendido el switch: la agenda vieja sin cerrar se marca
        // a mano o se queda como está, pero no la reescribe una preferencia de hoy.
        const since = professional.autoMarkSince ?? new Date();

        // Los turnos de días anteriores están vencidos para las dos opciones. El día de
        // hoy solo entra si se cierra turno por turno: "al final del día" quiere decir
        // que hoy todavía no se toca.
        const candidates = await em.find(Appointment, {
          professional: { email: professional.email },
          state: "accepted",
          patient: { $ne: null },
          date: { $lt: today, $gte: startOfDay(since) },
        });

        if (professional.autoMarkWhen === "appointment") {
          const finishedToday = await em.find(Appointment, {
            professional: { email: professional.email },
            state: "accepted",
            patient: { $ne: null },
            date: today,
          });

          // La hora es un "HH:MM" y se compara como texto, que para este formato ordena
          // igual que el reloj.
          candidates.push(...finishedToday.filter((appointment) => appointment.finalHour <= nowHour));
        }

        // El corte fino: el turno se cierra solo si terminó después de que se prendió.
        // El filtro por día de arriba no alcanza para el día en que se prendió, donde
        // conviven turnos de la mañana (anteriores) y de la tarde (posteriores).
        const due = candidates.filter((appointment) => endOf(appointment) > since);

        for (const appointment of due) appointment.state = professional.autoMark!;

        closed += due.length;
      }

      if (closed > 0) {
        await em.flush();
        console.log(`[${toISODate(now)}] ${closed} turnos cerrados automáticamente`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error cerrando turnos automáticamente:`, error);
    }
  });
}

export async function startAttendanceJob() {
  console.log(`[${new Date().toISOString()}] Cron job de cierre automático de turnos inicializado (cada 5 minutos)`);

  await closeFinishedAppointments();

  cron.schedule("*/5 * * * *", async () => {
    await closeFinishedAppointments();
  });
}
