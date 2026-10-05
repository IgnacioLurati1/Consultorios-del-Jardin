import type { ReactNode } from "react";
import type { OfficeConfig } from "./configService.ts";

/**
 * Las piezas de la pantalla de configuración.
 *
 * Son las del panel (ui-field, adm-switch, adm-panel) con lo mínimo encima para que cada
 * sección no repita el mismo marcado.
 */

export type SectionProps = {
  draft: OfficeConfig;
  set: <K extends keyof OfficeConfig>(key: K, value: OfficeConfig[K]) => void;
};

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="adm-panel cfg-section">
      <h2 className="adm-panel-head">{title}</h2>
      <div className={aside ? "cfg-with-aside" : undefined}>
        <div className="cfg-fields">{children}</div>
        {aside ? <div className="cfg-aside">{aside}</div> : null}
      </div>
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  wide,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  wide?: boolean;
  max?: number;
}) {
  return (
    <label className={`ui-field ${wide ? "cfg-wide" : ""}`}>
      <span>{label}</span>
      <input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="cfg-switch cfg-wide">
      <span className="cfg-switch-text">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" className="adm-switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
