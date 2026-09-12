import { Link } from "react-router-dom";
import { FaAppleWhole, FaArrowRight, FaBookOpenReader, FaBrain, FaEarListen } from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Session } from "../Home";
import { useFadeIn } from "../useFadeIn";

interface SpecialityCard {
  name: string;
  icon: IconType;
  /** Tinte propio de la especialidad: es lo único que las distingue a simple vista. */
  tint: string;
}

/**
 * Las especialidades que se atienden. El nombre tiene que coincidir con `SPECIALITIES`,
 * que es lo que el pedido de turno usa para filtrar.
 *
 * Van sin descripción y el título no dice cuántas son: el consultorio pidió que la
 * portada no se comprometa con nada que cambie cuando se sume o se vaya una.
 */
const CARDS: SpecialityCard[] = [
  { name: "Psicopedagogía", icon: FaBookOpenReader, tint: "#5d7f3f" },
  { name: "Psicología", icon: FaBrain, tint: "#2f6f6b" },
  { name: "Nutrición", icon: FaAppleWhole, tint: "#a8763a" },
  { name: "Fonoaudiología", icon: FaEarListen, tint: "#6b5a8e" },
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
        <h2 className="home-section-title" id="home-specialities-title">
          Especialidades
        </h2>
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
              <span className="home-photo" aria-hidden="true">
                <Icon />
              </span>

              <span className="home-card-body">
                <span className="home-card-title">{card.name}</span>
                <span className="home-card-cta">
                  Ver horarios
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
