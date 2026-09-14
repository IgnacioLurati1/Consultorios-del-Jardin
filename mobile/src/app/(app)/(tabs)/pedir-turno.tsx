import { useLocalSearchParams } from "expo-router";
import { ChooseProfessional } from "../../../features/ChooseProfessional";
import { SPECIALITIES, sameSpeciality } from "../../../lib/specialities";

/**
 * La pestaña del paciente. Es la misma pantalla que ve el profesional desde Más.
 *
 * Desde las especialidades de Inicio se llega con `?especialidad=`. Solo vale una de la
 * lista: cualquier otra cosa en la dirección se ignora.
 */
export default function BookTab() {
  const { especialidad } = useLocalSearchParams<{ especialidad?: string }>();
  const initial = SPECIALITIES.find((item) => sameSpeciality(item, especialidad));

  return <ChooseProfessional standalone initialSpeciality={initial} />;
}
