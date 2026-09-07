import { useMemo } from "react";
import { hasStructure, readAnswer } from "./answerFormat";

/**
 * Una respuesta del asistente, dibujada.
 *
 * Cuando trae una lista —los turnos, los horarios libres, los profesionales— cada renglón
 * pasa a ser una tarjeta con el número a la izquierda, el dato principal en grande y el
 * resto abajo. Cuando no, se ve el texto tal cual venía, que para dos frases es mejor que
 * cualquier caja.
 *
 * El color del borde izquierdo es el estado. Es la única parte con color de toda la
 * ventana del asistente, y por eso se lee de un vistazo cuál de los cinco turnos es el
 * que está sin confirmar.
 */
export function AssistantAnswer({ text }: { text: string }) {
  const blocks = useMemo(() => readAnswer(text), [text]);

  if (!hasStructure(blocks)) return <>{text}</>;

  return (
    <div className="chat-answer">
      {blocks.map((block, index) =>
        block.kind === "text" ? (
          <p key={index} className="chat-answer-text">
            {block.text}
          </p>
        ) : (
          <ul key={index} className="chat-list">
            {block.items.map((item, i) => (
              <li key={i} className={`chat-item chat-item--${item.state?.tone ?? "plain"}`}>
                <div className="chat-item-head">
                  {item.number !== null && <span className="chat-item-num">#{item.number}</span>}
                  <span className="chat-item-title">{item.title}</span>
                  {item.state && (
                    <span className={`adm-badge adm-badge-${item.state.tone} chat-item-state`}>{item.state.label}</span>
                  )}
                </div>

                {item.meta.length > 0 && (
                  <div className="chat-item-meta">
                    {item.meta.map((dato, j) => (
                      <span key={j}>{dato}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
