import { FaArrowDown, FaArrowUp, FaEye, FaEyeSlash, FaPlus, FaTrashCan } from "react-icons/fa6";
import { words } from "../../../lib/vocabulary.ts";
import {
  APPLICATION,
  REASON_LIMITS,
  builtinReason,
  defaultReasons,
  isBuiltinReason,
  newContentId,
  type ContactReasonEntry,
} from "../../../lib/contentLists.ts";
import { Section, type SectionProps } from "../fields.tsx";

/**
 * Los motivos del formulario de contacto: cuáles se ofrecen, en qué orden y cómo se llaman.
 *
 * El motivo elegido va en el asunto del mail que llega a la casilla, así que esta lista es
 * también cómo se ordena esa casilla. Los de siempre se pueden renombrar y ocultar, no
 * borrar. El de quien quiere sumarse al equipo pide teléfono y deja adjuntar un CV, se
 * llame como se llame.
 */
export function ContactReasonsSection({ draft, set }: SectionProps) {
  const w = words(draft.vocabulary);
  const list = draft.contactReasons ?? defaultReasons();
  const visible = list.filter((item) => !item.hidden).length;

  function update(index: number, change: Partial<ContactReasonEntry>) {
    set(
      "contactReasons",
      list.map((item, position) => (position === index ? { ...item, ...change } : item))
    );
  }

  function move(index: number, by: number) {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    set("contactReasons", next);
  }

  function remove(index: number) {
    set(
      "contactReasons",
      list.filter((_, position) => position !== index)
    );
  }

  function add() {
    set("contactReasons", [...list, { id: newContentId("m", list), label: "", hint: "", hidden: false }]);
  }

  return (
    <Section title="Motivos de contacto">
      <p className="cfg-lead cfg-wide">
        Las opciones del formulario de contacto, en este orden. El motivo elegido va en el asunto del mail que llega a la
        casilla.
      </p>

      <ul className="cfg-items cfg-wide">
        {list.map((item, index) => {
          const own = !isBuiltinReason(item.id);
          const base = isBuiltinReason(item.id) ? builtinReason(item.id, w) : null;
          const lastVisible = !item.hidden && visible === 1;

          return (
            <li key={item.id} className={`cfg-item ${item.hidden ? "cfg-item-hidden" : ""}`}>
              <div className="cfg-item-head">
                <span className={`adm-badge ${own ? "adm-badge-green" : "adm-badge-grey"}`}>{own ? "Propio" : "De siempre"}</span>
                <strong className="cfg-item-title">{item.label || base?.label || "Motivo nuevo"}</strong>
                <span className="cfg-spec-actions">
                  <button
                    type="button"
                    className="cfg-move"
                    aria-label={item.hidden ? "Mostrar" : "Ocultar"}
                    title={lastVisible ? "Tiene que quedar al menos uno a la vista" : item.hidden ? "Mostrar" : "Ocultar"}
                    disabled={lastVisible}
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
                    <button
                      type="button"
                      className="cfg-move"
                      aria-label="Borrar el motivo"
                      disabled={lastVisible}
                      onClick={() => remove(index)}
                    >
                      <FaTrashCan />
                    </button>
                  ) : null}
                </span>
              </div>

              {item.hidden ? (
                <small className="cfg-lead">Oculto. No se ofrece en el formulario.</small>
              ) : (
                <div className="cfg-item-fields">
                  <label className="ui-field">
                    <span>Nombre</span>
                    <input
                      value={item.label}
                      maxLength={REASON_LIMITS.label}
                      placeholder={base?.label ?? ""}
                      onChange={(event) => update(index, { label: event.target.value })}
                    />
                    {base && !item.label ? <small>Vacío, va el de siempre</small> : null}
                  </label>
                  <label className="ui-field">
                    <span>Aclaración</span>
                    <input
                      value={item.hint}
                      maxLength={REASON_LIMITS.hint}
                      placeholder={base?.hint ?? ""}
                      onChange={(event) => update(index, { hint: event.target.value })}
                    />
                  </label>
                  {item.id === APPLICATION ? (
                    <small className="cfg-lead cfg-wide">Pide teléfono y deja adjuntar un CV. La postulación llega también a cada administrador.</small>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="cfg-wide">
        <button type="button" className="adm-btn adm-btn-primary" onClick={add} disabled={list.length >= REASON_LIMITS.items}>
          <FaPlus aria-hidden="true" /> Agregar motivo
        </button>
      </div>
    </Section>
  );
}
