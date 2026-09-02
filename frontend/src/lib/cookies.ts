/**
 * Cookies del navegador, sin librería.
 *
 * Guardan preferencias de la persona que mira, no datos del sistema: qué tema eligió,
 * qué aviso ya leyó, las últimas cosas que le dijo al asistente. Nada de esto viaja al
 * servidor ni le sirve a nadie más, así que vive en el equipo desde el que se usa y se
 * pierde si se limpia el navegador, que es exactamente lo que corresponde.
 */

const YEAR_IN_DAYS = 365;

export function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;

  for (const raw of document.cookie.split("; ")) {
    if (raw.startsWith(prefix)) {
      try {
        return decodeURIComponent(raw.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function writeCookie(name: string, value: string, days = YEAR_IN_DAYS): void {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();

  // SameSite=Lax: la cookie no sale en pedidos que dispare otro sitio. Ninguna de estas
  // autentica nada, pero tampoco hay motivo para que salgan de acá.
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function deleteCookie(name: string): void {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

/** Lee una cookie que guarda un objeto. Si quedó rota o vieja, devuelve el respaldo. */
export function readJsonCookie<T>(name: string, fallback: T): T {
  const raw = readCookie(name);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonCookie(name: string, value: unknown, days = YEAR_IN_DAYS): void {
  writeCookie(name, JSON.stringify(value), days);
}
