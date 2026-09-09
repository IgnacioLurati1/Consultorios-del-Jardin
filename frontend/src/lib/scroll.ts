/**
 * Volver al principio de la pantalla.
 *
 * Lo que se mueve no es la ventana sino la caja del contenido, que vive abajo de la
 * barra de arriba (ver el armazón en index.css). Por eso `window.scrollTo` acá no hace
 * nada, y hay que pedírselo a la caja.
 */
export function subirAlPrincipio() {
  document.querySelector(".app-scroll")?.scrollTo(0, 0);
}
