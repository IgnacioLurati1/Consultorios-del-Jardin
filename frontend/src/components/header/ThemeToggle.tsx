import { useEffect, useRef, useState } from "react";
import { FaGear, FaMoon, FaSun } from "react-icons/fa6";
import { useTheme } from "../../context/ThemeContext";
import "./Header.css";

/** Cómo se lee "de 20:00 a 07:00" en la línea de estado del panelito. */
function describe(from: string, to: string): string {
  return `Oscuro de ${from} a ${to}.`;
}

/**
 * Claro y oscuro, con el engranaje al lado para dejarlo en automático.
 *
 * Son dos botones y no un menú desplegable porque el 99% de las veces lo que se quiere
 * es la acción, no la configuración: cambiar el tema tiene que ser un click. El horario
 * se elige una vez en la vida y por eso vive detrás del engranaje.
 */
export function ThemeToggle() {
  const { preference, theme, toggle, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Cerrar al clickear afuera o con Escape, como el menú de la sesión que tiene al lado.
  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const scheduled = preference.mode === "schedule";

  return (
    <div className="app-theme" ref={boxRef}>
      <button
        type="button"
        className="app-header-menu"
        onClick={toggle}
        aria-label={theme === "dark" ? "Pasar al modo claro" : "Pasar al modo oscuro"}
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      >
        {theme === "dark" ? <FaSun /> : <FaMoon />}
      </button>

      <button
        type="button"
        className={`app-header-menu app-theme-gear ${open ? "open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Configurar el modo oscuro"
        aria-expanded={open}
        title="Configurar el modo oscuro"
      >
        <FaGear />
      </button>

      {open && (
        <div className="app-user-menu app-theme-menu" role="dialog" aria-label="Modo oscuro">
          <div className="app-user-menu-head">
            <span className="app-user-menu-name">Modo oscuro</span>
            <span className="app-user-menu-mail">
              {scheduled ? describe(preference.from, preference.to) : "Lo cambiás vos con el botón de al lado."}
            </span>
          </div>

          <label className="app-theme-check">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(event) =>
                setPreference({
                  ...preference,
                  // Al apagar el horario queda lo que se está viendo en ese momento, que
                  // es lo que la persona tiene delante: apagarlo no debería cambiar nada
                  // en pantalla, solo dejar de moverlo solo.
                  mode: event.target.checked ? "schedule" : theme,
                })
              }
            />
            <span>Que se prenda y se apague solo</span>
          </label>

          <div className="app-theme-times" aria-hidden={!scheduled}>
            <label className="app-theme-time">
              <span>Se prende</span>
              <input
                type="time"
                value={preference.from}
                disabled={!scheduled}
                onChange={(event) => setPreference({ ...preference, from: event.target.value })}
              />
            </label>
            <label className="app-theme-time">
              <span>Se apaga</span>
              <input
                type="time"
                value={preference.to}
                disabled={!scheduled}
                onChange={(event) => setPreference({ ...preference, to: event.target.value })}
              />
            </label>
          </div>

          <p className="app-theme-note">
            {scheduled
              ? "Podés poner un rango que cruce la medianoche, como de 20:00 a 07:00."
              : "Sirve para no acordarte de cambiarlo todas las noches."}
          </p>
        </div>
      )}
    </div>
  );
}
