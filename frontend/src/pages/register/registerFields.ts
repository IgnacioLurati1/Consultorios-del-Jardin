/**
 * Chequeos compartidos por el registro de pacientes y el de profesionales.
 * Son los mismos que hace el backend, escritos para que el usuario los lea:
 * la idea es que nada explote recién al final.
 */

import { isEmailAvailable } from "./registerService.ts";

export const DOC_TYPES = ["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"];

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mínimo de caracteres para una contraseña nueva. */
export const MIN_PASSWORD = 6;

export interface RegisterForm {
  name: string;
  surname: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  docType: string;
  docNumber: string;
  speciality: string;
  /** Solo lo llena el alta de profesionales: el paciente no tiene ficha que mostrar. */
  about: string;
}

export const emptyRegisterForm: RegisterForm = {
  name: "",
  surname: "",
  email: "",
  password: "",
  confirmPassword: "",
  phoneNumber: "",
  docType: "",
  docNumber: "",
  speciality: "",
  about: "",
};

export function validateAccount(form: RegisterForm): string | null {
  if (!form.email.trim()) return "Falta el email";
  if (!EMAIL_REGEX.test(form.email.trim())) return "Formato de email inválido. Debe incluir @ y un punto";
  if (!form.password) return "Falta la contraseña";
  if (form.password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  if (!form.confirmPassword) return "Falta repetir la contraseña";
  if (form.password !== form.confirmPassword) return "Las contraseñas no coinciden";
  return null;
}

/**
 * Igual que validateAccount, pero además le pregunta al servidor si el email ya tiene
 * cuenta. Va en el primer paso del registro: enterarse ahí es mucho mejor que llenar
 * los tres pasos y recibir un "ya existe" al final.
 */
export async function validateAccountAsync(form: RegisterForm): Promise<string | null> {
  const problem = validateAccount(form);
  if (problem) return problem;

  const available = await isEmailAvailable(form.email.trim());
  if (!available) return "Ya hay una cuenta registrada con ese email";

  return null;
}

export function validatePersonalData(form: RegisterForm): string | null {
  if (!form.name.trim()) return "Falta el nombre";
  if (!form.surname.trim()) return "Falta el apellido";
  return null;
}

export function validateContact(form: RegisterForm, options: { requireSpeciality?: boolean } = {}): string | null {
  if (!/^\d{10}$/.test(form.phoneNumber.replace(/\D/g, "")))
    return "El teléfono debe tener 10 dígitos, sin 0 ni 15 (por ejemplo 3411234567)";
  if (!form.docType) return "Falta el tipo de documento";
  if (!form.docNumber.trim()) return "Falta el número de documento";
  if (!/^\d+$/.test(form.docNumber.trim())) return "El documento debe tener solo dígitos";
  if (options.requireSpeciality && !form.speciality.trim()) return "Falta la especialidad";
  return null;
}
