import { useEffect, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import { GUIDE_STEPS } from "./guideSteps.ts";
import "./professionalGuide.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * La guía del panel del profesional, un paso por pantalla.
 *
 * Qué dice cada paso está en `guideSteps.ts`, y cuándo se abre sola, en
 * `useProfessionalGuide`.
 */
export function ProfessionalGuide({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  // Cada vez que se abre arranca del principio: el que la vuelve a abrir desde el botón de
  // ayuda no se acuerda en qué paso la había dejado.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Las flechas del teclado pasan de paso, como en cualquier presentación.
  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setStep((current) => Math.min(current + 1, GUIDE_STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((current) => Math.max(current - 1, 0));
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const current = GUIDE_STEPS[step];
  const first = step === 0;
  const last = step === GUIDE_STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Cómo funciona el panel"
      subtitle={`Paso ${step + 1} de ${GUIDE_STEPS.length}`}
      footer={
        <>
          {first ? (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
              Ahora no
            </button>
          ) : (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setStep(step - 1)}>
              <FaArrowLeft aria-hidden="true" />
              Anterior
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-primary" onClick={last ? onClose : () => setStep(step + 1)}>
            {first ? "Empezar" : last ? "Listo" : "Siguiente"}
            {!last && <FaArrowRight aria-hidden="true" />}
          </button>
        </>
      }
    >
      <div className="guide">
        {/* La barra de avance, en tramos. Cada tramo lleva a su paso: el que ya sabe cómo
            funcionan los turnos va derecho a los pacientes sin cuenta. */}
        <ol className="guide-progress">
          {GUIDE_STEPS.map((item, index) => (
            <li key={item.title}>
              <button
                type="button"
                className={index === step ? "active" : index < step ? "done" : ""}
                aria-label={`Paso ${index + 1}, ${item.title}`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              />
            </li>
          ))}
        </ol>

        {/* La key hace que el paso nuevo entre con su animación en vez de cambiar el texto
            en el lugar, que se lee como un parpadeo. */}
        <div className="guide-step" key={step} aria-live="polite">
          <span className="guide-icon" aria-hidden="true">
            <Icon />
          </span>
          <h3 className="guide-title">{current.title}</h3>
          <p className="guide-text">{current.text}</p>
          {current.where && (
            <p className="guide-where">
              <span className="guide-where-label">Dónde</span>
              {current.where}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
