import api from "../../axios";
import type { Person } from "../types";

/** Datos mínimos para dar de alta un paciente sin cuenta (ni contraseña). */
export interface AnonymousPatientInput {
  email: string;
  name: string;
  surname: string;
  docType?: string;
  docNumber?: string;
  phoneNumber?: string;
}

function backendError(err: any): never {
  const backendMsg = err.response?.data?.message || err.message;
  throw new Error(backendMsg);
}

/**
 * Los pacientes del profesional logueado: los que alguna vez tuvieron turno con el. Un
 * turno cancelado no cuenta como vinculo, asi que alguien cuyo unico turno se dio de
 * baja no figura.
 */
export function findMyPatients(): Promise<Person[]> {
  return api
    .get("/appointments/my-patients")
    .then((response) => response.data.data)
    .catch(backendError);
}

// Se usa la variante "active" porque /people/type/:tipo es solo para admin,
// y esta pantalla la usa el profesional.
export function findAllPatients(): Promise<Person[]> {
  return api
    .get("/people/type/active/client")
    .then((response) => response.data.data)
    .catch(backendError);
}

/**
 * Las direcciones a las que no les llegan los mails.
 *
 * `missing` es la casilla que no existe, según lo que contestó el servidor del otro lado.
 * `blocked` es la que existe y aun así no recibe, por ejemplo llena o dada de baja. Son
 * dos problemas distintos y se muestran distinto: el primero se arregla corrigiendo el
 * correo y el segundo no.
 *
 * Si falla, lista vacía: la marca es un extra sobre el listado y quedarse sin ella no
 * impide hacer nada.
 */
export type BounceKind = "missing" | "blocked";

export function findBouncedEmails(): Promise<Array<{ email: string; kind: BounceKind }>> {
  return api
    .get("/people/bounced")
    .then((response) => (response.data.data ?? []) as Array<{ email: string; kind: BounceKind }>)
    .catch(() => []);
}

/**
 * `alreadyLoaded` dice que ese email ya lo había cargado otro profesional: no se creó nada,
 * y desde ahora este también lo ve, con los datos que cargó el otro.
 */
export interface CreatedPatient {
  patient: Person;
  alreadyLoaded: boolean;
}

export function createAnonymousPatient(data: AnonymousPatientInput): Promise<CreatedPatient> {
  return api
    .post("/people/anonymous", data)
    .then((response) => ({ patient: response.data.data, alreadyLoaded: response.data.alreadyLoaded === true }))
    .catch(backendError);
}

/**
 * Corrige el correo de un paciente sin cuenta.
 *
 * El correo es su clave en la base, así que el servidor crea la ficha con la dirección
 * nueva y le lleva todo lo que tenía la vieja. Lo puede hacer quien lo cargó.
 */
export function changePatientEmail(email: string, newEmail: string): Promise<Person> {
  return api
    .patch(`/people/${encodeURIComponent(email)}/email`, { email: newEmail })
    .then((response) => response.data.data as Person)
    .catch(backendError);
}

/**
 * Deshace el alta de un paciente sin cuenta.
 *
 * El backend solo lo deja si lo cargó este mismo profesional y todavía no tiene ningún
 * turno. No es una baja: es para el que se cargó sin querer o con el mail mal escrito.
 */
export function deleteAnonymousPatient(email: string, force = false): Promise<void> {
  return api
    .delete(`/people/anonymous/${encodeURIComponent(email)}${force ? "?force=1" : ""}`)
    .then(() => undefined)
    .catch((err) => {
      // El código distingue "no se puede" de "tiene turnos y hay que decirlo de nuevo".
      const backendMsg = err.response?.data?.message || err.message;
      throw Object.assign(new Error(backendMsg), { code: err.response?.data?.code });
    });
}

/**
 * Corrige los datos de un paciente sin cuenta. El backend solo lo permite sobre pacientes
 * sin cuenta cargados por este mismo profesional: en cuanto la persona se registra, sus
 * datos pasan a ser suyos.
 */
export function updatePatient(email: string, data: Omit<AnonymousPatientInput, "email">): Promise<Person> {
  return api
    .patch(`/people/${encodeURIComponent(email)}`, data)
    .then((response) => response.data.data)
    .catch(backendError);
}
