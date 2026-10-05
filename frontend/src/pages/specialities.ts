import { currentInstallation, DEFAULT_INSTALLATION, useInstallation } from "../lib/installation.ts";

/**
 * Especialidades que se atienden en el consultorio. Se usa tanto para buscar turnos como
 * para cargar profesionales, así que el texto guardado coincide con el que se filtra.
 *
 * Era una lista fija escrita acá, en la app del celular y en el asistente: sumar una era
 * sumarla en los tres. Ahora la decide el consultorio en la configuración (`services`) y
 * llega del servidor; la web y el asistente leen la misma. La app del celular todavía
 * tiene su copia en mobile/src/lib/specialities.ts.
 */

/** La lista de siempre, para lo que se arma antes de que llegue la configuración. */
export const SPECIALITIES = DEFAULT_INSTALLATION.services;

/** La lista del consultorio, para un componente: se vuelve a dibujar cuando llega. */
export function useSpecialities(): string[] {
  return useInstallation().services;
}

/** La lista del consultorio, fuera de un componente. Antes de que llegue, la de siempre. */
export function specialities(): string[] {
  return currentInstallation().services;
}

/** Compara especialidades sin que molesten los acentos ni las mayúsculas. */
export function normalizeSpeciality(value: string): string {
  return (
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLowerCase() ?? ""
  );
}

export function sameSpeciality(a: string, b: string): boolean {
  return normalizeSpeciality(a) === normalizeSpeciality(b);
}
