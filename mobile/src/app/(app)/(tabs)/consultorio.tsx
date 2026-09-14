import { PatientHome } from "../../../features/PatientHome";

/**
 * El consultorio en fotos, para el profesional y el admin: el mismo inicio que ve el
 * paciente, en su propia pestaña. Su Inicio sigue siendo el de trabajo; esto es el lugar.
 *
 * Al paciente no se le muestra en la barra porque ya es su Inicio.
 */
export default function PlaceTab() {
  return <PatientHome />;
}
