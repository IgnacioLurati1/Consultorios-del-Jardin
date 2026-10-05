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
import { PHOTO_PREVIEWS } from "../photoPreviews";
import { HomePhoto } from "./HomePhoto";
import { imageUrl, useInstallation, usePolicies, useWords } from "../../../../lib/installation";
import type { Policies } from "../../../../lib/policies";
import type { Words } from "../../../../lib/vocabulary";

/**
 * Las fotos del consultorio, en el orden en que se lo recorre: la entrada, la recepción,
 * un consultorio, la sala bajo el techo vidriado y el jardín.
 *
 * Cada una en dos tamaños. En la computadora son tiras de un quinto de pantalla y alcanza
 * la de 640; en el celular van de a una y a todo el ancho, y ahí la de 640 se ve blanda.
 * El navegador elige con `srcSet` y `sizes`, así la computadora no baja las grandes.
 *
 * `name` es la clave de su vista previa en photoPreviews.ts.
 */
const BUNDLED = [
  { name: "pasillo-mural", src: pasilloMural, large: pasilloMuralLarge },
  { name: "recepcion", src: recepcion, large: recepcionLarge },
  { name: "consultorio", src: consultorio, large: consultorioLarge },
  { name: "patio-vidriado", src: patioVidriado, large: patioVidriadoLarge },
  { name: "jardin-noche", src: jardinNoche, large: jardinNocheLarge },
].map((photo) => ({ ...photo, preview: PHOTO_PREVIEWS[photo.name], largeWidth: 960 }));

/**
 * Las fotos de la portada: las que subió el consultorio, o si no subió ninguna, las de
 * siempre. Las subidas vienen en 640 y en 1600; la de 1600 hace de grande en el celular.
 */
function useHeroPhotos() {
  const { images, bundledPhotos } = useInstallation();
  const uploaded = images.hero;
  // Sin subidas, las del sitio; y si el sitio no trae las suyas, ninguna: nunca las de otro.
  if (uploaded.length === 0) return bundledPhotos ? BUNDLED : [];

  return uploaded.map((image) => ({
    name: image.id,
    src: imageUrl(image.id, "small"),
    large: imageUrl(image.id, "large"),
    preview: image.preview,
    largeWidth: 1600,
  }));
}

/** Hasta este ancho las fotos van de a una, con fundido. Tiene que coincidir con Home.css. */
const PHONE = "(max-width: 700px)";
/** Cuánto se espera a que bajen todas antes de mostrar las que ya están. */
const HOLD_MAX_MS = 5000;

/**
 * Que las fotos aparezcan todas juntas.
 *
 * En la computadora se ven las cinco a la vez. Cuando cada una aparecía al terminar de
 * bajar, la franja cambiaba cinco veces en uno o dos segundos, de a una tira: un parpadeo
 * de brillo que a alguien con epilepsia fotosensible le puede hacer mal. Ahora esperan
 * detrás de su vista previa hasta que están todas, y hacen un solo fundido lento. Si
 * alguna tarda más de la cuenta, pasado `HOLD_MAX_MS` aparecen las que ya bajaron.
 *
 * En el celular pasan de a una, y esperar también sirve: la que entra ya está bajada y no
 * asoma a mitad del pase. Mientras tanto se ve su vista previa, así que no hay hueco.
 *
 * El fundido se decide para todas juntas. Si estaban todas en la caché aparecen de una,
 * sin fundido; si una sola tuvo que bajar, van todas con fundido, porque mezclar las dos
 * cosas es otra vez que cada foto aparezca por su cuenta.
 */
function useHoldUntilAllReady(count: number) {
  // Por foto, si llegó enseguida.
  const [ready, setReady] = useState<ReadonlyMap<number, boolean>>(() => new Map());
  const [waitedEnough, setWaitedEnough] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedEnough(true), HOLD_MAX_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const all = ready.size >= count;

  return {
    active: !waitedEnough && !all,
    instant: all && [...ready.values()].every(Boolean),
    // Devuelve el mismo mapa si ya estaba: HomePhoto puede avisar más de una vez.
    markReady: (index: number, fast: boolean) =>
      setReady((prev) => (prev.has(index) ? prev : new Map(prev).set(index, fast))),
  };
}

/** Cuánto queda cada foto antes de pasar a la siguiente. */
const SLIDE_MS = 5000;

interface Action {
  label: string;
  to: string;
}

/** Los dos accesos de cada uno, debajo de las fotos: el primero es el principal. */
const actionsFor = (w: Words, p: Policies): Record<Session["type"], [Action, Action]> => ({
  guest: [
    { label: "Crear cuenta", to: "/Register" },
    { label: "Iniciar sesión", to: "/Login" },
  ],
  // Donde los turnos se piden al consultorio, el principal es ver los propios.
  client: p.patientBooking
    ? [
        { label: `Solicitar ${w.turno}`, to: "/Appointment" },
        { label: `Mis ${w.turnos}`, to: "/AppointmentsList" },
      ]
    : [
        { label: `Mis ${w.turnos}`, to: "/AppointmentsList" },
        { label: "Contacto", to: "/contacto" },
      ],
  professional: [
    { label: `Panel ${w.del("profesional")}`, to: "/ProfessionalHome" },
    { label: w.Turnos, to: "/AppointmentsList" },
  ],
  admin: [
    { label: "Panel de administración", to: "/AdminHome" },
    { label: `Números ${w.del("lugar")}`, to: "/AdminHome/Analytics" },
  ],
});

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
      // Con una foto o ninguna no hay nada que pasar, y con cero la cuenta del módulo da NaN.
      if (!phone.matches || still.matches || count < 2) return;

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
  const w = useWords();
  const policies = usePolicies();
  const [primary, secondary] = actionsFor(w, policies)[session.type];
  const { name, tagline, heroStyle } = useInstallation();

  // Cuántas fotos lleva la portada. El collage son todas; la foto, la primera sola, que el
  // mismo collage estira a todo el ancho; el texto, ninguna.
  const all = useHeroPhotos();
  const photos = heroStyle === "collage" ? all : heroStyle === "photo" ? all.slice(0, 1) : [];
  const slide = useSlideshow(photos.length);
  const hold = useHoldUntilAllReady(photos.length);

  return (
    <>
      <section className={`home-hero home-hero--${heroStyle}`} aria-labelledby="home-wordmark">
        <div className="home-hero-stage">
          {/* Decorativas: el nombre del consultorio está en el título de abajo. */}
          <div className="home-collage" aria-hidden="true">
            {photos.map((photo, index) => (
              <HomePhoto
                key={photo.src}
                preview={photo.preview}
                hold={hold.active}
                instant={hold.instant}
                onReady={(fast) => hold.markReady(index, fast)}
                frameClassName={index === slide.current ? "is-active" : index === slide.leaving ? "is-leaving" : undefined}
                src={photo.src}
                srcSet={`${photo.src} 640w, ${photo.large} ${photo.largeWidth}w`}
                sizes={`${PHONE} 100vw, 20vw`}
                alt=""
                // Son lo primero que se ve: que el navegador las pida antes que el resto.
                fetchPriority="high"
                // "sync" y no "async": con async Chrome puede mostrar la pantalla sin la foto y
                // dibujarla después, y en esta capa fija y recortada ese "después" llegaba a
                // tardar segundos (al volver al inicio, o al salir del modo celular).
                decoding="sync"
              />
            ))}
          </div>
          <div className="home-vignette" aria-hidden="true" />

          <Wordmark name={name} />
        </div>
      </section>

      <section className="home-intro">
        <div className="home-intro-inner">
          {session.type === "guest" && tagline && <p className="home-intro-lead">{tagline}</p>}

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
function Wordmark({ name }: { name: string }) {
  // El dibujo está hecho para este nombre y para ningún otro: con otro nombre, el nombre en
  // letras, con la misma tipografía y el mismo lugar.
  if (name !== JARDIN) {
    return (
      <h1 className="home-wordmark" id="home-wordmark">
        {name}
      </h1>
    );
  }

  return (
    <h1 className="home-wordmark" id="home-wordmark">
      <span className="home-sr-only">{JARDIN}</span>
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

/** El único nombre que lleva las hojas de tilde. */
const JARDIN = "Consultorios del Jardín";
