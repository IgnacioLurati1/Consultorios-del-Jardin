import type { OfficeConfig } from "../configService.ts";
import { Section, type SectionProps } from "../fields.tsx";

/** Cómo habla el asistente y qué sabe del consultorio además de lo que sale de la base. */
export function AssistantSection({ draft, set }: SectionProps) {
  return (
    <Section title="Asistente">
      <label className="ui-field">
        <span>Trato</span>
        <select
          value={draft.assistantTone}
          onChange={(e) => set("assistantTone", e.target.value as OfficeConfig["assistantTone"])}
        >
          <option value="voseo">De vos</option>
          <option value="tuteo">De tú</option>
          <option value="usted">De usted</option>
        </select>
      </label>

      <label className="ui-field cfg-wide">
        <span>Información para el asistente</span>
        <textarea
          rows={5}
          maxLength={1000}
          value={draft.assistantNotes}
          onChange={(e) => set("assistantNotes", e.target.value)}
        />
        <small>
          Obras sociales, estacionamiento, formas de pago. El asistente lo cuenta si le preguntan ·{" "}
          {draft.assistantNotes.length}/1000
        </small>
      </label>
    </Section>
  );
}
