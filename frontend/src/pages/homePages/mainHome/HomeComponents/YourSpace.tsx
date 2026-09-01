import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaCalendarDays,
  FaChartColumn,
  FaClipboardList,
  FaRegCalendarPlus,
  FaRegCircleCheck,
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
    {
      icon: FaRegCalendarPlus,
      title: "Pedir un turno",
      description: "Elegí especialidad, profesional y horario.",
      to: "/Appointment",
    },
    {
      icon: FaClipboardList,
      title: "Mis turnos",
      description: "Los que tenés agendados y los que ya pasaron.",
      to: "/AppointmentsList",
    },
    {
      icon: FaUserPen,
      title: "Mis datos",
      description: "Tu teléfono, tu mail y tu contraseña.",
      to: "/EditProfile",
    },
  ],
  professional: [
    {
      icon: FaClipboardList,
      title: "Turnos",
      description: "Tu agenda en grilla o en lista, con estado y paciente.",
      to: "/AppointmentsList",
    },
    {
      icon: FaCalendarDays,
      title: "Horarios",
      description: "Los módulos que atendés y cuánto dura cada turno.",
      to: "/scheduleProfessional",
    },
    {
      icon: FaUsers,
      title: "Pacientes",
      description: "Con cuenta y anónimos, con su historial.",
      to: "/Patients",
    },
    {
      icon: FaChartColumn,
      title: "Números",
      description: "Facturación, pacientes y carga de la agenda.",
      to: "/Analytics",
    },
  ],
  admin: [
    {
      icon: FaCalendarDays,
      title: "Horarios",
      description: "Agenda de cada profesional y ocupación de los consultorios.",
      to: "/scheduleProfessional",
    },
    {
      icon: FaUsers,
      title: "Usuarios",
      description: "Altas, ediciones y habilitación de cuentas.",
      to: "/AdminHome/UsersAdmin",
    },
    {
      icon: FaClipboardList,
      title: "Control",
      description: "Los turnos de un profesional, solo lectura.",
      to: "/AdminHome/Control",
    },
    {
      icon: FaChartColumn,
      title: "Números",
      description: "Facturación y carga, del consultorio y de cada uno.",
      to: "/AdminHome/Analytics",
    },
  ],
};

const STEPS = [
  { title: "Creá tu cuenta", description: "Con tu mail y tus datos. Una sola vez y en un minuto." },
  { title: "Elegí con quién", description: "Filtrá por especialidad y mirá la agenda de cada profesional." },
  { title: "Confirmá el horario", description: "El turno queda tomado y te llega el recordatorio por mail." },
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
        <p className="home-kicker">{accesses ? "Tu espacio" : "Cómo se pide un turno"}</p>
        <h2 className="home-section-title" id="home-space-title">
          {accesses ? "Todo lo tuyo, a un toque" : "Tres pasos y listo"}
        </h2>
        <p className="home-section-lead">
          {accesses
            ? "Los mismos accesos de tu panel, sin pasar por el menú."
            : "No hace falta llamar ni esperar a que abran: la agenda está disponible a cualquier hora."}
        </p>
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
            <p className="home-join-text">
              <FaRegCircleCheck aria-hidden="true" />
              Podés cancelar un turno desde la misma pantalla, hasta el día anterior.
            </p>
            <div className="home-actions">
              <Link className="home-btn home-btn-primary" to="/Register">
                <FaUserPlus aria-hidden="true" />
                Crear mi cuenta
              </Link>
              <Link className="home-btn home-btn-outline" to="/Login">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
