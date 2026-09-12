import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { FaChevronLeft, FaChevronRight, FaXmark } from "react-icons/fa6";
import { useFadeIn } from "../useFadeIn";
import salaVidriada from "../../../../assets/gallery/sala-vidriada.webp";
import recepcionEscalera from "../../../../assets/gallery/recepcion-escalera.webp";
import salaJardin from "../../../../assets/gallery/sala-jardin.webp";
import salidaJardin from "../../../../assets/gallery/salida-jardin.webp";
import salaDesdeArriba from "../../../../assets/gallery/sala-desde-arriba.webp";

interface Photo {
  src: string;
  alt: string;
}

/**
 * Las fotos de "Nuestro espacio", las que eligió el consultorio. Van en horizontal, 4:3
 * como salen de la cámara, en una versión de 1600 px de ancho para que ampliadas se vean
 * bien. Para sumar una alcanza con agregarla acá: el carrusel se arma con las que haya.
 * Una vertical se recorta en el carrusel y se ve entera al ampliarla.
 */
const PHOTOS: Photo[] = [
  { src: salaJardin, alt: "Sala de espera con vista al jardín" },
  { src: salaVidriada, alt: "Sala de espera bajo el techo vidriado" },
  { src: recepcionEscalera, alt: "Recepción y escalera" },
  { src: salidaJardin, alt: "Salida al jardín" },
  { src: salaDesdeArriba, alt: "Sala de espera vista desde el primer piso" },
];

/** Lleva cualquier número a una foto que existe: después de la última viene la primera. */
function wrap(index: number) {
  return ((index % PHOTOS.length) + PHOTOS.length) % PHOTOS.length;
}

/**
 * Dónde cae la foto `index` cuando la del medio es `active`: 0 es la del medio, -1 la
 * anterior, 1 la siguiente. Da la vuelta, así que la anterior a la primera es la última.
 */
function offsetOf(index: number, active: number) {
  const offset = wrap(index - active);
  return offset > PHOTOS.length / 2 ? offset - PHOTOS.length : offset;
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
 */
export function Gallery() {
  const reveal = useFadeIn<HTMLElement>();

  // `previous` sirve para saber qué fotos saltan de un costado al otro al dar la vuelta:
  // esas no se animan, porque cruzarían la pantalla por detrás de las demás.
  const [position, setPosition] = useState({ active: 0, previous: 0 });
  const [expanded, setExpanded] = useState<number | null>(null);
  const slides = useRef<(HTMLButtonElement | null)[]>([]);

  const { active, previous } = position;
  const go = useCallback((index: number) => setPosition((current) => ({ active: wrap(index), previous: current.active })), []);
  const swipe = useSwipe(
    () => go(active - 1),
    () => go(active + 1)
  );

  /** El foco sigue a la foto del medio, una vez que ya está dibujada ahí. */
  function focusSlide(index: number) {
    requestAnimationFrame(() => slides.current[wrap(index)]?.focus({ preventScroll: true }));
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
            {PHOTOS.map((photo, index) => {
              const offset = offsetOf(index, active);
              const place = offset === 0 ? "center" : Math.abs(offset) === 1 ? "near" : "far";
              const jumps = Math.abs(offset - offsetOf(index, previous)) > 1;

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
                  <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" draggable={false} />
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
            {PHOTOS.map((photo, index) => (
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
          <Lightbox index={expanded} onChange={(index) => setExpanded(wrap(index))} onClose={closeLightbox} />
        )}
      </section>
    </div>
  );
}

interface LightboxProps {
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
function Lightbox({ index, onChange, onClose }: LightboxProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const photo = PHOTOS[index];
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
          {index + 1} / {PHOTOS.length}
        </span>
        <button type="button" className="home-lightbox-btn" onClick={() => onChange(index + 1)} aria-label="Foto siguiente">
          <FaChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
}
