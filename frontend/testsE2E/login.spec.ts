import { test, expect } from '@playwright/test';

// Necesita el backend levantado y un usuario admin. Por defecto usa el de desarrollo;
// se puede cambiar con las variables E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@admin.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin1234';

test('Flujo completo de Login exitoso', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // En la barra superior, "Iniciar sesión" es un link a /Login.
  await page.getByRole('link', { name: /Iniciar sesión/i }).click();

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/ }).click();

  await expect(page).toHaveURL(/AdminHome/i);
});

test('Login con datos incorrectos muestra el error sin recargar', async ({ page }) => {
  await page.goto('http://localhost:5173/Login');

  await page.getByLabel('Email').fill('no.existe@demo.local');
  await page.getByLabel('Contraseña').fill('contraseña-incorrecta');
  await page.getByRole('button', { name: /^Entrar$/ }).click();

  // El 401 del login no tiene que disparar el refresh token ni mandar de vuelta al form vacío.
  await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('no.existe@demo.local');
});
