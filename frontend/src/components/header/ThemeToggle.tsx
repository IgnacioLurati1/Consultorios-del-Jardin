import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { FaGear, FaLeaf, FaMoon, FaSeedling, FaSnowflake, FaSun, FaUmbrellaBeach } from "react-icons/fa6";
import type { Season } from "../../context/SeasonContext";
import { nextSeason, SEASONS, useSeason } from "../../context/SeasonContext";
import { useTheme } from "../../context/ThemeContext";
import "./Header.css";

/** Cómo se lee "de 20:00 a 07:00" en la línea de estado del panelito. */
function describe(from: string, to: string): string {
  return `Oscuro de ${from} a ${to}.`;
}

/**
 * El dibujito de cada estación.
 *
 * Son cuatro siluetas que no se parecen entre sí, que es lo único que importa a dieciséis
 * píxeles: un brote, una sombrilla, una hoja y un copo.
 *
 * El sol quedó afuera aunque sea lo primero que uno piensa para el verano: es el botón de
 * al lado. Y el árbol también, aunque cerraba mejor con el brote y la hoja: el de la
 * tipografía es un pino, y un pino dice diciembre en el hemisferio de arriba, que es
 * justo al revés de acá.
 */
const SEASON_ICONS: Record<Season, IconType> = {
  primavera: FaSeedling,
  verano: FaUmbrellaBeach,
  otono: FaLeaf,
  invierno: FaSnowflake,
};

/**
 * Claro y oscuro, con el engranaje al lado para el resto.
 *
 * Son dos botones y no un menú desplegable porque el 99% de las veces lo que se quiere
 * es la acción, no la configuración: cambiar el tema tiene que ser un click. El horario
 * y el color de la estación se eligen una vez en la vida y por eso viven detrás del
 * engranaje.
 */
export function ThemeToggle() {
  const { preference, theme, toggle, setPreference } = useTheme();
  const { choice, season, setChoice } = useSeason();
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
  const automatic = choice === "auto";
  const showing = SEASONS.find((option) => option.key === season);

  const SeasonIcon = SEASON_ICONS[season];
  const siguiente = SEASONS.find((option) => option.key === nextSeason(season));

  return (
    <div className="app-theme" ref={boxRef}>
      <button
        type="button"
        className="app-header-menu"
        // Adelanta una estación y, de paso, la deja fija. Es lo mismo que hace la luna
        // de al lado con el horario: el botón es la acción, y usarlo quiere decir que
        // de acá en más elegís vos.
        onClick={() => setChoice(nextSeason(season))}
        aria-label={`Pasar a ${siguiente?.label.toLowerCase()}`}
        title={showing?.label}
      >
        <SeasonIcon />
      </button>

      <button
        type="button"
        className="app-header-menu"
        onClick={toggle}
        aria-label={theme === "dark" ? "Pasar al modo claro" : "Pasar al modo oscuro"}
        title={theme === "dark" ? "Modo oscuro" : "Modo claro"}
      >
        {/* La luna cuando está oscuro y el sol cuando está claro: el dibujo dice cómo
            está la pantalla, no adónde va a ir. Lo que hace el botón lo dice el rótulo.

            Es al revés de lo que suele hacerse, y es a propósito: el de al lado no tiene
            manera de mostrar "a dónde va" —son cuatro estaciones, no dos— así que muestra
            la que está puesta. Dos botones pegados leyéndose al revés uno del otro es
            peor que apartarse de la costumbre. */}
        {theme === "dark" ? <FaMoon /> : <FaSun />}
      </button>

      <button
        type="button"
        className={`app-header-menu app-theme-gear ${open ? "open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Configurar cómo se ve"
        aria-expanded={open}
        title="Cómo se ve"
      >
        <FaGear />
      </button>

      {open && (
        <div className="app-user-menu app-theme-menu" role="dialog" aria-label="Cómo se ve">
          <div className="app-user-menu-head">
            <span className="app-user-menu-name">Modo oscuro</span>
            <span className="app-user-menu-mail">
              {scheduled ? describe(preference.from, preference.to) : "Cambio manual con el botón de al lado."}
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
            <span>Automático por horario</span>
          </label>

          <div className="app-theme-times" aria-hidden={!scheduled}>
            <label className="app-theme-time">
              <span>Desde</span>
              <input
                type="time"
                value={preference.from}
                disabled={!scheduled}
                onChange={(event) => setPreference({ ...preference, from: event.target.value })}
              />
            </label>
            <label className="app-theme-time">
              <span>Hasta</span>
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
              ? "El rango puede cruzar la medianoche, por ejemplo de 20:00 a 07:00."
              : "Evita cambiarlo a mano cada noche."}
          </p>

          <div className="app-theme-split" />

          <div className="app-user-menu-head">
            <span className="app-user-menu-name">Color</span>
            <span className="app-user-menu-mail">
              {automatic ? `Ahora es ${showing?.label.toLowerCase()}.` : "Elección manual."}
            </span>
          </div>

          <label className="app-theme-check">
            <input
              type="checkbox"
              checked={automatic}
              // Igual que el horario, apagarlo deja puesta la que se está viendo: dejar
              // de seguir al calendario no tiene por qué cambiar nada en pantalla.
              onChange={(event) => setChoice(event.target.checked ? "auto" : season)}
            />
            <span>Según la estación</span>
          </label>

          <div className="app-season-grid" aria-hidden={automatic}>
            {SEASONS.map((option) => (
              <button
                key={option.key}
                type="button"
                // El mismo atributo que lleva <html>. Puesto acá, adentro del botón
                // vale su estación: la muestra de color se dibuja sola y no hay que
                // repetir en ningún lado de qué color es cada una.
                data-season={option.key}
                className={`app-season-option ${season === option.key ? "active" : ""}`}
                disabled={automatic}
                aria-pressed={season === option.key}
                onClick={() => setChoice(option.key)}
              >
                <span className="app-season-swatch" />
                <span className="app-season-name">{option.label}</span>
              </button>
            ))}
          </div>

          <p className="app-theme-note">
            {automatic
              ? "Cambia sola cuatro veces al año, con el calendario de acá."
              : "Queda fija hasta un nuevo cambio."}
          </p>
        </div>
      )}
    </div>
  );
}
