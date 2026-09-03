import { defineConfig } from 'vitest/config'
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve el sitio colgado del nombre del repo
  // (usuario.github.io/Consultorios-del-Jardin/), no de la raíz del dominio. Sin esto
  // el HTML pide sus propios archivos a /assets/... y el servidor no encuentra ninguno:
  // la página carga en blanco. Llega al compilar, así que en desarrollo sigue en "/".
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    proxy: {
      // Cualquier petición a /api/* se redirige a localhost:3000
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false, // porque estamos en localhost sin HTTPS
        cookieDomainRewrite: "localhost",
      },
    },
  },
  test: {
    globals: true,                // IMPORTANTE: Hace que 'expect' sea global
    environment: 'jsdom',         // Simula el navegador
    setupFiles: './src/setupTests.ts', // Archivo de configuración inicial
    css: true,
    // testsE2E son specs de Playwright: si vitest los levanta, explotan con
    // "Playwright Test did not expect test() to be called here".
    exclude: ['node_modules/**', 'dist/**', 'testsE2E/**'],
  },
});
