import { Link, useLocation } from "react-router-dom";
import { FaArrowRight, FaLeaf } from "react-icons/fa6";
import { getDecodedToken } from "../commonServices";
import "./NotFoundPage.css";

interface Suggestion {
  label: string;
  description: string;
  to: string;
}

const COMMON: Suggestion[] = [
  { label: "Inicio", description: "La portada del consultorio.", to: "/" },
  { label: "Escribinos", description: "Si llegaste acá desde un link nuestro, contanos.", to: "/contacto" },
];

/** A dónde le sirve ir a cada uno. Perderse sin sesión no es lo mismo que perderse con una. */
function suggestionsFor(type: string | undefined): Suggestion[] {
  switch (type) {
    case "client":
      return [
        { label: "Pedir un turno", description: "Elegí especialidad, profesional y horario.", to: "/Appointment" },
        { label: "Mis turnos", description: "Los que tenés agendados y los que ya pasaron.", to: "/AppointmentsList" },
        ...COMMON,
      ];
    case "professional":
      return [
        { label: "Mi panel", description: "Los turnos de hoy y tus accesos.", to: "/ProfessionalHome" },
        { label: "Turnos", description: "Tu agenda en grilla o en lista.", to: "/AppointmentsList" },
        ...COMMON,
      ];
    case "admin":
      return [
        { label: "Panel de administración", description: "Horarios, usuarios, control y números.", to: "/AdminHome" },
        ...COMMON,
      ];
    default:
      return [
        { label: "Iniciar sesión", description: "Para ver tus turnos o pedir uno nuevo.", to: "/Login" },
        ...COMMON,
      ];
  }
}

export function NotFoundPage() {
  const location = useLocation();
  const decoded = getDecodedToken();
  const suggestions = suggestionsFor(decoded?.type);

  return (
    <div className="nf-page">
      <div className="nf-card">
        <p className="nf-code" aria-hidden="true">
          404
        </p>

        <h1 className="nf-title">Esta página no existe</h1>

        <p className="nf-text">
          Puede que el link esté viejo o que hayamos movido algo de lugar. Nada de lo tuyo se perdió: seguís
          teniendo tus turnos y tus datos donde estaban.
        </p>

        {/* Decir qué se pidió ayuda a darse cuenta de un error de tipeo en la barra. */}
        <p className="nf-path">
          <FaLeaf aria-hidden="true" />
          <code>{location.pathname}</code>
        </p>

        <ul className="nf-links">
          {suggestions.map((item) => (
            <li key={item.to}>
              <Link className="nf-link" to={item.to}>
                <span>
                  <span className="nf-link-label">{item.label}</span>
                  <span className="nf-link-desc">{item.description}</span>
                </span>
                <FaArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
