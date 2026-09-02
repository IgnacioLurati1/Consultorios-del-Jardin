import type { ReactNode } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { Hint } from "../hint/Hint.tsx";

export type BadgeTone = "green" | "amber" | "red" | "grey";

export interface PersonBadge {
  label: string;
  tone: BadgeTone;
  /**
   * Por qué está puesto. Un color llama la atención y no contesta nada: el cartelito
   * que la lleva se subraya punteado y al pasarle el mouse explica de dónde salió.
   */
  hint?: string;
}

interface PeopleSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

/** Buscador del listado. Filtra en vivo, sin botón. */
export function PeopleSearch({ value, onChange, placeholder }: PeopleSearchProps) {
  return (
    <div className="people-search">
      <FaMagnifyingGlass className="people-search-icon" />
      <input
        className="people-search-input"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function PeopleList({ children }: { children: ReactNode }) {
  return <ul className="people-list">{children}</ul>;
}

interface PersonRowProps {
  name: string;
  surname: string;
  /** Segunda línea: el email, o lo que identifique a la persona. */
  meta: ReactNode;
  badges?: PersonBadge[];
  /** Color de las iniciales. Sirve para distinguir de un vistazo el tipo de persona. */
  tone?: "green" | "amber" | "grey";
  onClick?: () => void;
  /**
   * Un botón propio de la fila, al costado.
   *
   * Va afuera del botón de la fila y no adentro: un botón dentro de otro botón no es
   * HTML válido, el navegador lo desarma, y el click termina en cualquiera de los dos.
   */
  action?: ReactNode;
}

/** Fila del listado: iniciales, nombre, una línea de contexto y sus cartelitos. */
export function PersonRow({ name, surname, meta, badges = [], tone = "green", onClick, action }: PersonRowProps) {
  const initials = `${surname?.charAt(0) ?? ""}${name?.charAt(0) ?? ""}`.toUpperCase();

  const content = (
    <>
      <span className={`people-avatar ${tone}`} aria-hidden="true">
        {initials}
      </span>
      <span className="people-row-text">
        <span className="people-row-name">
          {surname}, {name}
        </span>
        <span className="people-row-meta">{meta}</span>
      </span>
      {badges.length > 0 && (
        <span className="people-row-badges">
          {badges.map((badge) => (
            <Hint key={badge.label} text={badge.hint}>
              <span className={`adm-badge adm-badge-${badge.tone}`}>{badge.label}</span>
            </Hint>
          ))}
        </span>
      )}
    </>
  );

  return (
    <li className={action ? "people-item has-action" : "people-item"}>
      {onClick ? (
        <button type="button" className="people-row" onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="people-row">
          {content}
        </div>
      )}
      {action && <div className="people-row-action">{action}</div>}
    </li>
  );
}
