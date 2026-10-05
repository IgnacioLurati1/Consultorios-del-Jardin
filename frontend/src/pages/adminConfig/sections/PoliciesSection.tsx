import { FaLock } from "react-icons/fa6";
import { bookingWindowText, useWords } from "../../../lib/installation.ts";
import type { Policies } from "../../../lib/policies.ts";
import type { OfficeConfig, RuleEntry, RuleGroupKey } from "../configService.ts";
import { Section, type SectionProps } from "../fields.tsx";

/**
 * Las reglas de funcionamiento que el consultorio puede cambiar.
 *
 * Se dibujan con el catálogo que manda el servidor (textos, opciones, rangos, cuáles están
 * bloqueadas), así que una regla nueva aparece acá sin tocar esta pantalla. Las bloqueadas
 * se ven pero no se mueven: las fijó quien administra el sistema.
 *
 * Unas se guardan en su propia columna (las de la agenda, que ya existían) y otras en el
 * JSON de reglas; para esta pantalla es lo mismo, y `valueOf` / `change` esconden la
 * diferencia.
 */

/** Qué regla depende de cuál. Es el mismo `showIf` del catálogo, mirado sobre el borrador. */
const SHOW_IF: Record<string, (values: Record<string, unknown>) => boolean> = {
  cancelNoticeHours: (values) => values.patientCancel !== false,
  proOverbook: (values) => values.proCreate !== false,
  markWhen: (values) => values.markMode === "assisted" || values.markMode === "missed",
  payWhen: (values) => values.payMode === "always",
  reminderHoursBefore: (values) => values.reminders !== false,
};

function RulesView({ draft, set, groups, title }: SectionProps & { groups: RuleGroupKey[]; title: string }) {
  const catalog = draft.rules;
  if (!catalog) return null;

  const values: Record<string, unknown> = { ...draft.policies };
  for (const rule of catalog.rules) if (!(rule.key in draft.policies)) values[rule.key] = (draft as unknown as Record<string, unknown>)[rule.key];

  const isPolicy = (key: string) => key in draft.policies;
  const change = (key: string, value: unknown) => {
    if (isPolicy(key)) set("policies", { ...draft.policies, [key]: value } as Policies);
    else set(key as keyof OfficeConfig, value as never);
  };

  return (
    <Section title={title}>
      {catalog.groups
        .filter((group) => groups.includes(group.key))
        .map((group) => (
          <fieldset key={group.key} className="cfg-rules cfg-wide">
            <legend>{group.title}</legend>
            {catalog.rules
              .filter((rule) => rule.group === group.key && (SHOW_IF[rule.key]?.(values) ?? true))
              .map((rule) => (
                <RuleField key={rule.key} rule={rule} value={values[rule.key]} onChange={(value) => change(rule.key, value)} />
              ))}
          </fieldset>
        ))}
    </Section>
  );
}

function RuleField({ rule, value, onChange }: { rule: RuleEntry; value: unknown; onChange: (value: unknown) => void }) {
  const locked = rule.locked;
  const hint = rule.key === "bookingWeeksAhead" ? `La agenda muestra ${bookingWindowText(Number(value) || 0).sub}` : rule.hint;
  const lock = locked ? (
    <small className="cfg-locked">
      <FaLock aria-hidden="true" /> No se puede cambiar desde acá
    </small>
  ) : null;

  if (rule.kind === "bool") {
    return (
      <label className={`cfg-switch cfg-wide ${locked ? "is-locked" : ""}`}>
        <span className="cfg-switch-text">
          <span>{rule.label}</span>
          {hint ? <small>{hint}</small> : null}
          {lock}
        </span>
        <input
          type="checkbox"
          className="adm-switch"
          checked={value === true}
          disabled={locked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    );
  }

  if (rule.kind === "choice") {
    return (
      <label className={`ui-field ${locked ? "is-locked" : ""}`}>
        <span>{rule.label}</span>
        <select value={String(value)} disabled={locked} onChange={(event) => onChange(event.target.value)}>
          {(rule.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint ? <small>{hint}</small> : null}
        {lock}
      </label>
    );
  }

  // Un número que acepta "nada": un interruptor para la opción sin número, y el número
  // cuando se apaga. Es como estaban "un turno detrás de otro" y "el día anterior".
  if (rule.kind === "number" && rule.nullLabel) {
    const none = value === null;
    return (
      <>
        <label className={`cfg-switch cfg-wide ${locked ? "is-locked" : ""}`}>
          <span className="cfg-switch-text">
            <span>{rule.nullLabel}</span>
            {lock}
          </span>
          <input
            type="checkbox"
            className="adm-switch"
            checked={none}
            disabled={locked}
            onChange={(event) => onChange(event.target.checked ? null : rule.key === "reminderHoursBefore" ? 24 : 30)}
          />
        </label>
        {!none ? <NumberInput rule={rule} value={value} onChange={onChange} hint={hint} /> : null}
      </>
    );
  }

  if (rule.kind === "number") return <NumberInput rule={rule} value={value} onChange={onChange} hint={hint} lock={lock} />;

  return (
    <label className={`ui-field ${locked ? "is-locked" : ""}`}>
      <span>{rule.label}</span>
      <input value={String(value ?? "")} disabled={locked} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small>{hint}</small> : null}
      {lock}
    </label>
  );
}

function NumberInput({
  rule,
  value,
  onChange,
  hint,
  lock,
}: {
  rule: RuleEntry;
  value: unknown;
  onChange: (value: unknown) => void;
  hint?: string;
  lock?: React.ReactNode;
}) {
  const number = typeof value === "number" ? value : NaN;
  return (
    <label className={`ui-field ${rule.locked ? "is-locked" : ""}`}>
      <span>{rule.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={rule.min}
        max={rule.max}
        disabled={rule.locked}
        value={Number.isFinite(number) ? number : ""}
        onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))}
      />
      {hint ? <small>{hint}</small> : null}
      {lock}
    </label>
  );
}

/** Pedidos, cancelaciones, la agenda y los avisos. Es la pestaña "Turnos". */
export function BookingRulesSection(props: SectionProps) {
  const w = useWords();
  return <RulesView {...props} groups={["reservas", "agenda", "avisos"]} title={w.Turnos} />;
}

/** Lo que puede hacer cada profesional y lo que hace el sistema solo. */
export function TeamRulesSection(props: SectionProps) {
  return <RulesView {...props} groups={["profesionales", "automatico"]} title="Permisos" />;
}
