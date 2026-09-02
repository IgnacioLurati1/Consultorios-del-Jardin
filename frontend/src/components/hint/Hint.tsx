import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./hint.css";

/** Cuánto aire se le deja al borde de la ventana antes de correr el globo. */
const MARGIN = 12;

/** Distancia entre el globo y lo que explica, con la flechita adentro. */
const GAP = 10;

interface Position {
  left: number;
  top: number;
  /** Dónde va la punta dentro del globo, medida desde su borde izquierdo. */
  arrow: number;
  /** Arriba salvo que no entre: ahí baja, y la punta se da vuelta. */
  below: boolean;
}

interface Props {
  /** Lo que se lee al pasar el mouse. Sin texto, el hijo se dibuja tal cual. */
  text?: string;
  children: ReactNode;
}

/**
 * La explicación de algo que se marcó con un color.
 *
 * Reemplaza al `title` del navegador, que tarda un segundo largo en aparecer, se corta
 * a un ancho que no controla nadie y se dibuja con la tipografía del sistema en medio
 * de una pantalla que no la usa en ningún otro lado. Acá el texto sale enseguida, se
 * lee con el mismo tipo que el resto y entra entero.
 *
 * El globo se dibuja en el `body` y posicionado contra la ventana: los paneles recortan
 * lo que se sale de ellos (`overflow: hidden`), y una fila del final de un listado tiene
 * su explicación justo ahí, donde se recorta.
 */
export function Hint({ text, children }: Props) {
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const id = useId();

  const show = useCallback(() => setOpen(true), []);

  const hide = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  // Se ubica después de montarlo y antes de que se pinte: el alto depende de cuántos
  // renglones entraron, y eso no se sabe hasta que el texto está puesto. Va en un efecto
  // de layout y no en un `requestAnimationFrame` porque ahí el globo todavía puede no
  // estar montado, y entonces no hay nada que medir.
  useLayoutEffect(() => {
    if (!open) return;

    const size = bubble.current?.getBoundingClientRect();
    const target = anchor.current?.getBoundingClientRect();
    if (!size || !target) return;

    const below = target.top - size.height - GAP < MARGIN;
    const top = below ? target.bottom + GAP : target.top - size.height - GAP;

    const wanted = target.left + target.width / 2 - size.width / 2;
    const left = Math.min(Math.max(wanted, MARGIN), window.innerWidth - size.width - MARGIN);

    // Contra el borde de la ventana el globo se corre pero lo que explica no, así que la
    // punta se calcula aparte para que siga apuntándole.
    const centre = target.left + target.width / 2 - left;
    const arrow = Math.min(Math.max(centre, 16), size.width - 16);

    setPosition({ left, top, arrow, below });
  }, [open]);

  if (!text) return <>{children}</>;

  return (
    <span
      ref={anchor}
      className="ui-hint"
      // El texto va también en el aria: quien no puede pasar el mouse por encima tiene
      // que poder enterarse igual de por qué está marcado.
      aria-describedby={open ? id : undefined}
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {open &&
        createPortal(
          <span
            id={id}
            ref={bubble}
            role="tooltip"
            className={`ui-hint-bubble ${position?.below ? "below" : ""}`}
            style={
              {
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                // Antes de medirlo no se sabe dónde va, y un globo que aparece en una
                // esquina y salta al lugar bueno se ve peor que uno que aparece y ya está.
                visibility: position ? "visible" : "hidden",
                "--ui-hint-arrow": `${position?.arrow ?? 0}px`,
              } as CSSProperties
            }
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
