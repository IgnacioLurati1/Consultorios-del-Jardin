import axios from "axios";

// Dónde está el backend.
//
// En desarrollo, "/api" a secas: el proxy de Vite lo redirige a localhost:3000 (ver
// vite.config.ts), y al ser same-origin la cookie httpOnly del refresh token viaja sola.
//
// Desplegado no hay proxy —el front es un puñado de archivos estáticos— así que la
// dirección del backend llega en VITE_API_URL al compilar. Sin eso, cada request pegaría
// contra el propio dominio del front y volvería un 404.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

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

/** Dónde se guarda el motivo, para que el login lo pueda contar después de la patada. */
export const LOCKOUT_KEY = "cierre-de-sesion";

api.interceptors.response.use(
  (response) => response,
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

      localStorage.removeItem("token");
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";

      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest(originalRequest?.url)) {
      originalRequest._retry = true; // marca este request como retry

      try {
        const { data } = await axios.get(`${API_BASE_URL}/refreshToken`, {
          withCredentials: true,
          headers: { ...CLIENT_HEADER },
        });

        localStorage.setItem("token", data.token);
        // Reintenta **solo una vez**
        originalRequest.headers.Authorization = `Bearer ${data.token}`; //Actualiza el header del request original
        return api(originalRequest);
      } catch (refreshError) {
        try {
          await axios.post(`${API_BASE_URL}/people/logout`, {}, { withCredentials: true });
        } catch (logoutError) {
          console.error("Error cerrando sesión:", logoutError);
        } finally {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
