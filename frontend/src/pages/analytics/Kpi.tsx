import type { ReactNode } from "react";

interface KpiProps {
  label: string;
  value: ReactNode;
  /** Segunda línea: la aclaración que hace que el número se entienda. */
  note?: ReactNode;
  /** Destaca la tarjeta principal del bloque. */
  lead?: boolean;
  /**
   * Pinta el número de rojo. Para lo que no está bien y hay que hacer algo al respecto,
   * no para lo que es simplemente un número alto: si todas las tarjetas gritan, ninguna
   * grita. Hoy lo usa una sola, la plata que quedó sin cobrar.
   */
  tone?: "danger";
}

export function Kpi({ label, value, note, lead, tone }: KpiProps) {
  return (
    <div className={`an-kpi ${lead ? "an-kpi-lead" : ""} ${tone === "danger" ? "an-kpi-danger" : ""}`}>
      <span className="an-kpi-label">{label}</span>
      <strong className="an-kpi-value">{value}</strong>
      {note && <span className="an-kpi-note">{note}</span>}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="an-kpi-grid">{children}</div>;
}

interface SectionProps {
  title: string;
  /** Qué recorte de datos se está mirando. */
  scope?: string;
  /** Controles del bloque, por ejemplo elegir de qué mes son los números. */
  actions?: ReactNode;
  children: ReactNode;
}

export function AnalyticsSection({ title, scope, actions, children }: SectionProps) {
  return (
    <section className="an-section">
      <div className="an-section-head">
        <h2 className="an-section-title">{title}</h2>
        {actions}
        {scope && <span className="an-section-scope">{scope}</span>}
      </div>
      {children}
    </section>
  );
}

interface MonthTabsProps {
  months: { key: string; label: string; inProgress: boolean }[];
  selected: string;
  onSelect: (key: string) => void;
}

/**
 * Elige de qué mes son las tarjetas. Está el mes que corre y el anterior: el primero
 * de mes uno todavía quiere ver (y exportar) cómo cerró el que acaba de terminar.
 */
export function MonthTabs({ months, selected, onSelect }: MonthTabsProps) {
  return (
    <div className="adm-chips an-months" role="group" aria-label="Mes">
      {months.map((month) => (
        <button
          key={month.key}
          type="button"
          className={selected === month.key ? "active" : ""}
          aria-pressed={selected === month.key}
          onClick={() => onSelect(month.key)}
        >
          {month.label}
        </button>
      ))}
    </div>
  );
}
