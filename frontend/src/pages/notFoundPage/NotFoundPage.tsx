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
  { label: "Inicio", description: "Portada del consultorio.", to: "/" },
  { label: "Contacto", description: "Para avisar de un link roto.", to: "/contacto" },
];

/** A dónde le sirve ir a cada uno. Perderse sin sesión no es lo mismo que perderse con una. */
function suggestionsFor(type: string | undefined): Suggestion[] {
  switch (type) {
    case "client":
      return [
        { label: "Solicitar turno", description: "Especialidad, profesional y horario.", to: "/Appointment" },
        { label: "Mis turnos", description: "Próximos y anteriores.", to: "/AppointmentsList" },
        ...COMMON,
      ];
    case "professional":
      return [
        { label: "Panel del profesional", description: "Turnos del día y accesos.", to: "/ProfessionalHome" },
        { label: "Turnos", description: "Agenda en grilla o en lista.", to: "/AppointmentsList" },
        ...COMMON,
      ];
    case "admin":
      return [
        { label: "Panel de administración", description: "Horarios, usuarios, control y números.", to: "/AdminHome" },
        ...COMMON,
      ];
    default:
      return [
        { label: "Iniciar sesión", description: "Para ver o solicitar turnos.", to: "/Login" },
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

        <h1 className="nf-title">Página no encontrada</h1>

        {/* Lo primero que se teme al ver un error es haber perdido algo: se dice que no. */}
        <p className="nf-text">El link puede estar desactualizado. Los turnos y los datos de la cuenta siguen intactos.</p>

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
