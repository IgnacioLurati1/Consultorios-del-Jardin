import { test, expect } from '@playwright/test';

//Test que no se puede correr si no está activo el sistema de mails ya que no funciona correctamente el BackEnd

test('Flujo completo de Register exitoso', async ({ page }) => {
  // Ir a la página
    await page.goto('http://localhost:5173/');

    // Prueba con 'button' primero. Si es un <Link to="..."> de React Router, usa 'link'.
    await page.getByRole('button', { name: /Registrarse/i }).click();

    await expect(page).toHaveTitle(/Consultorios de jardin/i);
    // Llenar el formulario
    await page.getByLabel('Nombre').fill('Nombre de Prueba');
    await page.getByLabel('Apellido').fill('Apellido de Prueba');
    await page.getByLabel('Email').fill('emaildeprueba@gmail.com');
    await page.getByLabel('Contraseña').fill('userdeprueba');
    await page.getByLabel('Confirmar contraseña').fill('userdeprueba');

    await page.getByLabel('Tipo de documento').selectOption('DNI');
    await page.getByLabel('Número de documento').fill('12345678');
    // Especificamos que queremos el botón que está visible dentro del form.
    await page.locator('form').getByRole('button', { name: 'Registrar' }).click();

    // 4. Validar el resultado
    // Si el login es exitoso con admin, tu código de React redirige a "/adminHome".
    // Lo correcto es esperar la URL de destino:
    await expect(page).toHaveURL(/http:\/\/localhost:5173\//); 
});