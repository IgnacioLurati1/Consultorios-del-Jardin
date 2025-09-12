import axios from "axios";

const api = axios.create({
  baseURL: "/api", //CAMBIAR EN DEPLOY
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {

      if(!originalRequest._retry){
        originalRequest._retry = true;
      }
      
      try{
        const { data } = await axios.get("/api/refreshToken", {
        withCredentials: true,
      });

      localStorage.setItem("token", data.token);
      
      return api(originalRequest);
      } catch (refreshError) {
          try {
          await axios.post("/api/logout", {}, { withCredentials: true });
        } catch (logoutError) {
          console.error("Error cerrando sesión:", logoutError);
        } finally {
          localStorage.removeItem("token");
          window.location.href = "/login"; // redirigir al login
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
