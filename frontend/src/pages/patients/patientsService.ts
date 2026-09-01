import api from "../../axios";
import type { Person } from "../types";

/** Datos mínimos para dar de alta un paciente anónimo (sin cuenta ni contraseña). */
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

// Se usa la variante "active" porque /people/type/:tipo es solo para admin,
// y esta pantalla la usa el profesional.
export function findAllPatients(): Promise<Person[]> {
  return api
    .get("/people/type/active/client")
    .then((response) => response.data.data)
    .catch(backendError);
}

export function createAnonymousPatient(data: AnonymousPatientInput): Promise<Person> {
  return api
    .post("/people/anonymous", data)
    .then((response) => response.data.data)
    .catch(backendError);
}

/**
 * Corrige los datos de un paciente anónimo. El backend solo lo permite sobre pacientes
 * sin cuenta cargados por este mismo profesional: en cuanto la persona se registra, sus
 * datos pasan a ser suyos.
 */
export function updatePatient(email: string, data: Omit<AnonymousPatientInput, "email">): Promise<Person> {
  return api
    .patch(`/people/${encodeURIComponent(email)}`, data)
    .then((response) => response.data.data)
    .catch(backendError);
}
