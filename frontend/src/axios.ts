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

// El backend usa este header para dos cosas: mandarle la cookie del refresh al navegador
// y no a la app, que no tiene dónde guardarla, y anotar por qué canal entró la persona,
// que es lo que después cuenta el panel de números. Ver clients.ts en el back.
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
 * Dónde guarda la web el refresh token cuando no le queda otra.
 *
 * La forma buena es la cookie httpOnly que manda el backend: el JS de la página no la
 * puede leer, así que un XSS no se lleva la sesión. Dejó de alcanzar al desplegar, porque
 * la web y el backend quedaron en dominios distintos y ahí pasó a ser una cookie de
 * terceros, de las que Safari y Firefox bloquean. En un iPhone la sesión moría a los
 * quince minutos. Desde entonces el backend manda el token también en el cuerpo, y esta
 * es la copia de la que se tira cuando la cookie no llega.
 */
const REFRESH_KEY = "refreshToken";

/**
 * Qué averiguamos sobre la cookie en este navegador. "1" llegó sola, "0" no llegó, y sin
 * nada todavía no se probó.
 *
 * Se prueba en lugar de deducirse porque desde acá no hay forma de saberlo: depende del
 * navegador, de su versión y de lo que la persona tenga configurado, y todo eso cambia
 * sin avisar. Probar cuesta una request al abrir sesión, que igual había que hacer.
 */
const COOKIE_KEY = "refresh-por-cookie";

function cookieSirveSola(): boolean {
  try {
    return localStorage.getItem(COOKIE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Anota lo que se acaba de averiguar.
 *
 * Cuando la cookie alcanza, la copia guardada se borra. Dejarla sería quedarse con lo
 * peor de las dos formas: la sesión viajando protegida y una copia suelta al alcance de
 * cualquier script. Si algún día deja de alcanzar —el navegador se actualiza, alguien
 * bloquea las cookies— la marca se cae y el próximo login vuelve a guardar el token.
 */
function anotarLaCookie(sirve: boolean): void {
  try {
    localStorage.setItem(COOKIE_KEY, sirve ? "1" : "0");
    if (sirve) localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Almacenamiento bloqueado. Se pierde el atajo, no la sesión.
  }
}

function refreshGuardado(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/**
 * Renueva la sesión sin mandar nada, para ver si la cookie llega sola.
 *
 * Se hace al abrir sesión y no en cada renovación: así es una request de más solo cuando
 * la respuesta es que no, y entrar no pasa tan seguido como para que se note. Que se
 * repita en cada login es a propósito, porque el día que la web y el backend compartan
 * dominio la cookie va a volver a funcionar sin que haya que tocar nada.
 */
let probando: Promise<void> | null = null;

function probarLaCookie(): void {
  if (cookieSirveSola() || probando) return;

  probando = axios
    .get(`${API_BASE_URL}/refreshToken`, { withCredentials: true, headers: { ...CLIENT_HEADER } })
    .then(({ data }) => anotarLaCookie(!!data?.token))
    .catch(() => anotarLaCookie(false))
    .finally(() => {
      probando = null;
    });
}

/**
 * El refresh token llega en el cuerpo de cualquier respuesta que abra sesión —entrar,
 * registrarse—. Guardarlo acá y no en cada pantalla evita que la próxima que abra
 * sesión se olvide de hacerlo.
 */
function keepSessionFrom(data: any): void {
  if (!data || typeof data.refreshToken !== "string" || !data.refreshToken) return;

  if (!cookieSirveSola()) localStorage.setItem(REFRESH_KEY, data.refreshToken);
  probarLaCookie();
}

/**
 * Si hay con qué recuperar una sesión al abrir la aplicación.
 *
 * Lo pregunta el arranque para saber si esperar o mandar directo al login. Son dos casos
 * y no uno: el token guardado, y el navegador donde la cookie llega sola y por eso no hay
 * nada guardado.
 */
export function canRenewSession(): boolean {
  return cookieSirveSola() || !!refreshGuardado();
}

/** Se va todo junto: un token de acceso sin el de refresh no sirve para nada. */
export function clearSession(): void {
  localStorage.removeItem("token");
  localStorage.removeItem(REFRESH_KEY);
}

/**
 * Pide un token de acceso nuevo. Devuelve el token, o null si no hay con qué pedirlo o el
 * backend lo rechaza.
 *
 * Prueba las dos formas que tiene de identificarse, empezando por la que le corresponda a
 * este navegador. La cookie sola va primera cuando ya se sabe que llega; si no, va el
 * token guardado y la cookie queda de respaldo, que es lo que sostiene las sesiones que
 * quedaron abiertas de antes.
 *
 * Va por `axios` pelado y no por `api`: el interceptor de `api` reacciona a un 401
 * renovando la sesión, que es justo lo que estamos haciendo acá.
 */
export async function renewSession(): Promise<string | null> {
  const guardado = refreshGuardado();

  const intentos: Record<string, string>[] = [];
  if (!cookieSirveSola() && guardado) intentos.push({ ...CLIENT_HEADER, "X-Refresh-Token": guardado });
  intentos.push({ ...CLIENT_HEADER });

  for (const headers of intentos) {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/refreshToken`, { withCredentials: true, headers });
      if (!data?.token) continue;

      localStorage.setItem("token", data.token);
      // Renovó sin mandar el token: la cookie llegó sola y la copia guardada sobra.
      if (!headers["X-Refresh-Token"]) anotarLaCookie(true);
      return data.token as string;
    } catch {
      // Vencido, revocado, la cuenta deshabilitada, o esta forma no era la de este
      // navegador. Lo dice el intento siguiente, o el final si no queda ninguno.
    }
  }

  // Ninguna de las dos sirvió. Se deja de dar por buena la cookie para que el próximo
  // login vuelva a guardar el token y el navegador no quede sin forma de renovar.
  anotarLaCookie(false);
  clearSession();
  return null;
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

      // La misma renovación que usa el arranque, con las dos formas de identificarse.
      const renovado = await renewSession();

      if (renovado) {
        // Reintenta **solo una vez**
        originalRequest.headers.Authorization = `Bearer ${renovado}`; //Actualiza el header del request original
        return api(originalRequest);
      }

      try {
        await axios.post(`${API_BASE_URL}/people/logout`, {}, { withCredentials: true });
      } catch (logoutError) {
        console.error("Error cerrando sesión:", logoutError);
      } finally {
        clearSession();
        window.location.href = LOGIN_URL;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
