import api from "./client";
import { Person, Role } from "./types";

/** Credenciales válidas: el backend devuelve los dos tokens de la sesión. */
export interface LoginResult {
  token: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await api.post("/people/login", { email: email.trim().toLowerCase(), password });
  return { token: data.token, refreshToken: data.refreshToken };
}

export interface SignUpInput {
  name: string;
  surname: string;
  email: string;
  docType: string;
  docNumber: string;
  phoneNumber: string;
  password: string;
  type: "client" | "professional";
  speciality?: string;
}

export async function signUp(input: SignUpInput): Promise<LoginResult> {
  const { data } = await api.post("/people", { ...input, email: input.email.trim().toLowerCase() });
  return { token: data.token, refreshToken: data.refreshToken };
}

/** Si el email todavía no tiene cuenta. Se consulta mientras se escribe el registro. */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const { data } = await api.get(`/people/available/${encodeURIComponent(email)}`);
  return !!data.available;
}

export async function findPerson(email: string): Promise<Person> {
  const { data } = await api.get(`/people/${encodeURIComponent(email)}`);
  return data.data;
}

/** El backend ignora email y contraseña acá: se cambian por otros caminos. */
export async function updatePerson(email: string, changes: Partial<Person>): Promise<Person> {
  const { data } = await api.patch(`/people/${encodeURIComponent(email)}`, changes);
  return data.data;
}

/** Manda el mail con el link para elegir una contraseña nueva. */
export async function requestPasswordMail(email: string): Promise<void> {
  await api.post(`/people/${encodeURIComponent(email.trim().toLowerCase())}/passwordMail`);
}

/** Todas las personas menos los admins. Solo admin. */
export async function findAllUsers(): Promise<Person[]> {
  const { data } = await api.get("/people/NoAdmin");
  return data.data;
}

export async function findByType(type: Role): Promise<Person[]> {
  const { data } = await api.get(`/people/type/${type}`);
  return data.data;
}

export async function findActiveByType(type: Role): Promise<Person[]> {
  const { data } = await api.get(`/people/type/active/${type}`);
  return data.data;
}

/** Profesionales que atienden en una sucursal, opcionalmente de una especialidad. */
export async function findProfessionalsAt(officeId: string, speciality?: string): Promise<Person[]> {
  const path = `/people/professionals/office/${officeId}${speciality ? `/${encodeURIComponent(speciality)}` : ""}`;
  const { data } = await api.get(path);
  return data.data;
}

/** Habilita o deshabilita una cuenta. Solo admin. */
export async function toggleUserState(email: string): Promise<void> {
  await api.patch(`/people/${encodeURIComponent(email)}/toggleState`);
}

/**
 * Muestra o esconde a un profesional de la búsqueda de turnos. Solo admin.
 *
 * No lo deshabilita: sigue entrando, viendo su agenda y cargando turnos a mano.
 */
export async function toggleUserBookable(email: string): Promise<boolean> {
  const { data } = await api.patch(`/people/${encodeURIComponent(email)}/toggleBookable`);
  return data.data.bookable as boolean;
}

export interface ProfessionalInput {
  name: string;
  surname: string;
  email: string;
  docType: string;
  docNumber: string;
  phoneNumber: string;
  password: string;
  speciality: string;
}

/**
 * Alta de profesional hecha por el admin. Va por su propia ruta y no por el registro
 * público, que devuelve tokens: si no, el admin terminaba con la sesión del profesional
 * que acababa de crear.
 */
export async function registerProfessional(input: ProfessionalInput): Promise<Person> {
  const { data } = await api.post("/people/professional", input);
  return data.data;
}

export interface AnonymousPatientInput {
  email: string;
  name: string;
  surname: string;
  docType?: string;
  docNumber?: string;
  phoneNumber?: string;
}

/** Paciente sin cuenta, cargado por un profesional para poder darle turnos. */
export async function createAnonymousPatient(input: AnonymousPatientInput): Promise<Person> {
  const { data } = await api.post("/people/anonymous", input);
  return data.data;
}
