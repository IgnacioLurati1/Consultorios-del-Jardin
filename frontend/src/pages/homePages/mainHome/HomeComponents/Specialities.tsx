import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Session } from "../Home";
import { useFadeIn } from "../useFadeIn";
import { imageUrl, useHomeVariant, useInstallation, usePolicies, useWords, type SpecialityStyle } from "../../../../lib/installation";
import { SPECIALITY_TINTS, iconOf, suggestIcon } from "../../../../lib/specialityIcons";

interface SpecialityCard {
  name: string;
  icon: IconType;
  /** La foto que subió el consultorio, si subió una. Si no, va el ícono sobre el tinte. */
  imageId: string | null;
  /** Tinte propio de la especialidad: es lo único que las distingue a simple vista. */
  tint: string;
  /** A dónde lleva tocarla. */
  to: string;
}

/**
 * Cómo se ve cada especialidad.
 *
 * Qué especialidades se muestran lo decide la configuración del consultorio (ver
 * `services` en lib/installation), que es la misma lista que usa el pedido de turno para
 * filtrar. El ícono es el que eligió el consultorio o, si no eligió, el que sugiere el
 * nombre; el tinte va por orden. Con las de Consultorios del Jardín da los mismos íconos y
 * tintes que tenía escritos esta pantalla.
 *
 * Van sin descripción y el título no dice cuántas son: el consultorio pidió que la
 * portada no se comprometa con nada que cambie cuando se sume o se vaya una.
 */
function cardOf(name: string, index: number, style: SpecialityStyle | undefined, to: string): SpecialityCard {
  return {
    name,
    icon: iconOf(style?.icon ?? suggestIcon(name)),
    imageId: style?.imageId ?? null,
    tint: SPECIALITY_TINTS[index % SPECIALITY_TINTS.length],
    to,
  };
}

interface SpecialitiesProps {
  session: Session;
}

/**
 * Las especialidades, en uno de tres diseños (ver HOME_VARIANTS en lib/installation):
 *
 * - **Tarjetas**: un bloque de color o la foto arriba y el nombre abajo. El de siempre.
 * - **Lista**: renglones en columnas, con el ícono chico. Con muchas especialidades es el
 *   que menos lugar ocupa.
 * - **Mosaico**: la foto o el color ocupan toda la pieza y el nombre va encima. La
 *   primera, más grande. Luce con fotos subidas.
 */
export function Specialities({ session }: SpecialitiesProps) {
  const w = useWords();
  const policies = usePolicies();
  const variant = useHomeVariant("services");
  const reveal = useFadeIn<HTMLElement>();
  const installation = useInstallation();

  // Pedir turno pide sesión: mandarlo al buscador para que rebote al login sería
  // hacerle perder un paso.
  const guest = session.type === "guest";
  const linkFor = (name: string) =>
    guest ? "/Login" : policies.patientBooking ? `/Appointment?especialidad=${encodeURIComponent(name)}` : "/contacto";
  const cards = installation.services.map((name, index) => cardOf(name, index, installation.specialityStyles[name], linkFor(name)));

  // Sin especialidades cargadas, un título solo encima de nada: el bloque no se dibuja.
  if (cards.length === 0) return null;

  return (
    <section
      ref={reveal.ref}
      className={`home-section home-specialities home-specialities--${variant} ${reveal.isVisible ? "is-visible" : ""}`}
      aria-labelledby="home-specialities-title"
    >
      <div className="home-section-head">
        <h2 className="home-section-title" id="home-specialities-title">
          {w.Especialidades}
        </h2>
      </div>

      {variant === "list" ? <SpecialityList cards={cards} /> : variant === "mosaic" ? <SpecialityMosaic cards={cards} /> : <SpecialityCards cards={cards} />}
    </section>
  );
}

function SpecialityCards({ cards }: { cards: SpecialityCard[] }) {
  return (
    <div className="home-cards">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.name}
            className="home-card"
            style={{ "--tint": card.tint, "--delay": `${index * 90}ms` } as React.CSSProperties}
            to={card.to}
          >
            <span className="home-photo" aria-hidden="true">
              {card.imageId ? <img src={imageUrl(card.imageId, "small")} alt="" loading="lazy" /> : <Icon />}
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
  );
}

function SpecialityList({ cards }: { cards: SpecialityCard[] }) {
  return (
    <ul className="home-spec-list">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <li key={card.name} style={{ "--tint": card.tint, "--delay": `${index * 60}ms` } as React.CSSProperties}>
            <Link className="home-spec-row" to={card.to}>
              <span className="home-spec-dot" aria-hidden="true">
                {card.imageId ? <img src={imageUrl(card.imageId, "small")} alt="" loading="lazy" /> : <Icon />}
              </span>
              <span className="home-spec-name">{card.name}</span>
              <span className="home-spec-cta">
                Ver horarios
                <FaArrowRight aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SpecialityMosaic({ cards }: { cards: SpecialityCard[] }) {
  return (
    <div className={`home-tiles ${cards.length >= 3 ? "has-feature" : ""}`}>
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.name}
            className="home-tile"
            style={{ "--tint": card.tint, "--delay": `${index * 80}ms` } as React.CSSProperties}
            to={card.to}
          >
            <span className="home-tile-media" aria-hidden="true">
              {card.imageId ? <img src={imageUrl(card.imageId, "large")} alt="" loading="lazy" /> : <Icon />}
            </span>
            <span className="home-tile-body">
              <span className="home-tile-title">{card.name}</span>
              <span className="home-tile-cta">
                Ver horarios
                <FaArrowRight aria-hidden="true" />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
