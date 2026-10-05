import dotenv from "dotenv";

dotenv.config({ quiet: true });

/**
 * La zona horaria del consultorio.
 *
 * Los turnos guardan la hora que se lee en la pared, y todo lo que convierte entre un
 * instante y esa hora (recordatorios, el calendario que se importa o se exporta, "hoy" en
 * el asistente) necesita saber de qué pared se habla. Sale de `TIMEZONE`, que es de cada
 * instalación; sin cargar, la de Argentina, que es donde funciona Consultorios del Jardín.
 *
 * Se lee una vez al arrancar: cambiarla con turnos ya cargados es mudar el consultorio de
 * país, no algo que se toca con el sistema andando.
 */
export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export const CLINIC_TIMEZONE = (process.env.TIMEZONE ?? "").trim() || DEFAULT_TIMEZONE;

/** Si el nombre es una zona que el sistema conoce. Para revisar la variable al arrancar. */
export function isKnownTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}
