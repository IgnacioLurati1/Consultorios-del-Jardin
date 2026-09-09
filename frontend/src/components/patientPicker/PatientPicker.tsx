import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import type { Person } from "../../pages/types.ts";
import "./patientPicker.css";

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/** Cómo se lee un paciente, en la lista y en el campo una vez elegido. */
function fullName(patient: Person): string {
  return `${patient.surname}, ${patient.name}`;
}

/**
 * Cuántos se dibujan de una.
 *
 * El consultorio entero pasa largo de los cien pacientes, y dibujarlos a todos en cada
 * tecla hace que escribir se sienta pesado. Los que no entran aparecen con una letra más,
 * que es lo que uno hace igual cuando no ve al que busca.
 */
const MAX_SHOWN = 30;

interface PatientPickerProps {
  patients: Person[];
  /** El email del elegido. Vacío es que todavía no hay ninguno. */
  value: string;
  onChange: (email: string) => void;
  /** Qué dice el campo mientras no hay nadie elegido. */
  placeholder: string;
}

/**
 * Elegir un paciente escribiendo su nombre.
 *
 * Antes esto era una lista desplegable con el consultorio entero adentro, ordenada como
 * viniera del servidor: para anotar a alguien había que bajar por cientos de nombres
 * buscando el suyo a ojo. Acá se escriben tres letras del apellido y queda.
 *
 * Busca por nombre, por apellido y por email, sin tildes ni mayúsculas: quien escribe
 * "gomez" tiene que encontrar a Gómez.
 */
export function PatientPicker({ patients, value, onChange, placeholder }: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /** Cuál de los resultados está marcado, para poder elegirlo con Enter. */
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = patients.find((patient) => patient.email === value);

  const matches = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return patients;

    return patients.filter(
      (patient) =>
        normalize(patient.name).includes(term) ||
        normalize(patient.surname).includes(term) ||
        normalize(patient.email).includes(term)
    );
  }, [patients, query]);

  const shown = matches.slice(0, MAX_SHOWN);

  // Clickear en cualquier otro lado cierra la lista. Va en mousedown y no en click para
  // que la lista ya no esté cuando el click aterriza en lo que sea que haya debajo.
  useEffect(() => {
    if (!open) return;

    function onDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Abriéndose al pie de una ficha larga, la lista nacía por debajo del borde y no se
  // veía ningún nombre. Se le pide lugar a la ficha, que es la que scrollea.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => boxRef.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Bajando con las flechas, el marcado tiene que seguir a la vista.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function abrir() {
    if (open) return;
    setQuery("");
    setHighlight(0);
    setOpen(true);
  }

  function choose(patient: Person) {
    onChange(patient.email);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        setHighlight(0);
        return;
      }

      const paso = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((actual) => Math.min(Math.max(actual + paso, 0), shown.length - 1));
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const elegido = shown[highlight];
      if (elegido) choose(elegido);
      return;
    }

    if (event.key === "Escape" && open) {
      // La ventana de atrás también escucha Escape. Cerrar la lista de nombres no tiene
      // por qué cerrar además la ficha entera.
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="patient-picker" ref={boxRef}>
      <div className="patient-picker-field">
        <FaMagnifyingGlass className="patient-picker-icon" aria-hidden="true" />

        <input
          ref={inputRef}
          type="text"
          className="patient-picker-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[highlight] ? `${listId}-${highlight}` : undefined}
          placeholder={placeholder}
          // Cerrado muestra a quién se eligió; abierto, lo que se está escribiendo.
          value={open ? query : selected ? fullName(selected) : ""}
          onFocus={abrir}
          // Y también al click, no solo al foco: después de elegir a alguien el campo se
          // queda con el foco puesto, así que volver a tocarlo para cambiar de paciente no
          // disparaba nada y el campo parecía trabado.
          onClick={abrir}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />

        {selected && (
          <button type="button" className="patient-picker-clear" onClick={clear} aria-label="Sacar al paciente elegido">
            <FaXmark />
          </button>
        )}
      </div>

      {open && (
        <ul className="patient-picker-list" id={listId} role="listbox" ref={listRef}>
          {patients.length === 0 ? (
            <li className="patient-picker-empty">Todavía no hay pacientes cargados.</li>
          ) : shown.length === 0 ? (
            <li className="patient-picker-empty">Ningún paciente coincide con lo que escribiste.</li>
          ) : (
            <>
              {shown.map((patient, index) => (
                <li key={patient.email}>
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={patient.email === value}
                    className={`patient-picker-item ${index === highlight ? "marked" : ""}`}
                    // Sin esto el campo pierde el foco antes del click, la lista se cierra
                    // y el click termina cayendo en el vacío.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(patient)}
                  >
                    <span className="patient-picker-avatar" aria-hidden="true">
                      {`${patient.surname?.charAt(0) ?? ""}${patient.name?.charAt(0) ?? ""}`.toUpperCase()}
                    </span>
                    <span className="patient-picker-text">
                      <span className="patient-picker-name">
                        {fullName(patient)}
                        {patient.anonymous && <span className="adm-badge adm-badge-amber patient-picker-badge">Anónimo</span>}
                      </span>
                      <span className="patient-picker-meta">{patient.email}</span>
                    </span>
                  </button>
                </li>
              ))}

              {/* Recién cuando hay más de los que entran. Decir "hay más" con la lista
                  entera a la vista sería mentira. */}
              {matches.length > shown.length && (
                <li className="patient-picker-more">
                  Hay {matches.length - shown.length} más. Seguí escribiendo para achicar la lista.
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
