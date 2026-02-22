import { defineConfig } from 'vitest/config'
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
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
  },
});
