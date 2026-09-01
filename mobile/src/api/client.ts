import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { API_URL, CLIENT_HEADER } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokens";

/**
 * El cliente HTTP de la app. Hace tres cosas que ninguna pantalla debería repetir:
 * firmar cada request, renovar el token cuando vence, y traducir el error del servidor
 * a una frase que se pueda mostrar.
 */
const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json", ...CLIENT_HEADER },
});

/**
 * Endpoints donde un 401 significa "los datos están mal", no "se venció la sesión".
 * Sin esta lista, un login con la contraseña equivocada dispararía el refresh y
 * terminaría cerrando una sesión que nunca se abrió.
 */
const AUTH_PATHS = ["/people/login", "/people/logout", "/people/changePassword", "/refreshToken"];

function isAuthRequest(url?: string): boolean {
  return !!url && AUTH_PATHS.some((path) => url.includes(path));
}

/** La app avisa acá que la sesión se murió, para mandar al login desde un solo lugar. */
type SessionLostHandler = () => void;
let onSessionLost: SessionLostHandler = () => {};

export function setSessionLostHandler(handler: SessionLostHandler): void {
  onSessionLost = handler;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Una sola renovación a la vez. Si tres pantallas piden datos juntas y las tres reciben
 * 401, comparten esta promesa en lugar de pedir tres tokens nuevos.
 */
let renewal: Promise<string> | null = null;

async function renewAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("Sin sesión");

  // Va por fuera de `api` a propósito: si esta llamada devolviera 401, el interceptor
  // de abajo intentaría renovar otra vez y se quedaría dando vueltas.
  const { data } = await axios.get(`${API_URL}/refreshToken`, {
    headers: { ...CLIENT_HEADER, "X-Refresh-Token": refresh },
    timeout: 20000,
  });

  await saveTokens(data.token);
  return data.token as string;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;

    const expired = error.response?.status === 401 && original && !original._retried && !isAuthRequest(original.url);

    if (expired) {
      original._retried = true;

      try {
        renewal = renewal ?? renewAccessToken();
        const token = await renewal;
        renewal = null;

        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      } catch {
        renewal = null;
        await clearTokens();
        onSessionLost();
      }
    }

    return Promise.reject(error);
  }
);

/**
 * El texto que se le muestra a la persona. El backend ya contesta en castellano y con
 * frases pensadas para leer, así que lo primero es respetarlas; lo de abajo es para
 * cuando no llega respuesta.
 */
export function errorMessage(error: unknown, fallback = "No pudimos completar eso"): string {
  if (axios.isAxiosError(error)) {
    const fromServer = (error.response?.data as { message?: string } | undefined)?.message;
    if (fromServer) return fromServer;

    if (error.code === "ECONNABORTED") return "El servidor tardó demasiado en contestar";
    if (!error.response) return "No pudimos conectarnos. Fijate que tengas señal.";
  }

  return fallback;
}

/** True cuando el problema fue de red y reintentar tiene sentido. */
export function isOffline(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

export default api;
