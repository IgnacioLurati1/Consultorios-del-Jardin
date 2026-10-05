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
import { useHomeVariant, usePolicies, useWords } from "../../../../lib/installation";
import type { Policies } from "../../../../lib/policies";
import type { Words } from "../../../../lib/vocabulary";

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
const accessesFor = (w: Words): Record<string, Access[]> => ({
  client: [
    {
      icon: FaRegCalendarPlus,
      title: `Solicitar ${w.turno}`,
      description: `${w.Especialidad}, ${w.profesional} y horario.`,
      to: "/Appointment",
    },
    { icon: FaClipboardList, title: `Mis ${w.turnos}`, description: `Próxim${w.os("turno")} y anteriores.`, to: "/AppointmentsList" },
    { icon: FaUserPen, title: "Mis datos", description: "Nombre, teléfono y documento.", to: "/EditProfile" },
  ],
  professional: [
    { icon: FaClipboardList, title: w.Turnos, description: "Agenda en grilla o en lista.", to: "/AppointmentsList" },
    {
      icon: FaCalendarDays,
      title: "Horarios",
      description: `Módulos de atención y duración de ${w.los("turno")}.`,
      to: "/scheduleProfessional",
    },
    { icon: FaUsers, title: w.Pacientes, description: `Historial de cada ${w.paciente}.`, to: "/Patients" },
    { icon: FaChartColumn, title: "Números", description: "Facturación y carga de la agenda.", to: "/Analytics" },
  ],
  admin: [
    {
      icon: FaCalendarDays,
      title: "Horarios",
      description: `Agendas y ocupación de ${w.los("sala")}.`,
      to: "/scheduleProfessional",
    },
    { icon: FaUsers, title: "Usuarios", description: "Altas, ediciones y habilitación de cuentas.", to: "/AdminHome/UsersAdmin" },
    { icon: FaClipboardList, title: "Control", description: `${w.Turnos} de cada ${w.profesional}.`, to: "/AdminHome/Control" },
    { icon: FaChartColumn, title: "Números", description: `Facturación y carga ${w.del("lugar")}.`, to: "/AdminHome/Analytics" },
  ],
});

/** Un proceso de verdad, en orden: por eso van numerados. */
const stepsFor = (w: Words, p: Policies) =>
  p.patientBooking
    ? [
        { title: "Crear una cuenta", description: "Con mail y datos personales." },
        { title: `Elegir ${w.especialidad} o ${w.profesional}`, description: "Con los horarios disponibles de cada agenda." },
        {
          title: "Confirmar el horario",
          description: p.reminders ? "Con recordatorio por mail el día anterior." : "Con la confirmación por mail.",
        },
      ]
    : // Donde los turnos se piden al consultorio, la cuenta sirve para verlos y recibir los avisos.
      [
        { title: `Pedir ${w.el("turno")} ${w.al("lugar")}`, description: "Con los datos de contacto de esta página." },
        { title: "Crear una cuenta", description: `Con el mismo mail que se dio ${w.al("lugar")}.` },
        { title: `Seguir ${w.los("turno")}`, description: "Con los avisos por mail y la lista en la cuenta." },
      ];

interface YourSpaceProps {
  session: Session;
}

/**
 * Los accesos de quien tiene cuenta, o los pasos para quien no la tiene, en uno de tres
 * diseños (ver HOME_VARIANTS en lib/installation): tarjetas, el de siempre; lista, un
 * renglón debajo del otro; y franja, sobre el color de la marca de lado a lado. Cambia
 * cómo se ve, no qué se ofrece.
 */
export function YourSpace({ session }: YourSpaceProps) {
  const w = useWords();
  const policies = usePolicies();
  const variant = useHomeVariant("yourSpace");
  const reveal = useFadeIn<HTMLElement>();
  const accesses = accessesFor(w)[session.type]?.filter((access) => access.to !== "/Appointment" || policies.patientBooking);

  // data-nosnippet: Google armaba la descripción del resultado con los pasos y, como número,
  // título y texto son spans pegados, salía "1Crear una cuentaCon mail...". Así usa la
  // descripción de seo.json.
  const section = (
    <section
      ref={reveal.ref}
      className={`home-section home-space home-space--${variant} ${reveal.isVisible ? "is-visible" : ""}`}
      aria-labelledby="home-space-title"
      data-nosnippet=""
    >
      <div className="home-section-head">
        <h2 className="home-section-title" id="home-space-title">
          {accesses ? "Accesos directos" : `Cómo solicitar ${w.un("turno")}`}
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
            {stepsFor(w, policies).map((step, index) => (
              <li key={step.title} className="home-step" style={{ "--delay": `${index * 110}ms` } as React.CSSProperties}>
                <span className="home-step-number">{index + 1}</span>
                <span className="home-step-title">{step.title}</span>
                <span className="home-step-desc">{step.description}</span>
              </li>
            ))}
          </ol>

          <div className="home-join">
            <div className="home-actions adm-btn-row">
              {/* Sobre la franja de color van los botones del fondo oscuro. */}
              <Link className={`home-btn ${variant === "band" ? "home-btn-primary" : "home-btn-primary-light"}`} to="/Register">
                <FaUserPlus aria-hidden="true" />
                Crear cuenta
              </Link>
              <Link className={`home-btn ${variant === "band" ? "home-btn-ghost" : "home-btn-outline"}`} to="/Login">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );

  // La franja va de lado a lado, como la de la galería y la del mapa.
  return variant === "band" ? <div className="home-space-band">{section}</div> : section;
}
