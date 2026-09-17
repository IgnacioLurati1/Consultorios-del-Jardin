/**
 * Cuándo se borra una cuenta deshabilitada.
 *
 * Deshabilitar no es para siempre. A las tres semanas la cuenta ya no se puede recuperar,
 * y el cierre de mes siguiente a esas tres semanas la borra con todo lo que tenga
 * colgando. Es la misma cuenta que hace el servidor en accountCleanup.ts. Si cambia una,
 * cambia la otra.
 *
 * Acá vive porque el administrador tiene que ver la fecha antes de apretar el botón, y
 * preguntarla para después no hacer nada con la respuesta no aporta.
 */

/** Cuánto tiene que llevar deshabilitada una cuenta para que le toque. */
export const DISABLED_DAYS = 21;

/** El último día del mes en el que se cumplen las tres semanas. */
export function deletionDateFor(bannedAt: Date | string = new Date()): Date {
  const since = new Date(bannedAt);
  const ready = new Date(since.getFullYear(), since.getMonth(), since.getDate() + DISABLED_DAYS);
  return new Date(ready.getFullYear(), ready.getMonth() + 1, 0);
}

/** "31 de octubre", o con el año si cae en otro. Recibe el día del borrado, no el de la baja. */
export function formatDeletionDate(date: Date | string): string {
  const day = new Date(date);
  const sameYear = day.getFullYear() === new Date().getFullYear();

  return day.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Lo mismo, a partir del día en que se deshabilitó la cuenta. */
export function deletionLabel(bannedAt: Date | string = new Date()): string {
  return formatDeletionDate(deletionDateFor(bannedAt));
}

/** Si la fecha cae dentro del mes en curso. Cambia cómo se lee el aviso, no la fecha. */
export function deletionThisMonth(bannedAt: Date | string = new Date()): boolean {
  const date = deletionDateFor(bannedAt);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
