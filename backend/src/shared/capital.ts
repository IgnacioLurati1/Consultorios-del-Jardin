/**
 * La primera letra en mayúscula: "ese turno" pasa a ser "Ese turno".
 *
 * Para los textos que arrancan con algo que arma el vocabulario y que `words()` no trae ya
 * con mayúscula, como `w.ese("turno")` o `w.este("turno")`.
 */
export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
