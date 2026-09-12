import { FaArrowRight, FaLocationDot } from "react-icons/fa6";
import { useFadeIn } from "../useFadeIn";

/** El mapa de Google con la dirección del consultorio, tal como lo pasó el cliente. */
const MAP_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3348.1345729661225!2d-60.677700222686624!3d-32.947456271932246!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b7aca0aae14deb%3A0x8faaf2cd4420949f!2s9%20de%20Julio%203672%2C%20S2000%20Rosario%2C%20Santa%20Fe!5e0!3m2!1ses!2sar!4v1789172471192!5m2!1ses!2sar";

/** El recorrido hasta la puerta, en la aplicación de mapas de quien lo toca. */
const DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=9+de+Julio+3672,+Rosario,+Santa+Fe";

/**
 * Dónde queda, al pie de la portada y justo antes del pie de página.
 *
 * Va en una franja de otro color, del ancho de la página, para que el mapa no quede
 * flotando suelto sobre el mismo fondo que las secciones de arriba.
 *
 * Solo la dirección, sin horario: el consultorio lo pidió así.
 *
 * `loading="lazy"`: el mapa pesa bastante más que el resto de la portada y queda al
 * final, así que se pide recién cuando alguien baja hasta acá.
 */
export function Location() {
  const reveal = useFadeIn<HTMLElement>();

  return (
    <div className="home-location-band">
      <section
        ref={reveal.ref}
        className={`home-section home-location ${reveal.isVisible ? "is-visible" : ""}`}
        aria-labelledby="home-location-title"
      >
        <div className="home-location-head">
          <h2 className="home-section-title" id="home-location-title">
            Ubicación
          </h2>

          <p className="home-location-address">
            <FaLocationDot aria-hidden="true" />
            9 de Julio 3672, Rosario
          </p>

          <a className="home-btn home-btn-outline home-location-link" href={DIRECTIONS_URL} target="_blank" rel="noreferrer">
            Cómo llegar
            <FaArrowRight aria-hidden="true" />
          </a>
        </div>

        <iframe
          className="home-map"
          src={MAP_URL}
          title="Mapa de 9 de Julio 3672, Rosario"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </section>
    </div>
  );
}
