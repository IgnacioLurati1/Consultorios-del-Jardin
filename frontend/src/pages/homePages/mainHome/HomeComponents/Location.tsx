import { useState, type ReactNode } from "react";
import { FaArrowRight, FaClock, FaLocationDot } from "react-icons/fa6";
import { useFadeIn } from "../useFadeIn";
import {
  directionsOf,
  fullAddress,
  hasBranches,
  mapEmbedOf,
  useHomeVariant,
  useInstallation,
  useWords,
  type HomeVariants,
} from "../../../../lib/installation";
import {
  branchDirections,
  branchHours,
  branchMapEmbed,
  branchPlace,
} from "../../../adminCRUDS/adminOffices/branches.ts";

/**
 * Dónde queda, al pie de la portada y justo antes del pie de página.
 *
 * Va en una franja de otro color, del ancho de la página, para que el mapa no quede
 * flotando suelto sobre el mismo fondo que las secciones de arriba.
 *
 * Solo la dirección, sin horario: el consultorio lo pidió así.
 *
 * El mapa y el link de cómo llegar salen de la configuración. El que pegó el consultorio
 * desde Google Maps marca su puerta exacta; sin eso se arma uno con la dirección.
 *
 * Con varias sucursales (regla multiBranch) la dirección única se cambia por la lista de
 * sucursales, cada una con su calle, su ciudad y su horario. Tocar una lleva el mapa y el
 * "Cómo llegar" a esa.
 *
 * Tres diseños (ver HOME_VARIANTS en lib/installation): el mapa abajo, el de siempre; lado
 * a lado, los datos a la izquierda y el mapa a la derecha; y sobre el mapa, que ocupa la
 * franja entera con los datos en una tarjeta encima.
 *
 * `loading="lazy"`: el mapa pesa bastante más que el resto de la portada y queda al
 * final, así que se pide recién cuando alguien baja hasta acá.
 */
export function Location() {
  const reveal = useFadeIn<HTMLElement>();
  const installation = useInstallation();
  const variant = useHomeVariant("location");
  const w = useWords();
  const address = fullAddress(installation);
  /** La sucursal que muestra el mapa, por su número. Arranca en la primera. */
  const [pickedId, setPickedId] = useState<number | null>(null);

  const branches = hasBranches(installation) ? installation.branches : [];
  const picked = branches.find((branch) => branch.id === pickedId) ?? branches[0];

  if (picked) {
    // Una sucursal sin calle usa la dirección general. Sin ninguna de las dos no hay qué
    // mostrar en el mapa, y un mapa que busca nada se ve roto.
    const mappable = !!picked.address || !!installation.address;
    const place = branchPlace(picked, installation);

    return (
      <LocationLayout
        variant={variant}
        reveal={reveal}
        map={
          mappable ? (
            <iframe
              className="home-map"
              src={branchMapEmbed(picked, installation)}
              title={`Mapa de ${place}`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : null
        }
      >
        <div className="home-location-head">
          <h2 className="home-section-title" id="home-location-title">
            {w.Sucursales}
          </h2>

          {mappable && (
            <a
              className="home-btn home-btn-outline home-location-link"
              href={branchDirections(picked, installation)}
              target="_blank"
              rel="noreferrer"
            >
              {`Cómo llegar a ${picked.name}`}
              <FaArrowRight aria-hidden="true" />
            </a>
          )}
        </div>

        <ul className="home-branches">
          {branches.map((branch) => {
            const active = branch.id === picked.id;
            const hours = branchHours(branch);

            return (
              <li key={branch.id}>
                <button
                  type="button"
                  className={`home-branch ${active ? "active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setPickedId(branch.id)}
                >
                  <span className="home-branch-name">{branch.name}</span>
                  <span className="home-branch-line">
                    <FaLocationDot aria-hidden="true" />
                    {branchPlace(branch, installation)}
                  </span>
                  {hours && (
                    <span className="home-branch-line">
                      <FaClock aria-hidden="true" />
                      {hours}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </LocationLayout>
    );
  }

  // Una instalación nueva nace sin dirección. Hasta que la carguen, un mapa que busca nada
  // y un "Cómo llegar" a ninguna parte se ven rotos: el bloque no se dibuja.
  if (!installation.address) return null;

  return (
    <LocationLayout
      variant={variant}
      reveal={reveal}
      map={
        <iframe
          className="home-map"
          src={mapEmbedOf(installation)}
          title={`Mapa de ${address}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      }
    >
      <div className="home-location-head">
        <h2 className="home-section-title" id="home-location-title">
          Ubicación
        </h2>

        <p className="home-location-address">
          <FaLocationDot aria-hidden="true" />
          {address}
        </p>

        <a
          className="home-btn home-btn-outline home-location-link"
          href={directionsOf(installation)}
          target="_blank"
          rel="noreferrer"
        >
          Cómo llegar
          <FaArrowRight aria-hidden="true" />
        </a>
      </div>
    </LocationLayout>
  );
}

/**
 * Dónde va cada cosa según el diseño. Los datos (`children`) y el mapa son los mismos en
 * los tres.
 *
 * En "sobre el mapa" el mapa va afuera de la sección, contra la franja: la sección se
 * anima al aparecer con un transform, y mientras dura, un mapa de posición absoluta
 * adentro se acomodaría contra ella y no contra la franja.
 */
function LocationLayout({
  variant,
  reveal,
  map,
  children,
}: {
  variant: HomeVariants["location"];
  reveal: ReturnType<typeof useFadeIn<HTMLElement>>;
  map: ReactNode;
  children: ReactNode;
}) {
  const section = (inner: ReactNode) => (
    <section
      ref={reveal.ref}
      className={`home-section home-location home-location--${variant} ${reveal.isVisible ? "is-visible" : ""}`}
      aria-labelledby="home-location-title"
    >
      {inner}
    </section>
  );

  if (variant === "overlay") {
    return (
      <div className={`home-location-band home-location-band--overlay ${map ? "" : "is-mapless"}`}>
        {map}
        {section(<div className="home-location-info">{children}</div>)}
      </div>
    );
  }

  return (
    <div className="home-location-band">
      {section(
        <>
          <div className="home-location-info">{children}</div>
          {map}
        </>
      )}
    </div>
  );
}
