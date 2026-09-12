/**
 * Las dos hojas del logo, dibujadas en vez de fotografiadas.
 *
 * El logo de la barra es un PNG de 47 píxeles: agrandado para ir encima de un título se
 * ve borroso, y además tiene el verde metido adentro. Acá el contorno sale del mismo logo
 * (calcado sobre Logo.png) y el color lo pone quien lo usa con `fill` y `color`, así que
 * puede seguir a la estación.
 *
 * - `fill` pinta las hojas.
 * - `color` pinta los nervios, que en el logo son una línea más clara adentro de cada hoja.
 */
export function BrandLeaves({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 620 360" aria-hidden="true" focusable="false">
      <path d="M248 336 C182 334 96 302 56 222 C32 172 34 124 42 98 C112 96 192 122 232 190 C262 240 262 300 248 336 Z" />
      <path d="M290 336 C280 262 300 172 370 106 C430 52 520 28 582 26 C590 92 570 172 520 232 C462 300 372 332 290 336 Z" />
      <path d="M242 326 C204 276 156 220 112 168" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M300 326 C360 258 428 188 486 128" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
