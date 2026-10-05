import { Link, useLocation } from "react-router-dom";
import { FaArrowRight, FaLeaf } from "react-icons/fa6";
import { getDecodedToken } from "../commonServices";
import { currentPolicies, currentWords, useWords } from "../../lib/installation";
import "./NotFoundPage.css";

interface Suggestion {
  label: string;
  description: string;
  to: string;
}

function common(): Suggestion[] {
  const w = currentWords();

  return [
    { label: "Inicio", description: `Portada ${w.del("lugar")}.`, to: "/" },
    { label: "Contacto", description: "Para avisar de un link roto.", to: "/contacto" },
  ];
}

/** A dónde le sirve ir a cada uno. Perderse sin sesión no es lo mismo que perderse con una. */
function suggestionsFor(type: string | undefined): Suggestion[] {
  const w = currentWords();

  switch (type) {
    case "client":
      return [
        ...(currentPolicies().patientBooking
          ? [{ label: `Solicitar ${w.turno}`, description: `${w.Especialidad}, ${w.profesional} y horario.`, to: "/Appointment" }]
          : []),
        { label: `Mis ${w.turnos}`, description: `Próxim${w.os("turno")} y anteriores.`, to: "/AppointmentsList" },
        ...common(),
      ];
    case "professional":
      return [
        { label: `Panel ${w.del("profesional")}`, description: `${w.Turnos} del día y accesos.`, to: "/ProfessionalHome" },
        { label: w.Turnos, description: "Agenda en grilla o en lista.", to: "/AppointmentsList" },
        ...common(),
      ];
    case "admin":
      return [
        { label: "Panel de administración", description: "Horarios, usuarios, control y números.", to: "/AdminHome" },
        ...common(),
      ];
    default:
      return [
        { label: "Iniciar sesión", description: `Para ver o solicitar ${w.turnos}.`, to: "/Login" },
        ...common(),
      ];
  }
}

export function NotFoundPage() {
  const w = useWords();
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
        <p className="nf-text">{`El link puede estar desactualizado. ${w.Los("turno")} y los datos de la cuenta siguen intactos.`}</p>

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
