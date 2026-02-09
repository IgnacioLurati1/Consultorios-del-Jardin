import { test, expect } from '@playwright/test';

//DATO IMPORTANTE: Este test necesita un usuario admin con email 'admin@gmail.com' y contraseña 'admin' y que su type sea ADMIN para que funcione correctamente.

test('Flujo completo de Login exitoso', async ({ page }) => {
  // Ir a la página
  await page.goto('http://localhost:5173/');

  // Prueba con 'button' primero. Si es un <Link to="..."> de React Router, usa 'link'.
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click(); 

  await expect(page).toHaveTitle(/Consultorios de jardin/i);
  // Llenar el formulario

  await page.getByLabel('Email').fill('admin@gmail.com');
  await page.getByLabel('Contraseña').fill('admin');

  // Hacer clic en el botón de submit
  // Especificamos que queremos el botón que está visible dentro del form.
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión' }).click();

  // 4. Validar el resultado
  // Si el login es exitoso con admin, tu código de React redirige a "/adminHome".
  // Lo correcto es esperar la URL de destino:
  await expect(page).toHaveURL(/adminHome/); 
});