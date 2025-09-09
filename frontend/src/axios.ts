import axios from "axios";

const api = axios.create({
  baseURL: "/api", //CAMBIAR EN DEPLOY
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  console.log(config)
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

    if (error.response.status === 401 && !originalRequest.retry) {
      originalRequest.retry = true;

      const { data } = await axios.get("/api/refreshToken", {
        withCredentials: true,
      });

      localStorage.setItem("token", data.token);

      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

export default api;
