import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { FaChevronLeft, FaChevronRight, FaXmark } from "react-icons/fa6";
import { useFadeIn } from "../useFadeIn";
import salaVidriada from "../../../../assets/gallery/sala-vidriada.webp";
import salaVidriada640 from "../../../../assets/gallery/sala-vidriada-640.webp";
import salaVidriada960 from "../../../../assets/gallery/sala-vidriada-960.webp";
import recepcionEscalera from "../../../../assets/gallery/recepcion-escalera.webp";
import recepcionEscalera640 from "../../../../assets/gallery/recepcion-escalera-640.webp";
import recepcionEscalera960 from "../../../../assets/gallery/recepcion-escalera-960.webp";
import salaJardin from "../../../../assets/gallery/sala-jardin.webp";
import salaJardin640 from "../../../../assets/gallery/sala-jardin-640.webp";
import salaJardin960 from "../../../../assets/gallery/sala-jardin-960.webp";
import salidaJardin from "../../../../assets/gallery/salida-jardin.webp";
import salidaJardin640 from "../../../../assets/gallery/salida-jardin-640.webp";
import salidaJardin960 from "../../../../assets/gallery/salida-jardin-960.webp";
import salaDesdeArriba from "../../../../assets/gallery/sala-desde-arriba.webp";
import salaDesdeArriba640 from "../../../../assets/gallery/sala-desde-arriba-640.webp";
import salaDesdeArriba960 from "../../../../assets/gallery/sala-desde-arriba-960.webp";
import { PHOTO_PREVIEWS } from "../photoPreviews";
import { HomePhoto } from "./HomePhoto";
import { imageUrl, useHomeVariant, useInstallation } from "../../../../lib/installation";

interface Photo {
  /** Su vista previa borrosa, la que se ve mientras llega la de verdad. */
  preview: string | undefined;
  /** La de 1600 px, para verla ampliada. */
  src: string;
  /** Las del carrusel: una de 640 px y otra más grande, con su ancho. */
  small: string;
  medium: string;
  mediumWidth: number;
  alt: string;
}

/** Las de siempre, en la forma de las demás. */
function bundled(photo: { name: string; src: string; small: string; medium: string; alt: string }): Photo {
  return { preview: PHOTO_PREVIEWS[photo.name], src: photo.src, small: photo.small, medium: photo.medium, mediumWidth: 960, alt: photo.alt };
}

/**
 * Las fotos de "Nuestro espacio", las que eligió el consultorio. Van en horizontal, 4:3
 * como salen de la cámara. Para sumar una alcanza con agregarla acá: el carrusel se arma
 * con las que haya. Una vertical se recorta en el carrusel y se ve entera al ampliarla.
 *
 * Cada una en tres tamaños. La de 1600 px se baja recién al ampliarla. En el carrusel,
 * donde se ven mucho más chicas, el navegador elige entre 640 y 960 según la pantalla.
 * Si fueran todas de 1600, al entrar a la portada se bajarían casi 900 KB de fotos que
 * todavía no se ven, y le quitarían conexión a las de arriba.
 */
const BUNDLED: Photo[] = [
  { name: "sala-jardin", src: salaJardin, small: salaJardin640, medium: salaJardin960, alt: "Sala de espera con vista al jardín" },
  {
    name: "sala-vidriada",
    src: salaVidriada,
    small: salaVidriada640,
    medium: salaVidriada960,
    alt: "Sala de espera bajo el techo vidriado",
  },
  {
    name: "recepcion-escalera",
    src: recepcionEscalera,
    small: recepcionEscalera640,
    medium: recepcionEscalera960,
    alt: "Recepción y escalera",
  },
  { name: "salida-jardin", src: salidaJardin, small: salidaJardin640, medium: salidaJardin960, alt: "Salida al jardín" },
  {
    name: "sala-desde-arriba",
    src: salaDesdeArriba,
    small: salaDesdeArriba640,
    medium: salaDesdeArriba960,
    alt: "Sala de espera vista desde el primer piso",
  },
].map(bundled);

/**
 * Las fotos de la galería: las que subió el consultorio, o si no subió ninguna, las de
 * siempre. Las subidas vienen en dos tamaños, 640 y 1600; la de 1600 hace a la vez de grande
 * del carrusel y de ampliada.
 */
function useGalleryPhotos(): Photo[] {
  const { images, bundledPhotos } = useInstallation();
  const uploaded = images.gallery;
  // Sin subidas, las del sitio; y si el sitio no trae las suyas, ninguna: nunca las de otro.
  if (uploaded.length === 0) return bundledPhotos ? BUNDLED : [];

  return uploaded.map((image) => ({
    preview: image.preview || undefined,
    src: imageUrl(image.id, "large"),
    small: imageUrl(image.id, "small"),
    medium: imageUrl(image.id, "large"),
    mediumWidth: 1600,
    alt: image.alt,
  }));
}

/**
 * Qué tan ancha se ve una foto del carrusel, para que el navegador elija el tamaño. Tiene
 * que seguir a `--slide-w` en Home.css: 76vw en el celular y 44vw con tope de 560 px en
 * la computadora.
 */
const SLIDE_SIZES = "(max-width: 620px) 76vw, min(44vw, 560px)";

/** Lleva cualquier número a una foto que existe: después de la última viene la primera. */
function wrap(index: number, count: number) {
  return ((index % count) + count) % count;
}

/**
 * Dónde cae la foto `index` cuando la del medio es `active`: 0 es la del medio, -1 la
 * anterior, 1 la siguiente. Da la vuelta, así que la anterior a la primera es la última.
 */
function offsetOf(index: number, active: number, count: number) {
  const offset = wrap(index - active, count);
  return offset > count / 2 ? offset - count : offset;
}

/** Deslizar con el dedo (o arrastrar con el mouse) pasa de foto, hacia el lado que se tira. */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<number | null>(null);
  const swiped = useRef(false);

  return {
    handlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        start.current = event.clientX;
        swiped.current = false;
      },
      onPointerUp: (event: ReactPointerEvent) => {
        if (start.current === null) return;
        const distance = event.clientX - start.current;
        start.current = null;
        if (Math.abs(distance) < 40) return;
        swiped.current = true;
        if (distance < 0) onNext();
        else onPrev();
      },
      onPointerCancel: () => {
        start.current = null;
      },
    },
    /** Al soltar después de arrastrar llega también un click, que no tiene que abrir ni cerrar nada. */
    consumeSwipe: () => {
      const was = swiped.current;
      swiped.current = false;
      return was;
    },
  };
}

/**
 * Las fotos del consultorio en un carrusel: la del medio entera y la anterior y la
 * siguiente asomándose a los costados, así se ve que hay más sin buscar las flechas. Da la
 * vuelta en los dos sentidos. Tocar cualquiera la abre en grande.
 *
 * Va en su propia franja de color, del ancho de la página, como la ubicación.
 *
 * Es uno de tres diseños (ver HOME_VARIANTS en lib/installation). Los otros dos muestran
 * todas las fotos a la vez: la grilla, con la primera más grande, y la tira, una fila que
 * se desliza de costado. En los tres, tocar una la abre en grande.
 */
export function Gallery() {
  const variant = useHomeVariant("gallery");
  const reveal = useFadeIn<HTMLElement>();
  const photos = useGalleryPhotos();
  const count = photos.length;

  // `previous` sirve para saber qué fotos saltan de un costado al otro al dar la vuelta:
  // esas no se animan, porque cruzarían la pantalla por detrás de las demás.
  const [position, setPosition] = useState({ active: 0, previous: 0 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const slides = useRef<(HTMLButtonElement | null)[]>([]);

  const { active, previous } = position;
  const go = useCallback(
    (index: number) => setPosition((current) => ({ active: wrap(index, count), previous: current.active })),
    [count]
  );
  const swipe = useSwipe(
    () => go(active - 1),
    () => go(active + 1)
  );

  /** El foco sigue a la foto del medio, una vez que ya está dibujada ahí. */
  function focusSlide(index: number) {
    requestAnimationFrame(() => slides.current[wrap(index, count)]?.focus({ preventScroll: true }));
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = active + (event.key === "ArrowLeft" ? -1 : 1);
    go(next);
    focusSlide(next);
  }

  function closeLightbox() {
    if (expanded === null) return;
    // El carrusel queda en la última foto que se miró en grande.
    go(expanded);
    setExpanded(null);
    focusSlide(expanded);
  }

  // Sin fotos no hay galería. Va después de los hooks y no antes: las fotos llegan del
  // servidor, así que la cantidad puede pasar de cero a cinco entre un dibujo y el otro.
  if (count === 0) return null;

  if (variant !== "carousel") {
    return (
      <div className="home-gallery-band">
        <section
          ref={reveal.ref}
          className={`home-section home-gallery home-gallery--${variant} ${reveal.isVisible ? "is-visible" : ""}`}
          aria-labelledby="home-gallery-title"
        >
          <div className="home-section-head">
            <h2 className="home-section-title" id="home-gallery-title">
              Nuestro espacio
            </h2>
          </div>

          <ul className={variant === "grid" ? `home-gallery-grid ${count >= 3 ? "has-feature" : ""}` : "home-gallery-strip"}>
            {photos.map((photo, index) => (
              <li key={photo.src} style={{ "--delay": `${index * 70}ms` } as CSSProperties}>
                <button type="button" className="home-gallery-tile" aria-haspopup="dialog" onClick={() => setExpanded(index)}>
                  <HomePhoto
                    preview={photo.preview ?? ""}
                    src={photo.medium}
                    srcSet={`${photo.small} 640w, ${photo.medium} ${photo.mediumWidth}w`}
                    sizes={variant === "grid" && index === 0 ? "(max-width: 620px) 100vw, 50vw" : "(max-width: 620px) 80vw, 33vw"}
                    alt={photo.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </button>
              </li>
            ))}
          </ul>

          {expanded !== null && (
            <Lightbox photos={photos} index={expanded} onChange={(index) => setExpanded(wrap(index, count))} onClose={() => setExpanded(null)} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="home-gallery-band">
      <section
        ref={reveal.ref}
        className={`home-section home-gallery ${reveal.isVisible ? "is-visible" : ""}`}
        aria-labelledby="home-gallery-title"
      >
        <div className="home-section-head">
          <h2 className="home-section-title" id="home-gallery-title">
            Nuestro espacio
          </h2>
        </div>

        <div
          className="home-gallery-viewport"
          role="group"
          aria-roledescription="carrusel"
          aria-labelledby="home-gallery-title"
          onKeyDown={handleKeyDown}
          {...swipe.handlers}
        >
          <div className="home-gallery-stage">
            {photos.map((photo, index) => {
              const offset = offsetOf(index, active, count);
              const place = offset === 0 ? "center" : Math.abs(offset) === 1 ? "near" : "far";
              const jumps = Math.abs(offset - offsetOf(index, previous, count)) > 1;

              return (
                <button
                  key={photo.src}
                  ref={(node) => {
                    slides.current[index] = node;
                  }}
                  type="button"
                  className="home-gallery-slide"
                  data-place={place}
                  style={{ "--offset": offset, transition: jumps ? "none" : undefined } as CSSProperties}
                  tabIndex={place === "far" ? -1 : 0}
                  aria-hidden={place === "far" ? true : undefined}
                  aria-haspopup="dialog"
                  onClick={() => {
                    if (!swipe.consumeSwipe()) setExpanded(index);
                  }}
                >
                  <HomePhoto
                    preview={photo.preview ?? ""}
                    src={photo.medium}
                    srcSet={`${photo.small} 640w, ${photo.medium} ${photo.mediumWidth}w`}
                    sizes={SLIDE_SIZES}
                    alt={photo.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="home-gallery-controls">
          <button type="button" className="home-gallery-arrow" onClick={() => go(active - 1)} aria-label="Foto anterior">
            <FaChevronLeft aria-hidden="true" />
          </button>

          <div className="home-gallery-dots">
            {photos.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                className="home-gallery-dot"
                onClick={() => go(index)}
                aria-label={`Foto ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
              />
            ))}
          </div>

          <button type="button" className="home-gallery-arrow" onClick={() => go(active + 1)} aria-label="Foto siguiente">
            <FaChevronRight aria-hidden="true" />
          </button>
        </div>

        {expanded !== null && (
          <Lightbox photos={photos} index={expanded} onChange={(index) => setExpanded(wrap(index, count))} onClose={closeLightbox} />
        )}
      </section>
    </div>
  );
}

interface LightboxProps {
  photos: Photo[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

/**
 * La foto en grande, sobre toda la pantalla. Se cierra con la cruz, con Escape o tocando
 * afuera de la foto; se pasa con las flechas de abajo, las del teclado o deslizando.
 *
 * Va directo en el body: dentro de la portada quedaría debajo de la barra de arriba.
 */
function Lightbox({ photos, index, onChange, onClose }: LightboxProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const swipe = useSwipe(
    () => onChange(index - 1),
    () => onChange(index + 1)
  );

  useEffect(() => {
    close.current?.focus();
  }, []);

  useEffect(() => {
    // Con la ventana abierta, el Tab da vueltas entre sus botones y no se va a la página
    // de atrás, que está tapada.
    function keepFocusInside(event: KeyboardEvent) {
      const buttons = [...(dialog.current?.querySelectorAll("button") ?? [])];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onChange(index - 1);
      else if (event.key === "ArrowRight") onChange(index + 1);
      else if (event.key === "Tab") keepFocusInside(event);
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [index, onChange, onClose]);

  return createPortal(
    <div
      ref={dialog}
      className="home-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Nuestro espacio"
      onClick={(event) => {
        if (swipe.consumeSwipe()) return;
        if (event.target === event.currentTarget) onClose();
      }}
      {...swipe.handlers}
    >
      <button ref={close} type="button" className="home-lightbox-btn home-lightbox-close" onClick={onClose} aria-label="Cerrar">
        <FaXmark aria-hidden="true" />
      </button>

      <img key={photo.src} className="home-lightbox-img" src={photo.src} alt={photo.alt} draggable={false} />

      <div className="home-lightbox-bar">
        <button type="button" className="home-lightbox-btn" onClick={() => onChange(index - 1)} aria-label="Foto anterior">
          <FaChevronLeft aria-hidden="true" />
        </button>
        <span className="home-lightbox-count" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button type="button" className="home-lightbox-btn" onClick={() => onChange(index + 1)} aria-label="Foto siguiente">
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
}
