import { test, expect } from '@playwright/test';

// This test requires an admin user with email 'admin@gmail.com' and password 'admin' and whose type is ADMIN in order to function correctly.

test('Flujo completo de Login exitoso', async ({ page }) => {
  // Go to the page.
  await page.goto('http://localhost:5173/');

  // Try 'button' first. If it's a React Router <Link to="...">, use 'link'.
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click(); 

  await expect(page).toHaveTitle(/Consultorios de jardin/i);
  // Fill the form

  await page.getByLabel('Email').fill('admin@gmail.com');
  await page.getByLabel('Contraseña').fill('admin');

  // Click the submit button
  // We specify that we want the button that is visible within the form.
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión' }).click();

  // If the login is successful with admin, your React code redirects to "/adminHome".
  // The correct thing to do is to wait for the destination URL.
  await expect(page).toHaveURL(/adminHome/); 
});