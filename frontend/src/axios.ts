import axios from "axios";

// Dónde está el backend.
//
// En desarrollo, "/api" a secas: el proxy de Vite lo redirige a localhost:3000 (ver
// vite.config.ts), y al ser same-origin la cookie httpOnly del refresh token viaja sola.
//
// Desplegado no hay proxy —el front es un puñado de archivos estáticos— así que la
// dirección del backend llega en VITE_API_URL al compilar. Sin eso, cada request pegaría
// contra el propio dominio del front y volvería un 404.
// `||` y no `??`: una variable declarada pero vacía llega como "" y no como undefined,
// y `??` la dejaría pasar. El resultado sería una URL base vacía, o sea todas las
// requests contra el propio dominio del front, que es exactamente lo que esto evita.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Endpoints donde un 401 significa "los datos están mal", no "se venció la sesión".
// Sin esta lista, un login fallido disparaba el refresh, el refresh también fallaba
// y terminaba en window.location.href = "/login": la página se recargaba y el usuario
// veía el formulario en blanco, sin el mensaje de error.
const AUTH_PATHS = ["/people/login", "/people/logout", "/people/changePassword", "/refreshToken"];

function isAuthRequest(url?: string): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

// El backend usa este header para dos cosas: decidir dónde devuelve el refresh token
// (acá en una cookie httpOnly; en la app, en el cuerpo) y anotar por qué canal entró la
// persona, que es lo que después cuenta el panel de números. Ver clients.ts en el back.
const CLIENT_HEADER = { "X-Client": "web" } as const;

const api = axios.create({
  baseURL: API_BASE_URL,
  // Con el backend en otro dominio, el navegador no manda ni recibe cookies salvo que se
  // le pida. Sin esto la cookie del refresh nunca se guarda y la sesión se corta a los
  // quince minutos, cuando vence el token de acceso. En local no cambia nada: same-origin
  // ya las mandaba.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    ...CLIENT_HEADER,
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Dónde guarda la web el refresh token.
 *
 * Antes no lo guardaba en ningún lado: llegaba en una cookie httpOnly que el JS de la
 * página no podía leer, y el navegador la mandaba solo. Desplegada, la web y el backend
 * quedaron en dominios distintos y esa cookie pasó a ser de terceros: Safari y Firefox
 * la bloquean, así que en un iPhone la sesión moría a los quince minutos. Ahora el
 * backend lo manda en el cuerpo, igual que a la app, y viaja de vuelta en un header.
 */
const REFRESH_KEY = "refreshToken";

/**
 * El refresh token llega en el cuerpo de cualquier respuesta que abra sesión —entrar,
 * registrarse—. Guardarlo acá y no en cada pantalla evita que la próxima que abra
 * sesión se olvide de hacerlo.
 */
function keepSessionFrom(data: any): void {
  if (data && typeof data.refreshToken === "string" && data.refreshToken) {
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
  }
}

/** Se va todo junto: un token de acceso sin el de refresh no sirve para nada. */
export function clearSession(): void {
  localStorage.removeItem("token");
  localStorage.removeItem(REFRESH_KEY);
}

/**
 * Pide un token de acceso nuevo con el de refresh guardado. Devuelve el token, o null si
 * no hay con qué pedirlo o el backend lo rechaza.
 *
 * La usa el arranque de la aplicación: el token de acceso dura quince minutos y el de
 * refresh treinta días, así que sin esto volver a la página después de un rato era
 * empezar de nuevo desde el login aunque la sesión siguiera viva.
 *
 * Va por `axios` pelado y no por `api`: el interceptor de `api` reacciona a un 401
 * renovando la sesión, que es justo lo que estamos haciendo acá.
 */
export async function renewSession(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;

  try {
    const { data } = await axios.get(`${API_BASE_URL}/refreshToken`, {
      withCredentials: true,
      headers: { ...CLIENT_HEADER, "X-Refresh-Token": refresh },
    });

    if (!data?.token) return null;

    localStorage.setItem("token", data.token);
    keepSessionFrom(data);
    return data.token as string;
  } catch {
    // Vencido, revocado o la cuenta ya no está habilitada: no hay sesión que recuperar.
    clearSession();
    return null;
  }
}

/** Dónde se guarda el motivo, para que el login lo pueda contar después de la patada. */
export const LOCKOUT_KEY = "cierre-de-sesion";

// A dónde se manda a alguien cuando se le corta la sesión.
//
// No alcanza con "/login": publicada, la aplicación no vive en la raíz del dominio sino
// bajo el nombre del repositorio, y una dirección absoluta se sale de la aplicación y
// cae en el 404 del hosting. BASE_URL es ese prefijo, y en desarrollo es "/", así que la
// misma cuenta sirve en los dos lados.
const LOGIN_URL = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/Login`;

/** Ya estamos en el login: recargar solo borraría el mensaje que se acaba de guardar. */
function alreadyOnLogin(): boolean {
  return window.location.pathname.toLowerCase().startsWith(LOGIN_URL.toLowerCase());
}

api.interceptors.response.use(
  (response) => {
    keepSessionFrom(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // La cuenta se cerró sola mientras estaba en uso. No hay nada que reintentar y
    // tampoco tiene sentido dejar a la persona mirando una pantalla que ya no carga
    // nada: se la manda al login con el motivo, que es lo único que puede hacer algo
    // con esta información.
    if (error.response?.status === 403 && error.response?.data?.code === "ACCOUNT_COMPROMISED") {
      try {
        sessionStorage.setItem(LOCKOUT_KEY, error.response.data.message ?? "");
      } catch {
        // Sin sessionStorage el login muestra su texto por defecto, que dice lo mismo.
      }

      clearSession();
      if (!alreadyOnLogin()) window.location.href = LOGIN_URL;

      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest(originalRequest?.url)) {
      originalRequest._retry = true; // marca este request como retry

      try {
        const refresh = localStorage.getItem(REFRESH_KEY);
        const { data } = await axios.get(`${API_BASE_URL}/refreshToken`, {
          withCredentials: true,
          headers: { ...CLIENT_HEADER, ...(refresh ? { "X-Refresh-Token": refresh } : {}) },
        });

        localStorage.setItem("token", data.token);
        keepSessionFrom(data);
        // Reintenta **solo una vez**
        originalRequest.headers.Authorization = `Bearer ${data.token}`; //Actualiza el header del request original
        return api(originalRequest);
      } catch (refreshError) {
        try {
          await axios.post(`${API_BASE_URL}/people/logout`, {}, { withCredentials: true });
        } catch (logoutError) {
          console.error("Error cerrando sesión:", logoutError);
        } finally {
          clearSession();
          window.location.href = LOGIN_URL;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
