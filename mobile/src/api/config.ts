import Constants from "expo-constants";

/**
 * Dónde está el backend.
 *
 * En desarrollo casi nunca hace falta configurar nada: el teléfono ya se conectó al
 * Metro de esta máquina, así que Expo sabe su IP y de ahí sale la del backend, que corre
 * en el mismo equipo. Cambiar de red no rompe nada.
 *
 * Si el backend vive en otro lado (otra máquina, o un deploy), se pisa con
 * EXPO_PUBLIC_API_URL en el archivo .env de la raíz del proyecto.
 */
const PORT = 3000;

function hostFromExpo(): string | undefined {
  // "192.168.1.10:8081" mientras corre el servidor de desarrollo.
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  return typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
}

function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const host = hostFromExpo();
  return `http://${host ?? "localhost"}:${PORT}/api`;
}

export const API_URL = resolveApiUrl();

/**
 * Con esto el backend sabe que la request viene de la app y devuelve el refresh token en
 * el cuerpo en vez de una cookie, que acá no existe. Ver backend/src/config/clients.ts.
 */
export const CLIENT_HEADER = { "X-Client": "mobile" } as const;
