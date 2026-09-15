import type { EntityManager, FilterQuery } from "@mikro-orm/core";
import { orm } from "../shared/db/orm.js";
import type { Person } from "./people.entity.js";
import { PatientAccess } from "./patientAccess.entity.js";
import { notFound } from "../shared/errors.js";

interface Viewer {
  email: string;
  type: string;
}

type Patient = Pick<Person, "email" | "anonymous" | "createdBy">;

/**
 * Los pacientes sin cuenta de otros profesionales que este también ve: los que intentó
 * cargar y ya estaban. Ver PatientAccess.
 */
async function sharedPatientEmails(professionalEmail: string, em: EntityManager = orm.em): Promise<string[]> {
  const rows = await em.find(PatientAccess, { professional: { email: professionalEmail } });
  return rows.map((row) => row.patient.email);
}

/**
 * Quién ve a un paciente sin cuenta.
 *
 * Lo carga un profesional para darle turno a alguien que no se registró, y lo ven ese
 * profesional, la administración y los profesionales con los que se compartió (los que
 * intentaron cargarlo y ya estaba). Los demás no, ni en la lista de pacientes ni para
 * asignarle un turno. En cuanto la persona se registra con ese email deja de ser sin
 * cuenta y la ve todo el consultorio, como a cualquier paciente.
 */
export async function canSeePatient(person: Patient, viewer: Viewer, em: EntityManager = orm.em): Promise<boolean> {
  if (!person.anonymous) return true;
  if (viewer.type === "admin") return true;
  if (viewer.type !== "professional") return false;
  if (person.createdBy === viewer.email) return true;

  const shared = await em.count(PatientAccess, { patient: { email: person.email }, professional: { email: viewer.email } });
  return shared > 0;
}

/** El mismo criterio que `canSeePatient`, escrito como filtro para la base. */
export async function visiblePatientsFilter(viewer: Viewer): Promise<FilterQuery<Person>> {
  if (viewer.type === "admin") return {};

  const shared = viewer.type === "professional" ? await sharedPatientEmails(viewer.email) : [];
  return {
    $or: [{ anonymous: false }, { createdBy: viewer.email }, ...(shared.length ? [{ email: { $in: shared } }] : [])],
  };
}

/**
 * Para las altas de turno: al paciente que no se puede ver tampoco se le puede dar turno.
 *
 * Contesta que no existe, igual que si el email estuviera mal: decir "es de otro
 * profesional" ya es contar que esa persona se atiende acá.
 */
export async function assertCanSeePatient(person: Patient, professionalEmail: string, em?: EntityManager): Promise<void> {
  if (!(await canSeePatient(person, { email: professionalEmail, type: "professional" }, em)))
    throw notFound("No encontramos a ese paciente");
}
