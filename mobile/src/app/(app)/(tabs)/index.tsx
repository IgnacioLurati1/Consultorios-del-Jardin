import { PatientHome } from "../../../features/PatientHome";

/**
 * Inicio: el consultorio en fotos, con una tarjeta encima. Es el mismo para los tres roles
 * y lo que cambia es la tarjeta (ver PatientHome). Lo de todos los días del profesional y
 * del admin está en Panel.
 */
export default function HomeScreen() {
  return <PatientHome />;
}
