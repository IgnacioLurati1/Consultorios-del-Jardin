/** "14/09" alcanza dentro de un renglón que ya dice de qué se trata. */
export function shortDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
