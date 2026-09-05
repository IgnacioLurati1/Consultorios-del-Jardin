import { Link } from "react-router-dom";
import { FaAppleWhole, FaArrowRight, FaBookOpenReader, FaBrain, FaEarListen } from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Session } from "../Home";
import { useFadeIn } from "../useFadeIn";

interface SpecialityCard {
  name: string;
  description: string;
  icon: IconType;
  /** Tinte propio de la especialidad: es lo único que las distingue a simple vista. */
  tint: string;
}

/**
 * Las cuatro que se atienden. El nombre tiene que coincidir con `SPECIALITIES`, que es
 * lo que el pedido de turno usa para filtrar profesionales.
 */
const CARDS: SpecialityCard[] = [
  {
    name: "Psicopedagogía",
    description: "Aprendizaje, atención y acompañamiento escolar, de la primaria en adelante.",
    icon: FaBookOpenReader,
    tint: "#5d7f3f",
  },
  {
    name: "Psicología",
    description: "Terapia individual para adolescentes y adultos, con turnos fijos si hacen falta.",
    icon: FaBrain,
    tint: "#2f6f6b",
  },
  {
    name: "Nutrición",
    description: "Planes de alimentación y seguimiento sostenido, sin dietas de manual.",
    icon: FaAppleWhole,
    tint: "#a8763a",
  },
  {
    name: "Fonoaudiología",
    description: "Voz, habla y deglución, en chicos y en grandes.",
    icon: FaEarListen,
    tint: "#6b5a8e",
  },
];

interface SpecialitiesProps {
  session: Session;
}

export function Specialities({ session }: SpecialitiesProps) {
  const reveal = useFadeIn<HTMLElement>();

  // Pedir turno pide sesión: mandarlo al buscador para que rebote al login sería
  // hacerle perder un paso.
  const guest = session.type === "guest";

  return (
    <section
      ref={reveal.ref}
      className={`home-section home-specialities ${reveal.isVisible ? "is-visible" : ""}`}
      aria-labelledby="home-specialities-title"
    >
      <div className="home-section-head">
        <p className="home-kicker">Qué se atiende</p>
        <h2 className="home-section-title" id="home-specialities-title">
          Cuatro especialidades, un solo consultorio
        </h2>
        <p className="home-section-lead">
          Cada profesional tiene su propia agenda y sus horarios cargados, y todas las especialidades comparten el
          mismo consultorio. Los turnos quedan siempre en la misma lista.
        </p>
      </div>

      <div className="home-cards">
        {CARDS.map((card, index) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.name}
              className="home-card"
              style={{ "--tint": card.tint, "--delay": `${index * 90}ms` } as React.CSSProperties}
              to={guest ? "/Login" : `/Appointment?especialidad=${encodeURIComponent(card.name)}`}
            >
              {/* Marcador de foto: cuando haya imágenes del consultorio, va un <img> acá. */}
              <span className="home-photo" role="img" aria-label={`Foto de ${card.name} pendiente`}>
                <Icon />
                <span className="home-photo-tag">Foto</span>
              </span>

              <span className="home-card-body">
                <span className="home-card-title">{card.name}</span>
                <span className="home-card-desc">{card.description}</span>
                <span className="home-card-cta">
                  {guest ? "Ingresar para ver horarios" : "Ver horarios libres"}
                  <FaArrowRight aria-hidden="true" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
