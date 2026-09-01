import { ChooseProfessional } from "../../../features/ChooseProfessional";

/**
 * El mismo pedido de turno, pero empujado sobre la pila: así lo abre el profesional, que
 * no tiene esta pantalla en la barra de abajo. El encabezado lo pone el navegador.
 */
export default function BookScreen() {
  return <ChooseProfessional />;
}
