import { test, expect } from '@playwright/test';

// El alta real manda un mail de bienvenida: sin SendGrid configurado, el backend falla.
// Este test se corre solo con el sistema de mails activo.

test('Flujo completo de Register exitoso', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // En la barra superior, el acceso al registro es un link.
  await page.getByRole('link', { name: /Crear cuenta/i }).click();

  // Paso 1: cuenta
  await page.getByLabel('Email').fill(`prueba.${Date.now()}@demo.local`);
  await page.getByLabel(/^Contraseña/).fill('userdeprueba');
  await page.getByLabel('Repetir contraseña').fill('userdeprueba');
  await page.getByRole('button', { name: /Siguiente/i }).click();

  // Paso 2: datos personales
  await page.getByLabel('Nombre').fill('Nombre de Prueba');
  await page.getByLabel('Apellido').fill('Apellido de Prueba');
  await page.getByRole('button', { name: /Siguiente/i }).click();

  // Paso 3: contacto
  await page.getByLabel('Teléfono').fill('3411234567');
  await page.getByLabel('Tipo de documento').selectOption('DNI');
  await page.getByLabel('Número de documento').fill('12345678');
  await page.getByRole('button', { name: /Crear cuenta/i }).click();

  await expect(page).toHaveURL('http://localhost:5173/');
});

test('El registro no deja avanzar con datos incompletos', async ({ page }) => {
  await page.goto('http://localhost:5173/Register');

  // Sin email no se pasa de paso.
  await page.getByRole('button', { name: /Siguiente/i }).click();
  await expect(page.getByText(/Escribí un email/i)).toBeVisible();

  // Las contraseñas se comparan en el mismo paso, no al final.
  await page.getByLabel('Email').fill('prueba@demo.local');
  await page.getByLabel(/^Contraseña/).fill('secreta123');
  await page.getByLabel('Repetir contraseña').fill('otracosa123');
  await page.getByRole('button', { name: /Siguiente/i }).click();
  await expect(page.getByText(/no coinciden/i)).toBeVisible();
});
