import { useLocalSearchParams } from "expo-router";
import { ChooseProfessional } from "../../../features/ChooseProfessional";
import { SPECIALITIES, sameSpeciality } from "../../../lib/specialities";

/**
 * El mismo pedido de turno, pero empujado sobre la pila: así lo abre el profesional, que
 * no tiene esta pantalla en la barra de abajo. El encabezado lo pone el navegador.
 *
 * Acepta `?especialidad=` igual que la pestaña del paciente: desde las especialidades de
 * la pestaña Consultorio se llega con una ya elegida.
 */
export default function BookScreen() {
  const { especialidad } = useLocalSearchParams<{ especialidad?: string }>();
  const initial = SPECIALITIES.find((item) => sameSpeciality(item, especialidad));

  return <ChooseProfessional initialSpeciality={initial} />;
}
