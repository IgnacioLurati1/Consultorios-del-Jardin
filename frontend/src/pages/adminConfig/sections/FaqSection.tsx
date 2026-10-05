import { useRef } from "react";
import { FaArrowDown, FaArrowUp, FaEye, FaEyeSlash, FaPlus, FaTrashCan } from "react-icons/fa6";
import { useInstallation, type Installation } from "../../../lib/installation.ts";
import { words } from "../../../lib/vocabulary.ts";
import {
  FAQ_LIMITS,
  applicationLabel,
  defaultFaq,
  isBuiltinFaq,
  newContentId,
  type FaqEntry,
} from "../../../lib/contentLists.ts";
import { builtinQuestions } from "../../faq/faqQuestions.tsx";
import { Section, type SectionProps } from "../fields.tsx";

/**
 * Las preguntas frecuentes de la web: cuáles se ven, en qué orden y con qué texto.
 *
 * Las de siempre se arman con los datos del consultorio (la dirección, las especialidades,
 * las reglas de turnos) y se actualizan solas cuando cambian. Se pueden ocultar, mover o
 * reescribir; reescrita, una deja de actualizarse y "Volver a la de siempre" la devuelve.
 * Las propias son texto fijo.
 *
 * La vista previa de cada respuesta de siempre se arma con lo que se está editando en las
 * otras pestañas, así que un cambio de dirección o de palabras se ve acá antes de guardar.
 */
export function FaqSection({ draft, set }: SectionProps) {
  const installation = useInstallation();
  const list = draft.faq ?? defaultFaq();
  const previews = useRef<Record<string, HTMLDivElement | null>>({});

  // La instalación como quedaría con lo que se está editando.
  const preview: Installation = {
    ...installation,
    name: draft.name,
    address: draft.address,
    city: draft.city,
    publicHours: draft.publicHours,
    instagram: draft.instagram,
    services: draft.services,
    vocabulary: draft.vocabulary,
    policies: { ...installation.policies, ...draft.policies },
    contactReasons: draft.contactReasons ?? installation.contactReasons,
  };
  const builtin = builtinQuestions(preview);
  const w = words(draft.vocabulary);
  const applicationHidden = !applicationLabel(preview.contactReasons, w);

  function update(index: number, change: Partial<FaqEntry>) {
    set(
      "faq",
      list.map((item, position) => (position === index ? { ...item, ...change } : item))
    );
  }

  function move(index: number, by: number) {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    set("faq", next);
  }

  function remove(index: number) {
    set(
      "faq",
      list.filter((_, position) => position !== index)
    );
  }

  function add() {
    set("faq", [...list, { id: newContentId("p", list), question: "", answer: "", hidden: false }]);
  }

  /** Pasa la respuesta de siempre a texto, para reescribirla desde ahí. */
  function rewrite(index: number, id: string) {
    const text = previews.current[id]?.innerText.trim() ?? "";
    update(index, { answer: text.slice(0, FAQ_LIMITS.answer) });
  }

  return (
    <Section title="Preguntas frecuentes">
      <p className="cfg-lead cfg-wide">
        Las que se ven en la página de preguntas, en este orden. Las de siempre se arman con los datos del consultorio y se
        actualizan solas. Se pueden ocultar o reescribir.
      </p>

      <ul className="cfg-items cfg-wide">
        {list.map((item, index) => {
          const own = !isBuiltinFaq(item.id);
          const base = isBuiltinFaq(item.id) ? builtin[item.id] : null;
          const title = item.question || base?.q || "Pregunta nueva";

          return (
            <li key={item.id} className={`cfg-item ${item.hidden ? "cfg-item-hidden" : ""}`}>
              <div className="cfg-item-head">
                <span className={`adm-badge ${own ? "adm-badge-green" : "adm-badge-grey"}`}>{own ? "Propia" : "De siempre"}</span>
                <strong className="cfg-item-title">{title}</strong>
                <span className="cfg-spec-actions">
                  <button
                    type="button"
                    className="cfg-move"
                    aria-label={item.hidden ? "Mostrar" : "Ocultar"}
                    title={item.hidden ? "Mostrar" : "Ocultar"}
                    onClick={() => update(index, { hidden: !item.hidden })}
                  >
                    {item.hidden ? <FaEyeSlash /> : <FaEye />}
                  </button>
                  <button type="button" className="cfg-move" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
                    <FaArrowUp />
                  </button>
                  <button
                    type="button"
                    className="cfg-move"
                    aria-label="Bajar"
                    disabled={index === list.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <FaArrowDown />
                  </button>
                  {own ? (
                    <button type="button" className="cfg-move" aria-label="Borrar la pregunta" onClick={() => remove(index)}>
                      <FaTrashCan />
                    </button>
                  ) : null}
                </span>
              </div>

              {item.hidden ? (
                <small className="cfg-lead">Oculta. No se ve en la página de preguntas.</small>
              ) : (
                <>
                  <label className="ui-field">
                    <span>Pregunta</span>
                    <input
                      value={item.question}
                      maxLength={FAQ_LIMITS.question}
                      placeholder={base?.q ?? ""}
                      onChange={(event) => update(index, { question: event.target.value })}
                    />
                    {base && !item.question ? <small>Vacía, va la de siempre</small> : null}
                  </label>

                  {base && !item.answer ? (
                    <div className="ui-field">
                      <span>Respuesta</span>
                      <div className="cfg-faq-auto" ref={(node) => void (previews.current[item.id] = node)}>
                        {base.a}
                      </div>
                      <small>Se arma sola con los datos del consultorio.</small>
                      <button type="button" className="adm-btn adm-btn-ghost cfg-faq-rewrite" onClick={() => rewrite(index, item.id)}>
                        Escribir otra respuesta
                      </button>
                    </div>
                  ) : (
                    <label className="ui-field">
                      <span>Respuesta</span>
                      <textarea
                        rows={4}
                        value={item.answer}
                        maxLength={FAQ_LIMITS.answer}
                        onChange={(event) => update(index, { answer: event.target.value })}
                      />
                      <small>Un renglón en blanco separa párrafos.</small>
                      {base ? (
                        <button type="button" className="adm-btn adm-btn-ghost cfg-faq-rewrite" onClick={() => update(index, { answer: "" })}>
                          Volver a la de siempre
                        </button>
                      ) : null}
                    </label>
                  )}

                  {item.id === "sumarse" && applicationHidden && !item.answer ? (
                    <small className="cfg-lead">
                      No se ve mientras el motivo para sumarse al equipo esté oculto en la pestaña Contacto.
                    </small>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="cfg-wide">
        <button type="button" className="adm-btn adm-btn-primary" onClick={add} disabled={list.length >= FAQ_LIMITS.items}>
          <FaPlus aria-hidden="true" /> Agregar pregunta
        </button>
      </div>
    </Section>
  );
}
