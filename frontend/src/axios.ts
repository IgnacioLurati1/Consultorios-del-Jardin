import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(response => {
  return response;
}, error => {
  if (error.response && error.response.status === 401) {
    // Aca iria una ruta de redireccionamiento para accesos no autorizados
  }
  return Promise.reject(error);
});

export default api;
