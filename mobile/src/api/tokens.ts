import { secureStorage } from "./secureStorage";
import { jwtDecode } from "jwt-decode";

/**
 * Los dos tokens de la sesión, guardados donde el sistema los proteja (ver
 * secureStorage). Es el equivalente en la app de la cookie httpOnly de la web: otra
 * aplicación no puede leerlos y no quedan escritos en texto plano en el disco.
 *
 * Además se cachean en memoria porque el interceptor de axios corre en cada request y
 * leer del llavero cada vez es ir a un módulo nativo por nada.
 */
const ACCESS_KEY = "cdj.token";
const REFRESH_KEY = "cdj.refreshToken";

export type Role = "client" | "professional" | "admin";

export interface TokenPayload {
  email: string;
  type: Role;
  exp: number;
  iat: number;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Levanta lo guardado al abrir la app. Devuelve si había una sesión. */
export async function loadTokens(): Promise<boolean> {
  const [access, refresh] = await Promise.all([secureStorage.get(ACCESS_KEY), secureStorage.get(REFRESH_KEY)]);

  accessToken = access;
  refreshToken = refresh;

  // El access token dura 15 minutos, así que casi siempre llega vencido: lo que decide
  // si hay sesión es el refresh token, que dura 30 días.
  return !!refresh;
}

export async function saveTokens(access: string, refresh?: string | null): Promise<void> {
  accessToken = access;
  await secureStorage.set(ACCESS_KEY, access);

  if (refresh) {
    refreshToken = refresh;
    await secureStorage.set(REFRESH_KEY, refresh);
  }
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
}

/** Quién es el que está usando la app, según el token. Null si no se puede leer. */
export function decode(token: string | null): TokenPayload | null {
  if (!token) return null;

  try {
    return jwtDecode<TokenPayload>(token);
  } catch {
    return null;
  }
}

/**
 * El refresh token también trae email y tipo, así que la app sabe quién está adentro
 * aunque el access token ya haya vencido y todavía no se haya renovado.
 */
export function currentUser(): TokenPayload | null {
  return decode(accessToken) ?? decode(refreshToken);
}
