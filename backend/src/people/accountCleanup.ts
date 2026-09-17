import { EntityManager } from "@mikro-orm/core";
import { Person } from "./people.entity.js";
import { PatientAccess } from "./patientAccess.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Denial } from "../appointments/denials.entity.js";
import { Recurrence } from "../recurrences/recurrences.entity.js";
import { Schedule } from "../schedule/schedules.entity.js";
import { Vacation } from "../settings/vacation.entity.js";
import { RentCharge } from "../rent/rentCharge.entity.js";
import { RentExtra } from "../rent/rentExtra.entity.js";
import { RentRate } from "../rent/rentRate.entity.js";
import { WaitlistEntry } from "../waitlist/waitlist.entity.js";
import { WaitlistStat } from "../waitlist/waitlistStat.entity.js";
import { WaitlistUsage } from "../waitlist/waitlistUsage.entity.js";
import { Notification } from "../notifications/notification.entity.js";
import { addDays, endOfMonth, startOfDay } from "../shared/dates.js";

/**
 * Qué pasa con una cuenta deshabilitada.
 *
 * Deshabilitar dejó de ser para siempre. Una cuenta cerrada se borra al cierre de mes,
 * cuando ya lleva tres semanas afuera, con todo lo que tenga colgando. Las tres semanas
 * son para que una baja apurada o equivocada se pueda deshacer, y el cierre de mes para
 * que la fecha se pueda decir de antemano.
 */

/** Cuánto tiene que llevar deshabilitada una cuenta para que le toque. */
export const DISABLED_DAYS = 21;

/**
 * Cuándo se borra una cuenta que se deshabilitó ese día.
 *
 * Es el último día del mes en el que se cumplen las tres semanas, así que una baja de
 * principio de mes se borra a fin de este y una de la segunda quincena, a fin del que
 * viene.
 *
 * La pantalla del administrador hace esta misma cuenta para anunciar la fecha antes de
 * deshabilitar (ver accountDeletion.ts en el front). Si cambia una, cambia la otra.
 */
export function deletionDateFor(bannedAt: Date | string): Date {
  return endOfMonth(addDays(startOfDay(bannedAt), DISABLED_DAYS));
}

/** ¿Ya le tocaba a esta cuenta, mirando el día de hoy? */
export function deletionDue(bannedAt: Date | string, now = new Date()): boolean {
  return startOfDay(now).getTime() >= deletionDateFor(bannedAt).getTime();
}

/**
 * Borra una persona y todo lo que cuelga de ella.
 *
 * El orden es el de las claves foráneas, de las hojas al tronco: los turnos antes que las
 * recurrencias que los agrupan, y todo antes que la persona. Las tablas que ya borran en
 * cascada desde la base —avisos, lista de espera, acceso a pacientes— se borran igual acá,
 * para que el orden esté escrito en un solo lugar y no dependa de cómo quedó el esquema.
 *
 * Va en una transacción: una baja a medias deja turnos de alguien que ya no existe.
 *
 * `createdBy` de los pacientes que había cargado se limpia en vez de borrarlos. Son
 * personas del consultorio, no algo suyo, y siguen teniendo su historial con quien los
 * atendió.
 */
export async function purgeAccount(em: EntityManager, email: string): Promise<void> {
  const professional = { professional: { email } };
  const patient = { patient: { email } };
  const person = { person: { email } };

  await em.transactional(async (tx) => {
    await tx.nativeDelete(Appointment, { $or: [professional, patient] });
    await tx.nativeDelete(Denial, professional);
    await tx.nativeDelete(Recurrence, { $or: [professional, patient] });
    await tx.nativeDelete(Schedule, person);
    await tx.nativeDelete(Vacation, professional);
    await tx.nativeDelete(RentCharge, professional);
    await tx.nativeDelete(RentExtra, professional);
    await tx.nativeDelete(RentRate, professional);
    await tx.nativeDelete(WaitlistEntry, { $or: [professional, patient] });
    await tx.nativeDelete(WaitlistStat, professional);
    await tx.nativeDelete(WaitlistUsage, person);
    await tx.nativeDelete(Notification, person);
    await tx.nativeDelete(PatientAccess, { $or: [professional, patient] });

    await tx.nativeUpdate(Person, { createdBy: email }, { createdBy: null });
    await tx.nativeDelete(Person, { email });
  });
}

/**
 * La limpieza de fin de mes.
 *
 * Borra todo lo que ya pasó su fecha, y no lo que vence hoy. Por eso la corrida es
 * semanal (ver cleanup.job.ts) sin que nadie se salve: lo que cumplió el 31 se borra en la
 * primera corrida posterior, y lo que se saltea una semana se borra a la siguiente.
 *
 * A las cuentas deshabilitadas de antes de que esto existiera no se les sabe la fecha. No
 * se borran a ciegas: se les anota el día de hoy y empiezan a contar desde acá.
 */
export async function purgeDisabledAccounts(em: EntityManager, now = new Date()): Promise<{ deleted: string[]; stamped: number }> {
  const disabled = await em.find(Person, { active: false });

  const deleted: string[] = [];
  let stamped = 0;

  for (const person of disabled) {
    if (!person.bannedAt) {
      person.bannedAt = now;
      stamped += 1;
      continue;
    }

    if (!deletionDue(person.bannedAt, now)) continue;

    await purgeAccount(em, person.email);
    deleted.push(person.email);
  }

  if (stamped > 0) await em.flush();

  return { deleted, stamped };
}
