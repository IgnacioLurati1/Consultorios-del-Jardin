import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FaArrowLeft, FaArrowRight, FaCheck } from "react-icons/fa6";
import "./steppedForm.css";

export interface FormStep {
  id: string;
  /** Nombre corto del paso: es lo que se ve en la barra de arriba. */
  title: string;
  hint?: string;
  content: ReactNode;
  /**
   * Devuelve el mensaje a mostrar, o null si el paso está completo.
   * Puede ser asíncrono: hay chequeos que necesitan preguntarle al servidor.
   */
  validate: () => string | null | Promise<string | null>;
}

interface SteppedFormProps {
  title: string;
  subtitle?: string;
  logo?: string;
  steps: FormStep[];
  submitLabel: string;
  submitting?: boolean;
  /** Qué dice el botón mientras se envía. Por defecto habla de crear, que es el caso más común. */
  submittingLabel?: string;
  /** Error que devolvió el servidor. Se muestra sin cambiar de paso. */
  serverError?: string | null;
  onSubmit: () => void;
  footerNote?: ReactNode;
}

/**
 * Formulario largo partido en pasos que se deslizan de costado.
 * Cada paso se valida antes de dejar avanzar, así el usuario corrige de a poco en vez
 * de encontrarse con una lista de errores al final. Igual, antes de enviar se revisan
 * todos: si alguno quedó incompleto, vuelve a ese paso y dice qué falta.
 */
export function SteppedForm({
  title,
  subtitle,
  logo,
  steps,
  submitLabel,
  submitting = false,
  submittingLabel = "Creando…",
  serverError,
  onSubmit,
  footerNote,
}: SteppedFormProps) {
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // La cinta mide lo que mide el paso más largo, así que sin esto los pasos cortos
  // quedaban con un hueco enorme abajo. El alto lo pone el paso activo y se anima.
  const panels = useRef<(HTMLElement | null)[]>([]);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const panel = panels.current[index];
    if (!panel) return;

    const measure = () => setHeight(panel.scrollHeight);
    measure();

    // El alto cambia solo cuando aparece un mensaje o el navegador reajusta los campos.
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [index]);

  const isLast = index === steps.length - 1;
  const step = steps[index];
  const busy = checking || submitting;

  function goTo(next: number) {
    setError(null);
    setIndex(next);
  }

  async function handleNext() {
    setChecking(true);
    try {
      const problem = await step.validate();
      if (problem) {
        setError(problem);
        return;
      }

      goTo(index + 1);
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // El botón principal es siempre de tipo submit y acá se decide qué significa.
    // Cuando eran dos botones distintos, el click que llevaba al último paso dejaba
    // convertido al botón en submit antes de que el navegador ejecutara la acción por
    // defecto: el mismo click avanzaba y enviaba, y el paso final aparecía en rojo por
    // un campo que el usuario todavía no había visto. De paso, Enter en cualquier campo
    // ahora vale como "Siguiente".
    if (!isLast) {
      await handleNext();
      return;
    }

    setChecking(true);
    try {
      // Red de seguridad: si alguien llegó hasta acá con un paso anterior incompleto
      // (por ejemplo, volviendo atrás y borrando algo), se lo lleva a ese paso.
      for (let i = 0; i < steps.length; i++) {
        const problem = await steps[i].validate();
        if (problem) {
          setIndex(i);
          setError(problem);
          return;
        }
      }

      setError(null);
      onSubmit();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="sf-page">
      {/* noValidate: los mensajes los damos nosotros, no el globito del navegador. */}
      <form className="sf-card" onSubmit={handleSubmit} noValidate>
        <div className="sf-head">
          {logo && <img src={logo} alt="" className="sf-logo" />}
          <h1 className="sf-title">{title}</h1>
          {subtitle && <p className="sf-subtitle">{subtitle}</p>}
        </div>

        <ol className="sf-steps">
          {steps.map((item, i) => (
            <li key={item.id} className={`sf-step ${i === index ? "current" : ""} ${i < index ? "done" : ""}`}>
              <button
                type="button"
                className="sf-step-button"
                // Solo se puede volver a un paso ya visitado: hacia adelante se avanza validando.
                disabled={i > index}
                onClick={() => goTo(i)}
              >
                <span className="sf-step-dot">{i < index ? <FaCheck /> : i + 1}</span>
                <span className="sf-step-name">{item.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="sf-viewport" style={{ height }}>
          <div className="sf-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {steps.map((item, i) => (
              // inert: los campos de los pasos que no se ven no reciben foco ni tabulación
              <section
                className="sf-panel"
                key={item.id}
                ref={(el) => {
                  panels.current[i] = el;
                }}
                inert={i !== index}
                aria-hidden={i !== index}
              >
                {item.hint && <p className="sf-panel-hint">{item.hint}</p>}
                {item.content}
              </section>
            ))}
          </div>
        </div>

        {(error || serverError) && <p className="ui-alert ui-alert-error sf-error">{error ?? serverError}</p>}

        <div className="sf-actions">
          <button type="button" className="adm-btn adm-btn-ghost" disabled={index === 0 || busy} onClick={() => goTo(index - 1)}>
            <FaArrowLeft />
            Volver
          </button>

          <button type="submit" className="adm-btn adm-btn-primary sf-submit" disabled={busy}>
            {submitting ? (
              submittingLabel
            ) : checking ? (
              "Revisando…"
            ) : isLast ? (
              submitLabel
            ) : (
              <>
                Siguiente
                <FaArrowRight />
              </>
            )}
          </button>
        </div>

        {footerNote && <p className="sf-foot">{footerNote}</p>}
      </form>
    </div>
  );
}
