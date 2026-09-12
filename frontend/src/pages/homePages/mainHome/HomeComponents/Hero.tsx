import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";
import { BrandLeaves } from "../../../../components/brand/BrandLeaves";
import type { Session } from "../Home";
import pasilloMural from "../../../../assets/collage/pasillo-mural.webp";
import pasilloMuralLarge from "../../../../assets/collage/pasillo-mural-960.webp";
import recepcion from "../../../../assets/collage/recepcion.webp";
import recepcionLarge from "../../../../assets/collage/recepcion-960.webp";
import consultorio from "../../../../assets/collage/consultorio.webp";
import consultorioLarge from "../../../../assets/collage/consultorio-960.webp";
import patioVidriado from "../../../../assets/collage/patio-vidriado.webp";
import patioVidriadoLarge from "../../../../assets/collage/patio-vidriado-960.webp";
import jardinNoche from "../../../../assets/collage/jardin-noche.webp";
import jardinNocheLarge from "../../../../assets/collage/jardin-noche-960.webp";

/**
 * Las fotos del consultorio, en el orden en que se lo recorre: la entrada, la recepción,
 * un consultorio, la sala bajo el techo vidriado y el jardín.
 *
 * Cada una en dos tamaños. En la computadora son tiras de un quinto de pantalla y alcanza
 * la de 640; en el celular van de a una y a todo el ancho, y ahí la de 640 se ve blanda.
 * El navegador elige con `srcSet` y `sizes`, así la computadora no baja las grandes.
 */
const PHOTOS = [
  { src: pasilloMural, large: pasilloMuralLarge },
  { src: recepcion, large: recepcionLarge },
  { src: consultorio, large: consultorioLarge },
  { src: patioVidriado, large: patioVidriadoLarge },
  { src: jardinNoche, large: jardinNocheLarge },
];

/** Hasta este ancho las fotos van de a una, con fundido. Tiene que coincidir con Home.css. */
const PHONE = "(max-width: 700px)";
/** Cuánto queda cada foto antes de pasar a la siguiente. */
const SLIDE_MS = 5000;

interface Action {
  label: string;
  to: string;
}

/** Los dos accesos de cada uno, debajo de las fotos: el primero es el principal. */
const ACTIONS: Record<Session["type"], [Action, Action]> = {
  guest: [
    { label: "Crear cuenta", to: "/Register" },
    { label: "Iniciar sesión", to: "/Login" },
  ],
  client: [
    { label: "Solicitar turno", to: "/Appointment" },
    { label: "Mis turnos", to: "/AppointmentsList" },
  ],
  professional: [
    { label: "Panel del profesional", to: "/ProfessionalHome" },
    { label: "Turnos", to: "/AppointmentsList" },
  ],
  admin: [
    { label: "Panel de administración", to: "/AdminHome" },
    { label: "Números del consultorio", to: "/AdminHome/Analytics" },
  ],
};

/**
 * En el celular las fotos pasan de a una con un fundido: en tiras de un tercio de
 * pantalla no se entendía ninguna. Devuelve la que se ve y la que se está yendo, que se
 * queda debajo hasta que la nueva termina de aparecer (si se apagaran las dos a la vez,
 * a mitad del fundido se vería el fondo).
 *
 * En la computadora no corre nada: ahí se ven todas juntas. Con "reducir movimiento"
 * tampoco, y queda la primera.
 */
function useSlideshow(count: number) {
  const [slide, setSlide] = useState({ current: 0, leaving: -1 });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const phone = window.matchMedia(PHONE);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;

    function update() {
      window.clearInterval(timer);
      timer = undefined;
      if (!phone.matches || still.matches) return;

      timer = window.setInterval(() => {
        setSlide(({ current }) => ({ current: (current + 1) % count, leaving: current }));
      }, SLIDE_MS);
    }

    update();
    phone.addEventListener("change", update);
    still.addEventListener("change", update);
    return () => {
      window.clearInterval(timer);
      phone.removeEventListener("change", update);
      still.removeEventListener("change", update);
    };
  }, [count]);

  return slide;
}

interface HeroProps {
  session: Session;
}

/**
 * La portada: el consultorio en fotos, con el nombre abajo, y los accesos de cada uno.
 *
 * Las fotos quedan quietas y la página sube por encima al bajar. No es un
 * `background-attachment: fixed`, que el Safari del celular ignora: las fotos van en una
 * capa `position: fixed` y la sección las recorta con `clip-path`, que sí recorta a lo que
 * está fijo adentro. Ver `.home-hero` en Home.css.
 */
export function Hero({ session }: HeroProps) {
  const [primary, secondary] = ACTIONS[session.type];
  const slide = useSlideshow(PHOTOS.length);

  return (
    <>
      <section className="home-hero" aria-labelledby="home-wordmark">
        <div className="home-hero-stage">
          {/* Decorativas: el nombre del consultorio está en el título de abajo. */}
          <div className="home-collage" aria-hidden="true">
            {PHOTOS.map((photo, index) => (
              <img
                key={photo.src}
                src={photo.src}
                srcSet={`${photo.src} 640w, ${photo.large} 960w`}
                sizes={`${PHONE} 100vw, 20vw`}
                alt=""
                className={index === slide.current ? "is-active" : index === slide.leaving ? "is-leaving" : undefined}
                decoding="async"
              />
            ))}
          </div>
          <div className="home-vignette" aria-hidden="true" />

          <Wordmark />
        </div>
      </section>

      <section className="home-intro">
        <div className="home-intro-inner">
          {session.type === "guest" && (
            <p className="home-intro-lead">Turnos online, con elección de profesional y horario.</p>
          )}

          <div className="home-actions adm-btn-row">
            <Link className="home-btn home-btn-primary" to={primary.to}>
              {primary.label}
              <FaArrowRight aria-hidden="true" />
            </Link>
            <Link className="home-btn home-btn-ghost" to={secondary.to}>
              {secondary.label}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * El nombre, con las hojas del logo encima de la "i" y la "n" de "Jardín".
 *
 * Las hojas hacen de tilde, así que la "i" es la sin punto (ı): con la común quedarían el
 * punto y las hojas una encima de la otra. Eso deja escrito "Jardın", que un lector de
 * pantalla o un buscador leerían mal; por eso lo dibujado va escondido y al lado va el
 * nombre bien escrito, invisible.
 */
function Wordmark() {
  return (
    <h1 className="home-wordmark" id="home-wordmark">
      <span className="home-sr-only">Consultorios del Jardín</span>
      <span aria-hidden="true">
        Consultorios del Jard
        <span className="home-wordmark-accent">
          ın
          <BrandLeaves className="home-wordmark-leaves" />
        </span>
      </span>
    </h1>
  );
}
