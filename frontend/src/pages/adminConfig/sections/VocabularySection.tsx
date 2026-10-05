import { useEffect, useState } from "react";
import { TERM_KEYS, words, type Term, type TermKey } from "../../../lib/vocabulary.ts";
import { previewMail, type PreviewKind } from "../configService.ts";
import { Section, type SectionProps } from "../fields.tsx";

/**
 * Las palabras del rubro, con un mail de muestra al costado.
 *
 * Cada palabra lleva singular, plural y género, porque en castellano cambiar "turno" por
 * "cita" cambia también el artículo y los adjetivos: "el turno confirmado" pasa a ser "la
 * cita confirmada". El mail de la derecha lo arma el servidor con las mismas funciones que
 * los de verdad, así que lo que se ve es exactamente lo que llega.
 */

/** Qué es cada palabra, contado para quien la tiene que elegir. */
const TERMS: Record<TermKey, { label: string; hint: string }> = {
  turno: { label: "Lo que se reserva", hint: "Turno, cita, sesión, clase" },
  profesional: { label: "Quien atiende", hint: "Profesional, doctora, instructor" },
  paciente: { label: "Quien reserva", hint: "Paciente, cliente, alumno" },
  lugar: { label: "El lugar", hint: "Consultorio, centro, estudio" },
  sala: { label: "Cada sala", hint: "Consultorio, sala, box, aula" },
  especialidad: { label: "Lo que se atiende", hint: "Especialidad, servicio, disciplina" },
  sucursal: { label: "Cada sede", hint: "Sucursal, sede, filial" },
};

const KINDS: { id: PreviewKind; label: string }[] = [
  { id: "pedido", label: "Pedido" },
  { id: "confirmado", label: "Confirmación" },
  { id: "recordatorio", label: "Recordatorio" },
  { id: "cancelado", label: "Cancelación" },
  { id: "profesional", label: "Aviso al profesional" },
];

export function VocabularySection({ draft, set }: SectionProps) {
  function setTerm(key: TermKey, change: Partial<Term>) {
    set("vocabulary", { ...draft.vocabulary, [key]: { ...draft.vocabulary[key], ...change } });
  }

  return (
    <Section title="Palabras" aside={<MailPreview draft={draft} />}>
      <p className="cfg-lead cfg-wide">
        Las palabras con las que el sistema nombra cada cosa, en los mails y en las pantallas.
      </p>

      {TERM_KEYS.map((key) => {
        const term = draft.vocabulary[key];
        return (
          <fieldset key={key} className="cfg-term cfg-wide">
            <legend>{TERMS[key].label}</legend>
            <label className="ui-field">
              <span>Singular</span>
              <input value={term.one} maxLength={40} onChange={(e) => setTerm(key, { one: e.target.value })} />
            </label>
            <label className="ui-field">
              <span>Plural</span>
              <input value={term.many} maxLength={40} onChange={(e) => setTerm(key, { many: e.target.value })} />
            </label>
            <div className="cfg-gender" role="radiogroup" aria-label={`Artículo de ${term.one || TERMS[key].label}`}>
              {(["m", "f"] as const).map((gender) => (
                <label key={gender} className={term.gender === gender ? "is-on" : undefined}>
                  <input
                    type="radio"
                    name={`genero-${key}`}
                    checked={term.gender === gender}
                    onChange={() => setTerm(key, { gender })}
                  />
                  {gender === "m" ? "el" : "la"}
                </label>
              ))}
            </div>
            <small className="cfg-term-hint">{TERMS[key].hint}</small>
          </fieldset>
        );
      })}
    </Section>
  );
}

/**
 * El mail de muestra.
 *
 * Se vuelve a pedir un rato después de que se deja de escribir, no con cada letra: cada
 * pedido arma un mail entero en el servidor. Se dibuja en un iframe sin scripts, como lo
 * mostraría un programa de correo.
 */
function MailPreview({ draft }: { draft: SectionProps["draft"] }) {
  const [kind, setKind] = useState<PreviewKind>("confirmado");
  const [mail, setMail] = useState<{ subject: string; html: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Lo que cambia el mail: las palabras y el sobre (nombre, datos, color, consejo).
  const input = JSON.stringify({
    vocabulary: draft.vocabulary,
    name: draft.name,
    address: draft.address,
    publicHours: draft.publicHours,
    instagram: draft.instagram,
    phone: draft.phone,
    whatsapp: draft.whatsapp,
    services: draft.services,
    brandHue: draft.brandHue,
    brandSaturation: draft.brandSaturation,
    elementColors: draft.elementColors ?? {},
    visitAdvice: draft.visitAdvice,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      previewMail(kind, JSON.parse(input), controller.signal)
        .then((result) => {
          setMail(result);
          setProblem(null);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setProblem(error?.response?.data?.message ?? "No se pudo armar la vista previa");
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, input]);

  return (
    <div className="cfg-mail">
      <div className="cfg-mail-kinds" role="tablist" aria-label="Mail de muestra">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={kind === item.id}
            className={kind === item.id ? "is-active" : undefined}
            onClick={() => setKind(item.id)}
          >
            {item.id === "profesional" ? `Aviso ${words(draft.vocabulary).al("profesional")}` : item.label}
          </button>
        ))}
      </div>

      {problem ? (
        <p className="cfg-mail-problem">{problem}</p>
      ) : (
        <>
          <p className="cfg-mail-subject">{mail?.subject ?? " "}</p>
          <iframe className="cfg-mail-frame" title="Vista previa del mail" sandbox="" srcDoc={mail?.html ?? ""} />
        </>
      )}
    </div>
  );
}
