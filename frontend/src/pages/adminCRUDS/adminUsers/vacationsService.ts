import api from "../../../axios";
import type { VacationPeriod } from "../../../components/vacations/VacationsModal";

/**
 * Las vacaciones de un profesional, desde la administración. Solo andan si la regla de
 * vacaciones deja que las cargue la administración (ver `vacations` en lib/policies); si
 * no, el servidor contesta con el motivo.
 */

type ApiError = { response?: { data?: { message?: string } }; message?: string };

function unwrap(err: ApiError): never {
  throw new Error(err.response?.data?.message || err.message);
}

const path = (email: string) => `/vacations/${encodeURIComponent(email)}`;

export function findVacationsOf(email: string): Promise<VacationPeriod[]> {
  return api
    .get(path(email))
    .then((response) => response.data.data as VacationPeriod[])
    .catch(unwrap);
}

export function addVacationFor(email: string, fromDate: string, toDate: string, reason?: string): Promise<void> {
  return api
    .post(path(email), { fromDate, toDate, reason })
    .then(() => undefined)
    .catch(unwrap);
}

export function removeVacationFor(email: string, id: number): Promise<void> {
  return api
    .delete(`${path(email)}/${id}`)
    .then(() => undefined)
    .catch(unwrap);
}
