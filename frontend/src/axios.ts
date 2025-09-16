import axios from "axios";

const api = axios.create({
  baseURL: "/api", //CAMBIAR EN DEPLOY
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  console.log(config);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // marca este request como retry

      try {
        const { data } = await axios.get("/api/refreshToken", {
          withCredentials: true,
        });

        localStorage.setItem("token", data.token);
        // Reintenta **solo una vez**
        return api(originalRequest);
      } catch (refreshError) {
        try {
          await axios.post("/api/logout", {}, { withCredentials: true });
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
