import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaCalendarDays,
  FaChartColumn,
  FaClipboardList,
  FaRegCalendarPlus,
  FaUserPen,
  FaUserPlus,
  FaUsers,
} from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Session } from "../Home";
import { useFadeIn } from "../useFadeIn";

interface Access {
  icon: IconType;
  title: string;
  description: string;
  to: string;
}

/**
 * Los accesos de cada rol. Son los mismos destinos que ofrece el panel de cada uno:
 * la portada no agrega funciones, acorta el camino a las que ya existen.
 */
const ACCESSES: Record<string, Access[]> = {
  client: [
    { icon: FaRegCalendarPlus, title: "Solicitar turno", description: "Especialidad, profesional y horario.", to: "/Appointment" },
    { icon: FaClipboardList, title: "Mis turnos", description: "Próximos y anteriores.", to: "/AppointmentsList" },
    { icon: FaUserPen, title: "Mis datos", description: "Nombre, teléfono y documento.", to: "/EditProfile" },
  ],
  professional: [
    { icon: FaClipboardList, title: "Turnos", description: "Agenda en grilla o en lista.", to: "/AppointmentsList" },
    { icon: FaCalendarDays, title: "Horarios", description: "Módulos de atención y duración de los turnos.", to: "/scheduleProfessional" },
    { icon: FaUsers, title: "Pacientes", description: "Historial de cada paciente.", to: "/Patients" },
    { icon: FaChartColumn, title: "Números", description: "Facturación y carga de la agenda.", to: "/Analytics" },
  ],
  admin: [
    { icon: FaCalendarDays, title: "Horarios", description: "Agendas y ocupación de los consultorios.", to: "/scheduleProfessional" },
    { icon: FaUsers, title: "Usuarios", description: "Altas, ediciones y habilitación de cuentas.", to: "/AdminHome/UsersAdmin" },
    { icon: FaClipboardList, title: "Control", description: "Turnos de cada profesional.", to: "/AdminHome/Control" },
    { icon: FaChartColumn, title: "Números", description: "Facturación y carga del consultorio.", to: "/AdminHome/Analytics" },
  ],
};

/** Un proceso de verdad, en orden: por eso van numerados. */
const STEPS = [
  { title: "Crear una cuenta", description: "Con mail y datos personales." },
  { title: "Elegir especialidad o profesional", description: "Con los horarios disponibles de cada agenda." },
  { title: "Confirmar el horario", description: "Con recordatorio por mail el día anterior." },
];

interface YourSpaceProps {
  session: Session;
}

export function YourSpace({ session }: YourSpaceProps) {
  const reveal = useFadeIn<HTMLElement>();
  const accesses = ACCESSES[session.type];

  return (
    <section
      ref={reveal.ref}
      className={`home-section home-space ${reveal.isVisible ? "is-visible" : ""}`}
      aria-labelledby="home-space-title"
    >
      <div className="home-section-head">
        <h2 className="home-section-title" id="home-space-title">
          {accesses ? "Accesos directos" : "Cómo solicitar un turno"}
        </h2>
      </div>

      {accesses ? (
        <div className="home-access-grid">
          {accesses.map((access, index) => {
            const Icon = access.icon;

            return (
              <Link
                key={access.title}
                className="home-access"
                to={access.to}
                style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}
              >
                <span className="home-access-icon">
                  <Icon />
                </span>
                <span className="home-access-title">{access.title}</span>
                <span className="home-access-desc">{access.description}</span>
                <FaArrowRight className="home-access-arrow" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <>
          <ol className="home-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="home-step" style={{ "--delay": `${index * 110}ms` } as React.CSSProperties}>
                <span className="home-step-number">{index + 1}</span>
                <span className="home-step-title">{step.title}</span>
                <span className="home-step-desc">{step.description}</span>
              </li>
            ))}
          </ol>

          <div className="home-join">
            <div className="home-actions adm-btn-row">
              <Link className="home-btn home-btn-primary-light" to="/Register">
                <FaUserPlus aria-hidden="true" />
                Crear cuenta
              </Link>
              <Link className="home-btn home-btn-outline" to="/Login">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
