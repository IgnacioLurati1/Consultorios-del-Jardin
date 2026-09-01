import { useEffect, useId, type ReactNode } from "react";
import { FaXmark } from "react-icons/fa6";

interface ModalProps {
  open: boolean;
  title: string;
  /** Línea de contexto bajo el título: fecha, email, lo que ubique al usuario. */
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Botonera del pie. Sin esto, la ventana no dibuja pie. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * Ventana modal de la app. Se encarga de lo que antes repetía cada pantalla a su
 * manera: cerrar con Escape o clickeando afuera, frenar el scroll del fondo y no
 * pasarse del alto de la pantalla (la cabecera y los botones quedan fijos y lo que
 * scrollea es el contenido).
 */
export function Modal({ open, title, subtitle, onClose, children, footer, size = "md" }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    // Sin esto el fondo scrollea detrás de la ventana y se pierde la posición.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className={`ui-modal ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal-head">
          <div className="ui-modal-titles">
            <h2 className="ui-modal-title" id={titleId}>
              {title}
            </h2>
            {subtitle && <p className="ui-modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Cerrar">
            <FaXmark />
          </button>
        </div>

        <div className="ui-modal-body">{children}</div>

        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
