import { EntityManager } from "@mikro-orm/core";
import { Person } from "./people.entity.js";
import { PatientAccess } from "./patientAccess.entity.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { Recurrence } from "../recurrences/recurrences.entity.js";
import { WaitlistEntry } from "../waitlist/waitlist.entity.js";
import { WaitlistUsage } from "../waitlist/waitlistUsage.entity.js";
import { Notification } from "../notifications/notification.entity.js";

/**
 * Cambiarle el correo a un paciente sin cuenta.
 *
 * El correo es la clave de la persona en la base, así que esto no es editar un campo: es
 * crear la ficha con la dirección nueva, llevarle todo lo que tenía la vieja y borrar la
 * vieja. Es el borrado en cascada al revés (ver accountCleanup), con las mismas tablas.
 *
 * Existe por un caso concreto y bastante común: el correo se carga mal, rebota, y para
 * cuando alguien se entera esa persona ya tiene turnos. Sin esto la ficha quedaba trabada
 * para siempre, porque el correo no se podía corregir y la ficha no se podía borrar.
 *
 * Solo sirve para pacientes sin cuenta. Quien tiene cuenta propia entra con ese correo, y
 * cambiárselo desde afuera sería sacarle la llave de su casa.
 */
export async function movePatientEmail(em: EntityManager, person: Person, newEmail: string): Promise<Person> {
  const from = { patient: { email: person.email } };
  const fromPerson = { person: { email: person.email } };

  return em.transactional(async (tx) => {
    // La ficha nueva primero: lo que cuelga no se puede mover a una persona que todavía
    // no existe.
    //
    // Se copia entera y se le cambia el correo, en vez de nombrar campo por campo. Una
    // columna que se agregue mañana viaja sola; nombrándolos, se quedaría en la ficha
    // vieja sin que nadie se entere.
    const { email: _viejo, ...resto } = { ...person };
    const moved = tx.create(Person, { ...resto, email: newEmail } as any);
    await tx.flush();

    const patient = moved;

    await tx.nativeUpdate(Appointment, from, { patient });
    await tx.nativeUpdate(Recurrence, from, { patient });
    await tx.nativeUpdate(PatientAccess, from, { patient });
    await tx.nativeUpdate(WaitlistEntry, from, { patient });
    await tx.nativeUpdate(WaitlistUsage, fromPerson, { person: patient });
    await tx.nativeUpdate(Notification, fromPerson, { person: patient });

    await tx.nativeDelete(Person, { email: person.email });

    return moved;
  });
}
