import api from "../../../axios"
import type { Person } from "../../types";

/**
 * Todas las personas del sistema, administradores incluidos.
 *
 * Va por /people y no por /people/NoAdmin, que es lo que pedía antes: ese listado
 * escondía a los administradores, y con eso se escondía también el único lugar desde
 * donde se los puede volver a habilitar si el sistema de seguridad cierra a uno.
 */
export function getAllUsers(): Promise<Person[]>{
    return api.get('/people')
    .then(response => response.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    }
    )
}

/**
 * Todos los profesionales, habilitados y deshabilitados.
 *
 * La pantalla de horarios lo necesita así. Un profesional deshabilitado conserva sus
 * módulos cargados y esos módulos siguen reservando el consultorio, o sea que hay que
 * poder llegar a su grilla para sacarlos. Solo para admin.
 */
export function findAllProfessionals(): Promise<Person[]>{
    return api.get('/people/type/professional')
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findAllActiveProfessionals(): Promise<Person[]>{
    return api.get('/people/type/active/professional')
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findAllActiveClients(): Promise<Person[]>{
    return api.get('/people/type/active/client')
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findProfessionalsOfficeSpecialty(officeId:string,speciality?:string): Promise<Person[]>{
    return api.get(`/people/professionals/office/${officeId}${speciality ? "/" + speciality : ""}`)
    .then(response => response.data.data)
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export function findOne(email:string): Promise<Person>{
    return api.get(`/people/${email}`)
    .then(response => response.data.data)
    .catch(()=> {
        return [];
    });
}

/**
 * Muestra o esconde a un profesional de la búsqueda de turnos. No lo deshabilita: sigue
 * entrando, viendo su agenda y cargando turnos a mano.
 */
export function toggleBookable(email: string){
    return api.patch(`/people/${email}/toggleBookable`)
    .then(response => response.data.data as { bookable: boolean })
    .catch((err: any) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

/**
 * Prende o apaga la lista de espera de un profesional. Apagarla la vacía y les avisa a
 * los que estaban; el mensaje del servidor dice a cuántos.
 */
export function toggleWaitlist(email: string){
    return api.patch(`/people/${email}/toggleWaitlist`)
    .then(response => ({ ...(response.data.data as { waitlistEnabled: boolean }), message: response.data.message as string }))
    .catch((err: { response?: { data?: { message?: string } }; message: string }) => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

/**
 * Habilita o deshabilita una cuenta.
 *
 * Devuelve cómo quedó y no solamente que salió bien, porque deshabilitar a un
 * profesional lo saca además de la búsqueda de turnos y esa segunda marca tiene que
 * verse en la ficha sin recargar la pantalla.
 *
 * Puede volver null. La página y el servidor se publican por separado, así que hay un
 * rato en que la página nueva le habla a un servidor que todavía contesta como antes, y
 * en ese rato deshabilitar tiene que seguir funcionando igual.
 */
export function toggleState(email:string){
    return api.patch(`/people/${email}/toggleState`)
    .then(res => (res.data?.data ?? null) as { active: boolean; bookable: boolean; deletionAt?: string | null } | null)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg)
    })
}

/**
 * Borra a un paciente de la base, con todo lo que tenga cargado.
 *
 * Con turnos, el servidor lo frena la primera vez y contesta `HAS_APPOINTMENTS` con el
 * detalle. `force` es el sí a esa segunda pregunta, la que dice que los turnos se van
 * también.
 */
export function deletePerson(email: string, force = false): Promise<void>{
    return api.delete(`/people/${encodeURIComponent(email)}${force ? "?force=1" : ""}`)
    .then(() => undefined)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        // El código viaja pegado al error: es lo que distingue "no se puede" de "tiene
        // historial y hace falta decirlo de nuevo".
        throw Object.assign(new Error(backendMsg), { code: err.response?.data?.code });
    });
}

/**
 * Corrige el correo de un paciente sin cuenta.
 *
 * El correo es su clave en la base, así que el servidor mueve la ficha entera con sus
 * turnos. Devuelve la ficha nueva.
 */
export function changePatientEmail(email: string, newEmail: string): Promise<Person>{
    return api.patch(`/people/${encodeURIComponent(email)}/email`, { email: newEmail })
    .then(res => res.data.data as Person)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

// Actualiza los datos de una persona. El backend ignora email y password en este
// endpoint, así que desde acá nunca se mandan.
export function updatePerson(email: string, data: Partial<Person>): Promise<Person>{
    return api.patch(`/people/${email}`, data)
    .then(res => res.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

/**
 * Las direcciones a las que no les llegan los mails.
 *
 * `missing` es la casilla que no existe, según el servidor del otro lado. `blocked` es la
 * que existe y aun así no recibe. Si falla, lista vacía: es un extra sobre la pantalla y
 * sin él se sigue haciendo todo igual.
 */
export type BounceKind = "missing" | "blocked";

export function findBouncedEmails(): Promise<Array<{ email: string; kind: BounceKind }>>{
    return api.get('/people/bounced')
    .then(res => (res.data?.data ?? []) as Array<{ email: string; kind: BounceKind }>)
    .catch(() => []);
}

/** Un profesional habilitado, con su último cambio de contraseña. */
export interface ProfessionalPassword {
    email: string;
    name: string;
    surname: string;
    speciality: string | null;
    /** El último cambio de contraseña. Null si no hay registro: sigue con la provisoria o la cambió antes de que se anotara. */
    passwordChangedAt: string | null;
}

export function findProfessionalPasswords(): Promise<ProfessionalPassword[]>{
    return api.get('/people/passwords/professionals')
    .then(res => res.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

/** Les manda el mail para cambiar la contraseña, como enviado por la administración. */
export function sendPasswordMails(emails: string[]): Promise<{ sent: string[]; failed: string[]; skipped: number }>{
    return api.post('/people/passwords/mail', { emails })
    .then(res => res.data.data)
    .catch(err => {
        const backendMsg = err.response?.data?.message || err.message;
        throw new Error(backendMsg);
    });
}

export interface ProfessionalInput {
    name: string;
    surname: string;
    email: string;
    docType: string;
    docNumber: string;
    phoneNumber: string;
    speciality: string;
    /** Su presentación, opcional. Vacío no se manda. */
    about?: string;
}

// Va por /people/professional y no por el registro público: ese devuelve un token y
// setea la cookie de refresh, así que el admin terminaba con la sesión del profesional
// que acababa de crear.
//
// Sin contraseña: la elige el profesional desde el link que le llega por mail.
export function registerProfessional(data: ProfessionalInput): Promise<Person>{
    return api.post('/people/professional', data)
    .then(res => res.data.data)
    .catch(err => {
      const backendMsg = err.response?.data?.message || err.message;
      throw new Error(backendMsg);
    });
}