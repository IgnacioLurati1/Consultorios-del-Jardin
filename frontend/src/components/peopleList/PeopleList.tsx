import type { ReactNode } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";

export type BadgeTone = "green" | "amber" | "red" | "grey";

export interface PersonBadge {
  label: string;
  tone: BadgeTone;
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
}

/** Fila del listado: iniciales, nombre, una línea de contexto y sus cartelitos. */
export function PersonRow({ name, surname, meta, badges = [], tone = "green", onClick }: PersonRowProps) {
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
            <span key={badge.label} className={`adm-badge adm-badge-${badge.tone}`}>
              {badge.label}
            </span>
          ))}
        </span>
      )}
    </>
  );

  return (
    <li>
      {onClick ? (
        <button type="button" className="people-row" onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="people-row">{content}</div>
      )}
    </li>
  );
}
